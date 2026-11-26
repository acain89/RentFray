import * as crypto from "node:crypto";

import assert from "node:assert/strict";

import { requiredText, requiredDate, requiredMapValue } from "./fixture-assertions";
import { load } from "./manual-payment-idempotency.fixture";


// Isolated SQL contract model, not a substitute for PostgreSQL row-lock tests.
export function throttleFixture() {
  const rows = new Map<string, { attemptCount: number; windowExpiresAt: Date }>();
  const properties = new Map<string, { id: string; status: string; isActive: boolean }>([["AAAA", { id: "A", status: "LIVE", isActive: true }], ["BBBB", { id: "B", status: "LIVE", isActive: true }]]);
  const events: string[] = [];
  const controls = { now: 1000000, retries: 0, error: null as unknown, cleanupFails: false, inTransaction: false };
  let tail = Promise.resolve();
  const tx = {
    property: { findUnique: async ({ where }: { where: { propertyCode: string } }) => { events.push("property"); return properties.get(where.propertyCode) ?? null; } },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?"); events.push(sql);
      if (sql.includes("SKIP LOCKED")) {
        if (controls.cleanupFails) throw Error("cleanup failed");
        return [...rows].filter(([, r]) => r.windowExpiresAt.getTime() <= controls.now)
          .sort((a, b) => a[1].windowExpiresAt.getTime() - b[1].windowExpiresAt.getTime() || a[0].localeCompare(b[0]))
          .slice(0, 100).map(([key]) => ({ key }));
      }
      if (sql.includes("FOR UPDATE")) return rows.has(requiredText(values[0])) ? [{ ...rows.get(requiredText(values[0])) }] : [];
      if (sql.includes("clock_timestamp")) return [{ now: new Date(controls.now) }];
      throw Error("Unexpected query " + sql);
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?"); events.push(sql);
      if (sql.includes("INSERT")) { if (!rows.has(requiredText(values[0]))) rows.set(requiredText(values[0]), { attemptCount: 0, windowExpiresAt: new Date(0) }); }
      else if (sql.includes("DELETE")) { if (requiredMapValue(rows, requiredText(values[0])).windowExpiresAt.getTime() <= controls.now) rows.delete(requiredText(values[0])); }
      else if (sql.includes('"attemptCount" = 1,')) rows.set(requiredText(values[1]), { attemptCount: 1, windowExpiresAt: requiredDate(values[0]) });
      else if (sql.includes("UPDATE")) requiredMapValue(rows, requiredText(values[0])).attemptCount++;
      else throw Error("Unexpected write " + sql);
      return 1;
    },
  };
  const prisma = { $transaction: async <Result>(fn: (client: typeof tx) => Promise<Result>, options: { isolationLevel: string }): Promise<Result> => {
    assert.equal(options.isolationLevel, "ReadCommitted");
    const previous = tail; let release!: () => void; tail = new Promise<void>(r => release = r); await previous;
    const saved = new Map([...rows].map(([k, v]) => [k, { ...v }])); controls.inTransaction = true;
    try {
      if (controls.error) throw controls.error;
      // Inject after a global increment to prove full rollback/retry accounting.
      const result = await fn(tx);
      if (!events.at(-1)?.includes("DELETE") && controls.retries > 0) { controls.retries--; throw { code: "P2010", meta: { code: "40P01" } }; }
      return result;
    } catch (e) { rows.clear(); saved.forEach((v, k) => rows.set(k, v)); throw e; }
    finally { controls.inTransaction = false; release(); }
  } };
  const imports = { "node:crypto": crypto, "@/lib/prisma": { prisma }, "@prisma/client": { Prisma: { TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" } } } };
  const caller = () => load("lib/authThrottle.ts", imports);
  return { rows, properties, events, controls, caller, api: caller() };
}
