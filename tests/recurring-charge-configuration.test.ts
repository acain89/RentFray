import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export const october = new Date("2026-10-01T05:00:00Z");
export const november = new Date("2026-11-01T05:00:00Z");
export function load(file: string, imports: Record<string, any>, clock: any = Date) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date: clock, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  return module.exports;
}
export function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: any) => {
    if (key === "OR") return value.some((v: any) => matches(row, v));
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((v: any) => matches(row, v));
    if (value === undefined) return true;
    if (value === null) return row[key] == null;
    if (value instanceof Date) return row[key]?.getTime() === value.getTime();
    if (typeof value === "object") return Object.entries(value).every(([op, v]: any) => {
      if (op === "in") return v.includes(row[key]);
      if (op === "lt") return row[key] < v;
      if (op === "lte") return row[key] <= v;
      if (op === "gt") return row[key] > v;
      if (op === "gte") return row[key] >= v;
      if (op === "not") return row[key] !== v;
      throw Error("Unsupported predicate " + op);
    });
    return row[key] === value;
  });
}
export function configurationFixture() {
  const state: any = { rows: [{ id: "old", propertyId: "p", tierId: "t", label: "Trash", amountCents: 1000,
    effectiveDate: october, effectiveUntil: null, isActive: true, sortOrder: 0, createdAt: october }],
    tiers: [{ id: "t", name: "Tier", sortOrder: 0, isActive: true }] };
  const controls: any = { failInsert: false, retryFailures: 0, attempts: 0, now: "2026-10-20T12:00:00Z" };
  const events: string[] = [];
  let tail = Promise.resolve();
  let ids = 0;
  class Clock extends Date {
    constructor(value?: any, month?: number, day = 1, hour = 0, minute = 0, second = 0, ms = 0) {
      if (value === undefined) super(controls.now);
      else if (month === undefined) super(value);
      else super(value, month, day, hour, minute, second, ms);
    }
    static now() { return new Date(controls.now).getTime(); }
  }
  const calendar = load("lib/rentDates.ts", {}, Clock);
  const model = (getRows: () => any[], transaction = false) => ({
    findMany: async ({ where }: any) => { events.push("charges:read"); return getRows().filter(r => matches(r, where)); },
    updateMany: async ({ where, data }: any) => { assert.ok(transaction); events.push("charges:update");
      const rows = getRows().filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, data)); return { count: rows.length }; },
    create: async ({ data }: any) => { assert.ok(transaction); events.push("charges:insert");
      if (controls.failInsert) throw Error("isolated insert failure");
      const row = { id: "new-" + (++ids), createdAt: new Date(controls.now), effectiveUntil: null, ...data };
      getRows().push(row); return row; },
  });
  const property = { findUnique: async () => { events.push("property:read");
    return { id: "p", name: "Property", tiers: state.tiers.filter((t: any) => t.isActive) }; } };
  const db: any = { property, propertyTierCharge: model(() => state.rows),
    $transaction: async (fn: any) => {
      controls.attempts++;
      let release: (() => void) | undefined;
      let working: any[] | undefined;
      const tx = { property, propertyTierCharge: model(() => { assert.ok(working, "read/write before Property lock"); return working!; }, true),
        $queryRaw: async (sql: any) => {
          assert.match(sql.join("?"), /FROM "Property"[\s\S]*FOR UPDATE/);
          events.push("property:lock");
          const previous = tail; tail = new Promise<void>(r => { release = r; }); await previous;
          working = structuredClone(state.rows); controls.onLock?.(); return [{ id: "p" }];
        } };
      try { const result = await fn(tx); if (controls.retryFailures > 0) { controls.retryFailures--; throw Object.assign(Error("retry"), { code: "P2034" }); }
        state.rows = working; return result;
      } finally { release?.(); }
    } };
  const imports = { "@/lib/prisma": { prisma: db }, "@/lib/rentDates": calendar,
    "@prisma/client": { Prisma: {} }, "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "p" }) },
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } } };
  const route = load("app/api/admin/properties/[id]/charges/route.ts", imports, Clock);
  const context = { params: Promise.resolve({ id: "p" }) };
  const save = (charges: any[] = [], body?: any) => route.POST({ json: async () => body ?? { tiers: [{ tierId: "t", charges }] } }, context);
  const get = () => route.GET({}, context);
  const applicable = (due: Date) => state.rows.filter((r: any) => r.isActive && r.effectiveDate <= due && (!r.effectiveUntil || due < r.effectiveUntil));
  return { state, controls, events, save, get, applicable, imports, route, context };
}

