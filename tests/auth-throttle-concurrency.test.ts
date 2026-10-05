import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load, root } from "./manual-payment-idempotency.test";

// Isolated SQL contract model, not a substitute for PostgreSQL row-lock tests.
export function throttleFixture() {
  const rows = new Map<string, { attemptCount: number; windowExpiresAt: Date }>();
  const properties = new Map<string, any>([["AAAA", { id: "A", status: "LIVE", isActive: true }], ["BBBB", { id: "B", status: "LIVE", isActive: true }]]);
  const events: string[] = [];
  const controls = { now: 1000000, retries: 0, error: null as any, cleanupFails: false, inTransaction: false };
  let tail = Promise.resolve();
  const tx: any = {
    property: { findUnique: async ({ where }: any) => { events.push("property"); return properties.get(where.propertyCode) ?? null; } },
    $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join("?"); events.push(sql);
      if (sql.includes("SKIP LOCKED")) {
        if (controls.cleanupFails) throw Error("cleanup failed");
        return [...rows].filter(([, r]) => r.windowExpiresAt.getTime() <= controls.now)
          .sort((a, b) => a[1].windowExpiresAt.getTime() - b[1].windowExpiresAt.getTime() || a[0].localeCompare(b[0]))
          .slice(0, 100).map(([key]) => ({ key }));
      }
      if (sql.includes("FOR UPDATE")) return rows.has(values[0]) ? [{ ...rows.get(values[0]) }] : [];
      if (sql.includes("clock_timestamp")) return [{ now: new Date(controls.now) }];
      throw Error("Unexpected query " + sql);
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join("?"); events.push(sql);
      if (sql.includes("INSERT")) { if (!rows.has(values[0])) rows.set(values[0], { attemptCount: 0, windowExpiresAt: new Date(0) }); }
      else if (sql.includes("DELETE")) { if (rows.get(values[0])!.windowExpiresAt.getTime() <= controls.now) rows.delete(values[0]); }
      else if (sql.includes('"attemptCount" = 1,')) rows.set(values[1], { attemptCount: 1, windowExpiresAt: values[0] });
      else if (sql.includes("UPDATE")) rows.get(values[0])!.attemptCount++;
      else throw Error("Unexpected write " + sql);
      return 1;
    },
  };
  const prisma: any = { $transaction: async (fn: any, options: any) => {
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
  const imports = { "@/lib/prisma": { prisma }, "@prisma/client": { Prisma: { TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" } } } };
  const caller = () => load("lib/authThrottle.ts", imports);
  return { rows, properties, events, controls, caller, api: caller() };
}

test("ADMIN exact limit, expiration equality, success-independent aggregate state", async () => {
  const f = throttleFixture();
  for (let i = 0; i < 10; i++) assert.equal((await f.api.admitAdminLogin()).admitted, true);
  const denied = await f.api.admitAdminLogin(); assert.equal(denied.admitted, false); assert.equal(denied.retryAfter, 300);
  assert.equal(f.rows.get("admin:global")!.attemptCount, 10);
  f.controls.now += 299999; assert.equal((await f.api.admitAdminLogin()).retryAfter, 1);
  f.controls.now++; assert.equal((await f.api.admitAdminLogin()).admitted, true); assert.equal(f.rows.get("admin:global")!.attemptCount, 1);
});
test("parallel independent ADMIN callers share first-use state and ceiling", async () => {
  const f = throttleFixture(); const callers = [f.api, f.caller(), f.caller()];
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => callers[i % 3].admitAdminLogin()));
  assert.equal(results.filter(r => r.admitted).length, 10); assert.equal(f.rows.size, 1);
  f.controls.now += 300000;
  assert.equal((await Promise.all(Array.from({ length: 30 }, () => f.api.admitAdminLogin()))).filter(r => r.admitted).length, 10);
});
test("parallel property ceiling, independent property budget and consumed denied global attempts", async () => {
  const f = throttleFixture();
  const a = await Promise.all(Array.from({ length: 25 }, () => f.api.admitMaintenanceLogin("AAAA")));
  assert.equal(a.filter(r => r.admitted).length, 10);
  const b = await Promise.all(Array.from({ length: 15 }, () => f.caller().admitMaintenanceLogin("BBBB")));
  assert.equal(b.filter(r => r.admitted).length, 10);
  assert.equal(f.rows.get("maintenance:global")!.attemptCount, 40);
  assert.equal(f.rows.get("maintenance:property:A")!.attemptCount, 10);
  assert.equal(f.rows.get("maintenance:property:B")!.attemptCount, 10);
});
test("unknown rotated property codes share global 100 ceiling without arbitrary rows", async () => {
  const f = throttleFixture();
  const results = await Promise.all(Array.from({ length: 130 }, (_, i) => f.api.admitMaintenanceLogin("unknown-" + i)));
  assert.equal(results.filter(r => r.admitted).length, 100); assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.keys()][0], "maintenance:global"); assert.equal(f.events.filter(e => e === "property").length, 100);
  assert.ok(results.filter(r => !r.admitted).every(r => r.retryAfter > 0));
});
test("global lock precedes property lock and database clock follows each lock", async () => {
  const f = throttleFixture(); await f.api.admitMaintenanceLogin("AAAA");
  const locks = f.events.map((s, i) => s.includes("FOR UPDATE") && !s.includes("SKIP LOCKED") ? i : -1).filter(i => i >= 0);
  assert.equal(locks.length, 2); assert.ok(locks[0] < f.events.indexOf("property")); assert.ok(locks[1] > f.events.indexOf("property"));
  for (const i of locks) assert.ok(f.events[i + 1].includes('clock_timestamp() AS "now"'));
});
test("three bounded full retries roll back increments; fourth failure fails closed", async () => {
  const f = throttleFixture(); f.controls.retries = 3;
  assert.equal((await f.api.admitAdminLogin()).admitted, true); assert.equal(f.rows.get("admin:global")!.attemptCount, 1);
  const g = throttleFixture(); g.controls.retries = 4; await assert.rejects(g.api.admitAdminLogin()); assert.equal(g.rows.size, 0);
});
for (const code of ["P2034", "40001", "40P01", "P2010", "P1001"]) test("persistent database failure fails closed " + code, async () => {
  const f = throttleFixture(); f.controls.error = { code }; await assert.rejects(f.api.admitAdminLogin()); assert.equal(f.rows.size, 0);
});
test("cleanup failure does not undo admission or permit exhausted capacity", async () => {
  const f = throttleFixture(); f.controls.cleanupFails = true;
  for (let i = 0; i < 10; i++) await f.api.admitAdminLogin();
  assert.equal((await f.api.admitAdminLogin()).admitted, false); assert.equal(f.rows.get("admin:global")!.attemptCount, 10);
});
test("bounded expired cleanup preserves active and refreshed rows", async () => {
  const f = throttleFixture();
  for (let i = 0; i < 150; i++) f.rows.set("maintenance:property:old" + i, { attemptCount: 10, windowExpiresAt: new Date(0) });
  f.rows.set("maintenance:property:active", { attemptCount: 10, windowExpiresAt: new Date(f.controls.now + 1) });
  await f.api.admitAdminLogin(); assert.equal(f.rows.size, 52); assert.ok(f.rows.has("maintenance:property:active")); assert.ok(f.rows.has("admin:global"));
});
test("source SQL/storage contract and narrowly scoped exports", () => {
  const source = readFileSync(resolve(root, "lib/authThrottle.ts"), "utf8");
  assert.ok(source.includes("ON CONFLICT")); assert.ok(source.includes("LIMIT 100 FOR UPDATE SKIP LOCKED"));
  assert.ok(source.includes('AND "windowExpiresAt" <= clock_timestamp()'));
  assert.equal((source.match(/export async function/g) ?? []).length, 2);
  assert.ok(!/bcrypt|rateLimit|ipAddress|codeHash|pinHash/.test(source));
  const migration = readFileSync(resolve(root, "prisma/migrations/20261005000000_add_auth_throttle_bucket/migration.sql"), "utf8");
  assert.ok(migration.includes('CHECK ("attemptCount" >= 0)')); assert.ok(!/ALTER|REFERENCES|DROP/.test(migration));
});
