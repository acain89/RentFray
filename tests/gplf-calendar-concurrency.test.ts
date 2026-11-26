import { requiredValue, checkedHttpNamespace, type MockReply } from "./fixture-assertions";
import type { PropertyTier } from "@prisma/client";
import * as gracePolicy from "../lib/gracePeriod";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(__dirname, "..");
const routePath = "app/api/admin/properties/[id]/gplf/route.ts";
type Modules = {
 "lib/billingCalendar.ts": typeof import("../lib/billingCalendar");
 "app/api/admin/properties/[id]/gplf/route.ts": { POST(request: { json(): Promise<unknown> }, context: { params: Promise<{ id: string }> }): Promise<MockReply> };
};
function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>): Modules[File];
function load(file: keyof Modules, imports: Record<string, unknown>): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const text = readFileSync(resolve(root, file), "utf8");
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, console: { error() {} }, require(name: string) { if (name === "@/lib/gracePeriod") return gracePolicy;
    assert.ok(name in imports, "Unexpected dependency " + name); return imports[name];
  } }); return file.startsWith("app/api/") ? checkedHttpNamespace(fixtureModule.exports) : fixtureModule.exports;
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  type Tier = Partial<PropertyTier> & { id: string; propertyId: string; rentDueDay: number };
  type Property = { rentFrayStartDate: Date | null; settings: { rentDueDay: number }; tiers: Tier[] };
  const state: { p: Property; other: Property } = { p: { rentFrayStartDate: null, settings: { rentDueDay: 1 }, tiers: [
    { id: "t1", propertyId: "p", rentDueDay: 1 }, { id: "t2", propertyId: "p", rentDueDay: 1 } ] },
    other: { rentFrayStartDate: null, settings: { rentDueDay: 1 }, tiers: [] } };
  const readProperty = (id: string): Property | undefined => id === "p" ? state.p : id === "other" ? state.other : undefined;
  const events: string[] = []; const tails = new Map<string, Promise<void>>();
  const controls = { role: "MANAGER", sessionProperty: "p", missingSession: false, failWrite: 0,
    beforeLock: undefined as undefined | (() => Promise<void>), afterLock: undefined as undefined | (() => Promise<void>) };
  async function acquire(key: string) {
    const previous = tails.get(key) ?? Promise.resolve(); const gate = deferred();
    tails.set(key, previous.then(() => gate.promise)); await previous; return gate.resolve;
  }
  type Transaction = {
    $queryRaw(sql: TemplateStringsArray, propertyId: string): Promise<{ id: string }[]>;
    property: { findUnique(): Promise<Property | null | undefined> };
    propertyTier: { findMany(args: { where: { propertyId: string; id: { in: string[] } } }): Promise<Tier[]>; update(args: { where: { id: string; propertyId: string }; data: Partial<Tier> }): Promise<Tier> };
    propertySettings: { upsert(args: { update: { rentDueDay?: number } }): Promise<void> };
  };
  const db = {
    property: { findUnique: async ({ where }: { where: { id: string } }) => { events.push("pre:read"); const value = readProperty(where.id);
      return value ? { rentFrayStartDate: value.rentFrayStartDate, settings: { ...value.settings } } : null; } },
    $transaction: async <Result>(work: (tx: Transaction) => Promise<Result>): Promise<Result> => {
      let release: (() => void) | undefined; let key = ""; let staged: Property | null | undefined; let writes = 0;
      const tx = {
        $queryRaw: async (sql: TemplateStringsArray, propertyId: string) => {
          assert.match(sql.join("?"), /SELECT "id" FROM "Property" WHERE "id" = \? FOR UPDATE/);
          await controls.beforeLock?.(); key = propertyId; release = await acquire(key); events.push("gplf:lock:" + key);
          staged = readProperty(key) ? structuredClone(readProperty(key)) : null; await controls.afterLock?.(); return staged ? [{ id: key }] : [];
        },
        property: { findUnique: async () => { assert.ok(release); events.push("locked:read"); return staged; } },
        propertyTier: {
          findMany: async ({ where }: { where: { propertyId: string; id: { in: string[] } } }) => { assert.ok(release); events.push("tiers:read");
            return requiredValue(staged).tiers.filter((tier) => tier.propertyId === where.propertyId && where.id.in.includes(tier.id)); },
          update: async ({ where, data }: { where: { id: string; propertyId: string }; data: Partial<Tier> }) => { assert.ok(release); events.push("tier:write"); writes++;
            if (writes === controls.failWrite) throw Error("write failure");
            const tier = requiredValue(staged).tiers.find((tier) => tier.id === where.id && tier.propertyId === where.propertyId); assert.ok(tier);
            Object.assign(tier, data); return tier; },
        },
        propertySettings: { upsert: async ({ update }: { update: { rentDueDay?: number } }) => { assert.ok(release); events.push("settings:write"); Object.assign(requiredValue(staged).settings, update); } },
      };
      try { const result = await work(tx); if (staged) { assert.ok(key === "p" || key === "other"); state[key] = staged; } events.push("gplf:commit"); return result; }
      catch (error) { events.push("gplf:rollback"); throw error; } finally { release?.(); }
    },
  };
  const calendar = load("lib/billingCalendar.ts", { "@prisma/client": {}, "@/lib/prisma": { prisma: {} }, "@/lib/rentDates": {} });
  const route = load(routePath, { "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } },
    "@prisma/client": {}, "@/lib/prisma": { prisma: db }, "@/lib/session": { getSession: async () => controls.missingSession ? null : { role: controls.role, propertyId: controls.sessionProperty } },
    "@/lib/billingCalendar": { getLockedMonthlyDueDay: calendar.getLockedMonthlyDueDay } });
  const input = (id: string, enabled = true) => ({ id, dueDay: "1", graceDays: "7", lateFeeEnabled: enabled,
    lateFeeAmount: "25", lateFeeDaily: "2", lateFeeMaxDays: "10" });
  async function calendarLock(propertyId = "p") {
    events.push("calendar:waiting:" + propertyId); const release = await acquire(propertyId);
    try { events.push("calendar:lock:" + propertyId); const current = requiredValue(readProperty(propertyId)); current.rentFrayStartDate = new Date("2026-10-15T00:00:00Z");
      current.settings.rentDueDay = 15; for (const tier of current.tiers) tier.rentDueDay = 15; events.push("calendar:commit"); }
    finally { release(); }
  }
  return { state, events, controls, input, calendarLock,
    save: (tiers: unknown[] = [input("t1"), input("t2")]) => route.POST({ json: async () => ({ tiers }) }, { params: Promise.resolve({ id: "p" }) }) };
}