test("replacement preserves October and presents only November", async () => {
  const f = configurationFixture(); assert.equal((await f.save([{ label: "Trash", amount: 20 }])).status, 200);
  assert.equal(f.state.rows[0].effectiveUntil.getTime(), november.getTime());
  assert.deepEqual(f.applicable(october).map((r: any) => r.amountCents), [1000]);
  assert.deepEqual(f.applicable(november).map((r: any) => r.amountCents), [2000]);
  assert.deepEqual((await f.get()).body.tiers[0].charges.map((r: any) => r.amount), [20]);
});
test("empty replacement closes old set without fake rows or GET fallback", async () => {
  const f = configurationFixture(); assert.equal((await f.save()).status, 200);
  assert.equal(f.state.rows.length, 1); assert.equal(f.applicable(october).length, 1); assert.equal(f.applicable(november).length, 0);
  assert.equal((await f.get()).body.tiers[0].charges.length, 0);
});
test("pending replacement, repeated save and same-label legitimate items", async () => {
  const f = configurationFixture(); await f.save([{ label: "Trash", amount: 20 }]);
  const pending = f.state.rows[1].id;
  for (let i = 0; i < 2; i++) await f.save([{ label: "Trash", amount: 25 }, { label: "Trash", amount: 5 }]);
  assert.equal(f.state.rows.find((r: any) => r.id === pending).isActive, false);
  assert.deepEqual(f.applicable(november).map((r: any) => r.amountCents), [2500, 500]);
  assert.equal(f.applicable(october)[0].amountCents, 1000);
});
for (const body of [{}, { tiers: null }, { tiers: [] }, { tiers: [null] }, { tiers: [{ tierId: "foreign", charges: [] }] },
  { tiers: [{ tierId: "t" }] }, { tiers: [{ tierId: "t", charges: [] }, { tierId: "t", charges: [] }] },
  { tiers: [{ tierId: "t", charges: [null] }] }, { tiers: [{ tierId: "t", charges: [{ label: "Bad", amount: -1 }] }] }])
  test("malformed/foreign snapshot rejected: " + JSON.stringify(body), async () => {
    const f = configurationFixture(); const before = structuredClone(f.state.rows); const result = await f.save([], body);
    assert.ok(result.status >= 400 && result.status < 500); assert.deepEqual(f.state.rows, before);
  });
test("UI blank draft is an explicit empty tier and Chicago boundary ignores UTC month rollover", async () => {
  const f = configurationFixture(); f.controls.now = "2026-11-01T01:00:00Z";
  const r = await f.save([{ label: "", amount: "" }]); assert.equal(r.status, 200);
  assert.equal(new Date(r.body.effectiveDate).getTime(), november.getTime());
  assert.equal(f.applicable(november).length, 0);
});
test("missing tier blocks cannot erase another active tier", async () => {
  const f = configurationFixture(); f.state.tiers.push({ id: "second", name: "Second", sortOrder: 1, isActive: true });
  assert.equal((await f.save()).status, 400); assert.equal(f.state.rows[0].effectiveUntil, null);
});
test("explicit empty snapshot is permitted when no active tiers exist", async () => {
  const f = configurationFixture(); f.state.tiers = [];
  assert.equal((await f.save([], { tiers: [] })).status, 200);
});
