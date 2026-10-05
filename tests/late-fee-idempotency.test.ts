import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./manual-payment-idempotency.test";

export function match(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((part: any) => match(row, part));
    if (key === "AND") return value.every((part: any) => match(row, part));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(row[key]);
      if ("startsWith" in value) return typeof row[key] === "string" && row[key].startsWith(value.startsWith);
      if ("lte" in value) return row[key] <= value.lte;
      return match(row[key] ?? {}, value);
    }
    return row[key] === value;
  });
}
export function lateFixture() {
  const events: string[] = [];
  const controls: any = { onLock: null, snapshotBarrier: null, fault: null, financialHook: null };
  const property: any = { id: "p", settings: { rentDueDay: 1, gracePeriodDays: 2, lateFeeEnabled: true },
    rentFrayStartDate: new Date("2026-01-01T00:00:00Z") };
  const tiers: any[] = [{ id: "tier", propertyId: "p", rentDueDay: 1, gracePeriodDays: 2,
    lateFeeInitialCents: 500, lateFeeDailyCents: 100, maxLateFeeDays: 3 }];
  const state: any = { units: [{ id: "u", propertyId: "p", unitNumber: "1", tierId: "tier", isActive: true }],
    assignments: [{ id: "a", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, moveInDate: null }],
    ledger: [], payments: [], audits: [] };
  let inTransaction = false, tail = Promise.resolve(), attempts = 0, sequence = 0;
  const expand = (unit: any) => ({ ...unit, tier: structuredClone(tiers.find(t => t.id === unit.tierId) ?? null),
    property: structuredClone(property), tenantAssignments: state.assignments.filter((a: any) =>
      a.unitId === unit.id && a.isCurrent && a.moveOutDate === null).slice(0, 1).map((a: any) => ({ id: a.id })) });
  const prisma: any = {
    unit: {
      findMany: async ({ where }: any) => { const selected = state.units.filter((u: any) => match(u, where)).map(expand);
        events.push("candidate.read"); if (controls.snapshotBarrier) await controls.snapshotBarrier(); return selected; },
      findFirst: async ({ where }: any) => { events.push("unit.read"); const unit = state.units.find((u: any) => match(u, where)); return unit ? expand(unit) : null; },
    },
    tenantAssignment: { findFirst: async ({ where }: any) => { assert.ok(inTransaction); events.push("assignment.read"); return state.assignments.find((a: any) => match(a, where)) ?? null; } },
    $executeRaw: async (strings: any, ...values: any[]) => { assert.ok(inTransaction); events.push("advisory:" + values.join(":")); return 1; },
    $queryRaw: async (strings: any, ...values: any[]) => { assert.ok(inTransaction); const sql = strings.join("?");
      assert.ok(sql.includes("NOWAIT")); events.push(sql); if (controls.onLock) await controls.onLock(sql, values); return []; },
    $transaction: async (fn: any, options: any) => {
      const previous = tail; let release: any; tail = new Promise<void>(r => release = r); await previous;
      assert.equal(options.isolationLevel, "ReadCommitted"); assert.equal(options.timeout, 20000);
      const saved = structuredClone(state); inTransaction = true; attempts++; events.push("begin");
      try { return await fn(prisma); }
      catch (error) { Object.assign(state, saved); events.push("rollback"); throw error; }
      finally { inTransaction = false; release(); }
    },
    ledgerEntry: {
      findMany: async ({ where }: any) => {
        const history = where.OR?.some((part: any) => part.chargeType || part.idempotencyKey);
        if (history) { assert.ok(inTransaction); assert.ok(events.some(e => e.includes('FROM "Property"'))); events.push("history.read"); }
        else { events.push("financial.read"); if (controls.financialHook) controls.financialHook(inTransaction); }
        return state.ledger.filter((r: any) => match(r, where)).map((r: any) => ({ ...r,
          payment: r.paymentId ? state.payments.find((p: any) => p.id === r.paymentId) ?? null : null }));
      },
      createMany: async (args: any) => {
        assert.ok(inTransaction); assert.equal(args.skipDuplicates, undefined); assert.ok(events.includes("history.read")); events.push("batch.insert");
        for (let index = 0; index < args.data.length; index++) {
          const data = args.data[index];
          if (state.ledger.some((r: any) => r.idempotencyKey && r.idempotencyKey === data.idempotencyKey)) throw { code: "P2002" };
          state.ledger.push({ id: "fee" + (++sequence), createdAt: new Date("2026-10-06"), voidedAt: null, ...data });
          if (controls.fault) await controls.fault(index, args.data);
        }
        return { count: args.data.length };
      },
    },
    payment: { findMany: async ({ where }: any) => state.payments.filter((p: any) => match(p, where)) },
    auditLog: {
      findMany: async ({ where }: any) => { assert.ok(inTransaction); return state.audits.filter((a: any) => match(a, where)); },
      count: async ({ where }: any) => state.audits.filter((a: any) => match(a, where)).length,
    },
  };
  const dates = load("lib/rentDates.ts", {});
  const calendar = load("lib/billingCalendar.ts", { "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma }, "@/lib/rentDates": dates });
  const ledger = load("lib/ledger.ts", { "@/lib/prisma": { prisma } });
  const financial = load("lib/unitFinancialState.ts", {
    "@/lib/billingConfig": load("lib/billingConfig.ts", {}), "@/lib/ledger": ledger,
    "@/lib/rentDates": dates, "@/lib/unitStatusEngine": load("lib/unitStatusEngine.ts", {}), "@/lib/billingCalendar": calendar,
  });
  const imports = { "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma },
    "@/lib/billingCalendar": calendar, "@/lib/rentDates": dates, "@/lib/unitFinancialState": financial,
    "@/lib/manualFinancialOperations": load("lib/manualFinancialOperations.ts", {}) };
  const job = () => load("jobs/lateFees.ts", imports).runLateFeesJob;
  const run = (asOf = new Date("2026-10-06T17:00:00Z")) => job()(asOf, "p");
  const add = (extra: any = {}) => { const row = { id: "history" + (++sequence), propertyId: "p", unitId: "u",
    tenantAssignmentId: "a", billingCycle: "2026-10", entryType: "CHARGE", chargeType: "LATE_FEE_INITIAL",
    amountCents: 500, effectiveDate: dates.getBusinessDateInstant("2026-10-03"), createdAt: new Date("2026-10-03"),
    idempotencyKey: null, memo: null, voidedAt: null, ...extra }; state.ledger.push(row); return row; };
  add({ id: "rent", chargeType: "RENT", amountCents: 10000, effectiveDate: dates.getBusinessDateInstant("2026-10-01") });
  const fees = () => state.ledger.filter((r: any) => r.chargeType?.startsWith("LATE_FEE"));
  const manualAudit = (row: any, extra: any = {}) => { const audit = { propertyId: row.propertyId,
    actorType: "MANAGER", action: "MANUAL_CHARGE_POSTED", targetType: "LEDGER_ENTRY", targetId: row.id,
    metadataJson: JSON.stringify({ unitId: row.unitId, tenantAssignmentId: row.tenantAssignmentId,
      entryType: row.entryType, chargeType: row.chargeType, amountCents: row.amountCents, effectiveDate: row.effectiveDate.toISOString() }), ...extra };
    state.audits.push(audit); return audit; };
  return { state, controls, events, property, tiers, prisma, dates, imports, run, job, add, fees, manualAudit, attempts: () => attempts };
}

test("initial and daily keys, cents and committed counters; sequential/lost-response replay", async () => {
  const f = lateFixture(); const first = await f.run(); assert.equal(first.posted, 4); assert.equal(first.failedUnits, 0);
  assert.deepEqual(f.fees().map((r: any) => r.idempotencyKey), ["LATE_FEE_INITIAL:a:2026-10",
    "LATE_FEE_DAILY:a:2026-10:2026-10-04", "LATE_FEE_DAILY:a:2026-10:2026-10-05", "LATE_FEE_DAILY:a:2026-10:2026-10-06"]);
  assert.deepEqual(f.fees().map((r: any) => r.amountCents), [500, 100, 100, 100]);
  for (let i = 0; i < 2; i++) { const replay = await f.run(); assert.equal(replay.posted, 0); assert.equal(replay.skipped, 1); }
  assert.equal(f.fees().length, 4);
});
for (const keyed of [false, true]) for (const voided of [false, true]) test("initial historical identity keyed=" + keyed + " voided=" + voided, async () => {
  const f = lateFixture(); const row = f.add({ idempotencyKey: keyed ? "LATE_FEE_INITIAL:a:2026-10" : null, voidedAt: voided ? new Date() : null });
  const saved = JSON.stringify(row); assert.equal((await f.run()).posted, 3); assert.equal(JSON.stringify(row), saved);
  assert.equal(f.fees().filter((r: any) => r.chargeType === "LATE_FEE_INITIAL").length, 1);
});
test("proven canonical legacy automatic LATE_FEE consumes initial identity", async () => {
  const f = lateFixture(); f.add({ chargeType: "LATE_FEE", idempotencyKey: "LATE_FEE_INITIAL:a:2026-10", voidedAt: new Date() });
  assert.equal((await f.run()).posted, 3); assert.equal(f.fees().filter((r: any) => r.chargeType === "LATE_FEE_INITIAL").length, 0);
});
for (const voided of [false, true]) test("proven manual legacy fee is separate including deleted creator, voided=" + voided, async () => {
  const f = lateFixture(); const row = f.add({ chargeType: "LATE_FEE", createdByManagementUserId: null, voidedAt: voided ? new Date() : null });
  f.manualAudit(row); assert.equal((await f.run()).posted, 4); assert.equal(row.idempotencyKey, null); assert.equal(f.state.audits.length, 1);
});
for (const change of [{}, { createdByManagementUserId: "m" }, { memo: "Initial late fee - 2026-10" }, { voidedAt: new Date() }]) test("ambiguous legacy origin fails closed " + JSON.stringify(change), async () => {
  const f = lateFixture(); f.add({ chargeType: "LATE_FEE", ...change }); const saved = JSON.stringify(f.state.ledger);
  const result = await f.run(); assert.equal(result.posted, 0); assert.equal(result.failedUnits, 1); assert.equal(JSON.stringify(f.state.ledger), saved);
});
for (const change of [{ propertyId: "foreign" }, { targetType: "OTHER" }, { actorType: "SYSTEM" }, { metadataJson: "invalid" },
  { metadataJson: JSON.stringify({ unitId: "other" }) }]) test("contradictory manual audit fails closed " + JSON.stringify(change), async () => {
  const f = lateFixture(); const row = f.add({ chargeType: "LATE_FEE" }); f.manualAudit(row, change);
  assert.equal((await f.run()).failedUnits, 1); assert.equal(f.fees().length, 1);
});
test("duplicate provenance and automatic-key/manual-audit contradiction fail closed", async () => {
  for (const keyed of [false, true]) { const f = lateFixture(); const row = f.add({ chargeType: "LATE_FEE", idempotencyKey: keyed ? "LATE_FEE_INITIAL:a:2026-10" : null });
    f.manualAudit(row); if (!keyed) f.manualAudit(row); assert.equal((await f.run()).failedUnits, 1); }
});
for (const change of [{ propertyId: "foreign" }, { unitId: "foreign" }, { tenantAssignmentId: "foreign" }, { billingCycle: "2026-09" }, { entryType: "CREDIT" }, { chargeType: "RENT" }]) test("key with incompatible scope fails closed " + JSON.stringify(change), async () => {
  const f = lateFixture(); f.add({ idempotencyKey: "LATE_FEE_INITIAL:a:2026-10", ...change }); assert.equal((await f.run()).failedUnits, 1);
});
for (const keyed of [false, true]) for (const voided of [false, true]) test("daily history keyed=" + keyed + " voided=" + voided, async () => {
  const f = lateFixture(); const row = f.add({ chargeType: "LATE_FEE_DAILY", effectiveDate: f.dates.getBusinessDateInstant("2026-10-04"),
    idempotencyKey: keyed ? "LATE_FEE_DAILY:a:2026-10:2026-10-04" : null, voidedAt: voided ? new Date() : null, memo: "malformed/edited" });
  const saved = JSON.stringify(row); assert.equal((await f.run()).posted, 3); assert.equal(JSON.stringify(row), saved);
  assert.equal(f.fees().filter((r: any) => r.effectiveDate.getTime() === row.effectiveDate.getTime()).length, 1);
});
for (const change of [{ memo: "Daily late fee - 2026-10-05" }, { effectiveDate: new Date("2026-10-04T00:00:00Z") },
  { idempotencyKey: "LATE_FEE_DAILY:a:2026-10:2026-10-05" }]) test("conflicting daily evidence fails closed " + JSON.stringify(change), async () => {
  const f = lateFixture(); f.add({ chargeType: "LATE_FEE_DAILY", effectiveDate: f.dates.getBusinessDateInstant("2026-10-04"), ...change });
  assert.equal((await f.run()).failedUnits, 1); assert.equal(f.fees().length, 1);
});
test("same Unit/cycle independent legitimate assignment", async () => {
  const f = lateFixture(); await f.run(); f.state.assignments[0].isCurrent = false;
  f.state.assignments.push({ id: "b", unitId: "u", propertyId: "p", isCurrent: true, moveOutDate: null });
  f.add({ tenantAssignmentId: "b", chargeType: "RENT", amountCents: 10000 });
  assert.equal((await f.run()).posted, 4); assert.equal(f.fees().filter((r: any) => r.tenantAssignmentId === "a").length, 4);
  assert.equal(f.fees().filter((r: any) => r.tenantAssignmentId === "b").length, 4);
});
test("different cycle and eligible dates stay independent", async () => {
  const f = lateFixture(); assert.equal((await f.run(new Date("2026-10-04T17:00:00Z"))).posted, 2);
  assert.equal((await f.run(new Date("2026-10-05T17:00:00Z"))).posted, 1);
  assert.equal((await f.run(new Date("2026-11-06T17:00:00Z"))).posted, 4);
});
for (const status of ["PENDING", "PAID", "FAILED", "REVERSED", "UNPAID"]) test("real financial SSOT suppression " + status, async () => {
  const f = lateFixture(); f.state.payments.push({ id: "payment", unitId: "u", propertyId: "p", tenantAssignmentId: "a", billingCycle: "2026-10", status, amountCents: 100 });
  assert.equal((await f.run()).posted, ["PENDING", "PAID"].includes(status) ? 0 : 4);
});
for (const amount of [0, -1, -100]) test("nonpositive balance suppresses " + amount, async () => {
  const f = lateFixture(); f.state.ledger[0].amountCents = 0; if (amount < 0) f.add({ entryType: "CREDIT", chargeType: null, amountCents: -amount });
  assert.equal((await f.run()).posted, 0);
});
test("grace and billing start remain authoritative", async () => {
  const f = lateFixture(); assert.equal((await f.run(new Date("2026-10-02T17:00:00Z"))).posted, 0);
  assert.equal((await f.run(new Date("2026-10-03T17:00:00Z"))).posted, 1);
  const future = lateFixture(); future.property.rentFrayStartDate = new Date("2027-01-01"); assert.equal((await future.run()).posted, 0);
});
test("daily max, integer amounts and disabled fee settings preserved", async () => {
  const f = lateFixture(); f.tiers[0].lateFeeInitialCents = 501; f.tiers[0].lateFeeDailyCents = 103; f.tiers[0].maxLateFeeDays = 2;
  assert.equal((await f.run()).posted, 3); assert.deepEqual(f.fees().map((r: any) => r.amountCents), [501, 103, 103]);
  const zero = lateFixture(); zero.tiers[0].lateFeeInitialCents = 0; zero.tiers[0].lateFeeDailyCents = 0; assert.equal((await zero.run()).posted, 0);
});
test("daily-only setting retains start on day after grace", async () => {
  const f = lateFixture(); f.tiers[0].lateFeeInitialCents = 0;
  assert.equal((await f.run(new Date("2026-10-03T17:00:00Z"))).posted, 1);
  assert.equal(f.fees()[0].idempotencyKey, "LATE_FEE_DAILY:a:2026-10:2026-10-03");
});
test("Chicago midnight controls eligible day", async () => {
  const f = lateFixture(); assert.equal((await f.run(new Date("2026-10-04T04:59:59Z"))).posted, 1);
  assert.equal((await f.run(new Date("2026-10-04T05:00:00Z"))).posted, 1);
  assert.ok(f.fees().some((r: any) => r.idempotencyKey === "LATE_FEE_DAILY:a:2026-10:2026-10-04"));
});
for (const scenario of [{ month: "2026-03", end: "2026-03-10T17:00:00Z", days: ["07", "08", "09"], hours: 47 },
  { month: "2026-11", end: "2026-11-03T17:00:00Z", days: ["31", "01", "02"], hours: 49 }]) test("DST calendar labels " + scenario.month, async () => {
  const f = lateFixture(); f.state.ledger[0].effectiveDate = new Date("2026-01-01T06:00:00Z");
  f.tiers[0].gracePeriodDays = scenario.month.endsWith("03") ? 5 : 29;
  // Fall daily dates span Oct 31 through Nov 2 within the October due cycle.
  const asOf = new Date(scenario.end); if (scenario.month.endsWith("11")) {
    f.tiers[0].rentDueDay = 5; f.property.settings.rentDueDay = 5; f.property.rentFrayStartDate = new Date("2026-01-05"); f.tiers[0].gracePeriodDays = 25;
  }
  const result = await f.run(asOf); assert.equal(result.posted, 4);
  const daily = f.fees().filter((r: any) => r.chargeType === "LATE_FEE_DAILY");
  assert.deepEqual(daily.map((r: any) => r.memo.slice(-2)), scenario.days);
  assert.equal((daily[2].effectiveDate.getTime() - daily[0].effectiveDate.getTime()) / 3600000, scenario.hours);
});
import { execFileSync } from "node:child_process";
import { root } from "./manual-payment-idempotency.test";

test("host timezones cannot change Chicago labels or DST-effective timestamps", () => {
  const script = `
    const fs=require('fs'),ts=require('typescript'),vm=require('vm');
    function load(file,imports,append='') {
      const mod={exports:{}};
      const source=ts.transpileModule(fs.readFileSync(file,'utf8')+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
      vm.runInNewContext(source,{module:mod,exports:mod.exports,Date,Error,require(name){if(!(name in imports))throw Error('Unmocked import '+name);return imports[name];}});
      return mod.exports;
    }
    const dates=load('lib/rentDates.ts',{});
    const job=load('jobs/lateFees.ts',{'@prisma/client':{Prisma:{}},'@/lib/prisma':{prisma:{}},'@/lib/billingCalendar':{BillingCalendarError:class extends Error{}},'@/lib/rentDates':dates,'@/lib/unitFinancialState':{},'@/lib/manualFinancialOperations':{}},'\\nmodule.exports.day=businessDay;module.exports.next=nextCalendarDay;');
    const labels=['2026-03-08','2026-11-01','2026-12-31','2028-02-28'];
    console.log(JSON.stringify({today:job.day(new Date('2026-03-08T06:30:00Z')),next:labels.map(job.next),spring:dates.getBusinessDateInstant('2026-03-09').getTime()-dates.getBusinessDateInstant('2026-03-08').getTime(),fall:dates.getBusinessDateInstant('2026-11-02').getTime()-dates.getBusinessDateInstant('2026-11-01').getTime()}));
  `;
  for (const zone of ["UTC", "America/Chicago", "Pacific/Auckland", "Asia/Tokyo"]) {
    const output = execFileSync(process.execPath, ["-e", script], { cwd: root, env: { ...process.env, TZ: zone }, encoding: "utf8" });
    assert.deepEqual(JSON.parse(output), { today: "2026-03-08", next: ["2026-03-09", "2026-11-02", "2027-01-01", "2028-02-29"], spring: 23 * 3600000, fall: 25 * 3600000 });
  }
});