test("ISOLATED MODEL: calendar commits after old read, GPLF rereads due day 15 after lock", async () => {
  const f = fixture(); f.controls.beforeLock = () => f.calendarLock();
  const result = await f.save(); assert.equal(result.status, 200); assert.deepEqual(JSON.parse(JSON.stringify(result.body)), { ok: true });
  assert.equal(f.events[0], "pre:read"); assert.ok(f.events.indexOf("calendar:commit") < f.events.indexOf("locked:read"));
  for (const tier of f.state.p.tiers) { assert.equal(tier.rentDueDay, 15); assert.equal(tier.gracePeriodDays, 7);
    assert.equal(tier.lateFeeInitialCents, 2500); assert.equal(tier.lateFeeDailyCents, 200); assert.equal(tier.maxLateFeeDays, 10); assert.equal(tier.lateFeeType, "FLAT"); }
});

test("ISOLATED MODEL: legacy grace is compared after acquiring the property lock", async () => {
  const f = fixture(); f.state.p.tiers[0].gracePeriodDays = 55;
  f.controls.beforeLock = async () => { f.state.p.tiers[0].gracePeriodDays = 31; };
  const response = await f.save([{ ...f.input("t1"), graceDays: "55" }]);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, gracePolicy.GRACE_PERIOD_MESSAGE);
  assert.equal(f.state.p.tiers[0].gracePeriodDays, 31);
});
test("ISOLATED MODEL: GPLF first makes calendar wait; calendar then leaves every due day consistent", async () => {
  const f = fixture(); const entered = deferred(); const resume = deferred();
  f.controls.afterLock = async () => { entered.resolve(); await resume.promise; };
  const saving = f.save(); await entered.promise; const locking = f.calendarLock(); await Promise.resolve();
  assert.ok(!f.events.includes("calendar:lock:p")); resume.resolve(); assert.equal((await saving).status, 200); await locking;
  assert.ok(f.events.indexOf("gplf:commit") < f.events.indexOf("calendar:lock:p"));
  assert.equal(f.state.p.settings.rentDueDay, 15); assert.ok(f.state.p.tiers.every((tier) => tier.rentDueDay === 15 && tier.gracePeriodDays === 7));
});
test("ISOLATED MODEL: different Property rows do not share a global lock", async () => {
  const f = fixture(); const entered = deferred(); const resume = deferred();
  f.controls.afterLock = async () => { entered.resolve(); await resume.promise; };
  const saving = f.save(); await entered.promise; await f.calendarLock("other");
  assert.ok(f.events.includes("calendar:commit")); resume.resolve(); await saving;
});
test("scope changes before locking reject all requested tiers with existing 403", async () => {
  const f = fixture(); f.controls.beforeLock = async () => { f.state.p.tiers[1].propertyId = "foreign"; };
  const result = await f.save(); assert.equal(result.status, 403); assert.equal(result.body.error, "Forbidden");
  assert.ok(!f.events.includes("tier:write")); assert.ok(!f.events.includes("settings:write"));
});
test("second tier failure rolls back first tier and onboarding writes", async () => {
  const f = fixture(); const before = structuredClone(f.state.p); f.controls.failWrite = 2;
  assert.equal((await f.save()).status, 500); assert.deepEqual(f.state.p, before); assert.ok(f.events.includes("gplf:rollback"));
});
for (const dueDay of [1, 15, 28]) test("unlocked settings due day preserved: " + dueDay, async () => {
  const f = fixture(); f.state.p.settings.rentDueDay = dueDay; await f.save(); assert.ok(f.state.p.tiers.every((tier) => tier.rentDueDay === dueDay));
  assert.equal(f.state.p.rentFrayStartDate, null);
});
test("disabled late fees and numeric conversion remain unchanged", async () => {
  const f = fixture(); await f.save([f.input("t1", false)]); const tier = f.state.p.tiers[0];
  assert.equal(tier.gracePeriodDays, 7); assert.equal(tier.lateFeeInitialCents, 0); assert.equal(tier.lateFeeDailyCents, 0); assert.equal(tier.maxLateFeeDays, 0);
});
for (const role of ["OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test("role policy unchanged: " + role, async () => {
  const f = fixture(); f.controls.role = role; const result = await f.save(); assert.equal(result.status, ["OWNER", "MANAGER"].includes(role) ? 200 : 403);
});
test("missing session and wrong property are rejected before DB access", async () => {
  const f = fixture(); f.controls.missingSession = true; assert.equal((await f.save()).status, 401); assert.equal(f.events.length, 0);
  f.controls.missingSession = false; f.controls.sessionProperty = "other"; assert.equal((await f.save()).status, 403); assert.equal(f.events.length, 0);
});
test("invalid payload and foreign tier retain 400/403 without writes", async () => {
  const f = fixture(); assert.equal((await f.save([])).status, 400); assert.equal((await f.save([f.input("")])).status, 400);
  assert.equal((await f.save([f.input("foreign")])).status, 403); assert.ok(!f.events.includes("tier:write"));
});
test("deleted Property retains 404 before or after serialization", async () => {
  const f = fixture(); Reflect.deleteProperty(f.state, "p"); assert.equal((await f.save()).status, 404);
  const g = fixture(); g.controls.beforeLock = async () => { Reflect.deleteProperty(g.state, "p"); }; assert.equal((await g.save()).status, 404);
});
test("GPLF shares Property row serialization with calendar and tiers; no financial writes", () => {
  const gplf = readFileSync(resolve(root, routePath), "utf8");
  for (const file of ["lib/billingCalendar.ts", "app/api/admin/properties/[id]/tiers/route.ts"]) {
    const source = readFileSync(resolve(root, file), "utf8"); assert.match(source, /FROM "Property"[\s\S]*?FOR UPDATE/);
  }
  const protectedSource = gplf.slice(gplf.indexOf("const updated = await prisma.$transaction"));
  assert.ok(protectedSource.indexOf("FOR UPDATE") < protectedSource.indexOf("tx.property.findUnique"));
  assert.ok(protectedSource.indexOf("tx.property.findUnique") < protectedSource.indexOf("getLockedMonthlyDueDay"));
  assert.ok(protectedSource.indexOf("getLockedMonthlyDueDay") < protectedSource.indexOf("tx.propertyTier.findMany"));
  assert.ok(protectedSource.indexOf("tx.propertyTier.findMany") < protectedSource.indexOf("tx.propertyTier.update"));
  assert.doesNotMatch(gplf, /prisma\.(ledgerEntry|payment|propertyTierCharge)|tx\.(ledgerEntry|payment|propertyTierCharge)/);
  assert.equal((gplf.match(/getLockedMonthlyDueDay\(/g) ?? []).length, 1);
});
