import { isRecord, dateFromArguments } from "./fixture-assertions";
import type { PropertyTierCharge } from "@prisma/client";
type ChargeRow = Pick<PropertyTierCharge, "id" | "propertyId" | "tierId" | "label" | "amountCents" | "effectiveDate" | "effectiveUntil" | "isActive" | "sortOrder" | "createdAt">;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export const root = resolve(__dirname, "..");
export const october = new Date("2026-10-01T05:00:00Z");
export const november = new Date("2026-11-01T05:00:00Z");
type Modules = {
 "app/api/ledger/post-rent/route.ts": { POST(request?: { json(): Promise<unknown> }): Promise<{ status: number; body: unknown }> };
 "lib/rentDates.ts": typeof import("../lib/rentDates");
 "lib/manualFinancialOperations.ts": typeof import("../lib/manualFinancialOperations");
 "jobs/monthlyRent.ts": typeof import("../jobs/monthlyRent");
 "app/api/admin/properties/[id]/charges/route.ts": {
  GET(request: object, context: { params: Promise<{ id: string }> }): Promise<{ status: number; body: unknown }>;
  POST(request: { json(): Promise<unknown> }, context: { params: Promise<{ id: string }> }): Promise<{ status: number; body: unknown }>;
 };
};
export function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>, clock?: new (...args: never[]) => Date): Modules[File];
export function load(file: keyof Modules, imports: Record<string, unknown>, clock: new (...args: never[]) => Date = Date): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date: clock, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  assert.ok(isRecord(fixtureModule.exports)); return fixtureModule.exports;
}
export function matches(row: unknown, where: unknown = {}): boolean {
  assert.ok(isRecord(where));
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") { assert.ok(Array.isArray(value)); return value.some((part: unknown) => matches(row, part)); }
    if (key === "AND") { const parts: unknown[] = Array.isArray(value) ? value : [value]; return parts.every(part => matches(row, part)); }
    if (value === undefined) return true;
    assert.ok(isRecord(row)); const field = row[key];
    if (value === null) return field == null;
    if (value instanceof Date) return field instanceof Date && field.getTime() === value.getTime();
    if (isRecord(value)) return Object.entries(value).every(([op, wanted]) => {
      if (op === "in") { assert.ok(Array.isArray(wanted)); const values: unknown[] = wanted; return values.includes(field); }
      if (op === "not") return field !== wanted;
      const [left, right] = typeof field === "string" && typeof wanted === "string" ? [field, wanted] : [Number(field), Number(wanted)];
      if (op === "lt") return left < right;
      if (op === "lte") return left <= right;
      if (op === "gt") return left > right;
      if (op === "gte") return left >= right;
      throw Error("Unsupported predicate " + op);
    });
    return field === value;
  });
}
export function configurationFixture() {
  const state: { rows: ChargeRow[]; tiers: { id: string; name: string; sortOrder: number; isActive: boolean }[] } = { rows: [{ id: "old", propertyId: "p", tierId: "t", label: "Trash", amountCents: 1000,
    effectiveDate: october, effectiveUntil: null, isActive: true, sortOrder: 0, createdAt: october }],
    tiers: [{ id: "t", name: "Tier", sortOrder: 0, isActive: true }] };
  const controls: { failInsert: boolean; retryFailures: number; attempts: number; now: string; onLock?: () => void } = { failInsert: false, retryFailures: 0, attempts: 0, now: "2026-10-20T12:00:00Z" };
  const events: string[] = [];
  let tail = Promise.resolve();
  let ids = 0;
  class Clock extends Date {
    constructor(value?: string | number | Date, month?: number, day = 1, hour = 0, minute = 0, second = 0, ms = 0) {
      if (value === undefined) super(controls.now);
      else if (month === undefined) super(dateFromArguments([value]));
      else super(Number(value), month, day, hour, minute, second, ms);
    }
    static now() { return new Date(controls.now).getTime(); }
  }
  const calendar = load("lib/rentDates.ts", {}, Clock);
  const model = (getRows: () => ChargeRow[], transaction = false) => ({
    findMany: async ({ where }: { where: unknown }) => { events.push("charges:read"); return getRows().filter(r => matches(r, where)); },
    updateMany: async ({ where, data }: { where: unknown; data: Partial<ChargeRow> }) => { assert.ok(transaction); events.push("charges:update");
      const rows = getRows().filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, data)); return { count: rows.length }; },
    create: async ({ data }: { data: Omit<ChargeRow, "id" | "createdAt" | "effectiveUntil"> & Partial<Pick<ChargeRow, "id" | "createdAt" | "effectiveUntil">> }) => { assert.ok(transaction); events.push("charges:insert");
      if (controls.failInsert) throw Error("isolated insert failure");
      const row = { id: "new-" + (++ids), createdAt: new Date(controls.now), effectiveUntil: null, ...data };
      getRows().push(row); return row; },
  });
  const property = { findUnique: async () => { events.push("property:read");
    return { id: "p", name: "Property", tiers: state.tiers.filter((t) => t.isActive) }; } };
  type Transaction = { property: typeof property; propertyTierCharge: ReturnType<typeof model>; $queryRaw(sql: TemplateStringsArray): Promise<{ id: string }[]> };
  const db = { property, propertyTierCharge: model(() => state.rows),
    $transaction: async <Result>(fn: (tx: Transaction) => Promise<Result>): Promise<Result> => {
      controls.attempts++;
      let release: (() => void) | undefined;
      let working: ChargeRow[] | undefined;
      const tx = { property, propertyTierCharge: model(() => { assert.ok(working, "read/write before Property lock"); return working!; }, true),
        $queryRaw: async (sql: TemplateStringsArray) => {
          assert.match(sql.join("?"), /FROM "Property"[\s\S]*FOR UPDATE/);
          events.push("property:lock");
          const previous = tail; tail = new Promise<void>(r => { release = r; }); await previous;
          working = structuredClone(state.rows); controls.onLock?.(); return [{ id: "p" }];
        } };
      try { const result = await fn(tx); if (controls.retryFailures > 0) { controls.retryFailures--; throw Object.assign(Error("retry"), { code: "P2034" }); }
        assert.ok(working, "transaction completed without the required Property lock"); state.rows = working; return result;
      } finally { release?.(); }
    } };
  const imports = { "@/lib/prisma": { prisma: db }, "@/lib/rentDates": calendar,
    "@prisma/client": { Prisma: {} }, "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "p" }) },
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } } };
  const route = load("app/api/admin/properties/[id]/charges/route.ts", imports, Clock);
  const context = { params: Promise.resolve({ id: "p" }) };
  const save = async (charges: unknown[] = [], body?: unknown) => {
    const result = await route.POST({ json: async () => body ?? { tiers: [{ tierId: "t", charges }] } }, context);
    assert.ok(isRecord(result.body)); return { ...result, body: result.body };
  };
  const get = async () => {
    const result = await route.GET({}, context); const body = result.body; assert.ok(isRecord(body)); assert.ok(Array.isArray(body.tiers));
    const tiers = body.tiers.map((tier: unknown) => { assert.ok(isRecord(tier)); assert.ok(Array.isArray(tier.charges));
      const charges = tier.charges.map((charge: unknown) => { assert.ok(isRecord(charge)); assert.ok(typeof charge.amount === "number"); return { ...charge, amount: charge.amount }; });
      return { ...tier, charges };
    });
    return { ...result, body: { ...body, tiers } };
  };
  const applicable = (due: Date) => state.rows.filter((r) => r.isActive && r.effectiveDate <= due && (!r.effectiveUntil || due < r.effectiveUntil));
  return { state, controls, events, save, get, applicable, imports, route, context };
}
