import { test } from "node:test";
import assert from "node:assert/strict";
import { lateFixture } from "./late-fee-idempotency.test";

function twoReaderBarrier() {
  let arrivals = 0; let release: () => void = () => {};
  const ready = new Promise<void>(resolve => { release = resolve; });
  return async () => { if (++arrivals === 2) release(); await ready; };
}
for (const type of ["initial", "daily", "batch"]) test("concurrent " + type + " after both candidate snapshots commits once", async () => {
  const f = lateFixture(); if (type === "initial") f.tiers[0].lateFeeDailyCents = 0;
  if (type === "daily") { f.tiers[0].lateFeeInitialCents = 0; f.tiers[0].maxLateFeeDays = 1; }
  f.controls.snapshotBarrier = twoReaderBarrier();
  // Separate evaluated job modules share only the database fixture, like two instances.
  const a = f.job(); const b = f.job();
  const results = await Promise.all([a(new Date("2026-10-06T17:00:00Z"), "p"), b(new Date("2026-10-06T17:00:00Z"), "p")]);
  const expected = type === "batch" ? 4 : 1;
  assert.equal(results.reduce((sum, r) => sum + r.posted, 0), expected);
  assert.equal(results.reduce((sum, r) => sum + r.skipped, 0), 1);
  assert.equal(new Set(f.fees().map((r: any) => r.idempotencyKey)).size, expected);
  assert.equal(f.fees().length, expected); assert.equal(f.events.filter(e => e === "candidate.read").length, 2);
});
test("advisory then Property/Assignment/Unit/Tier order and transaction-local history/write", async () => {
  const f = lateFixture(); const result = await f.run(); assert.equal(result.posted, 4);
  const events = f.events; const tenancy = events.indexOf("advisory:p:u:a"); const cycle = events.indexOf("advisory:p:u:a:2026-10");
  const rowLocks = ["Property", "TenantAssignment", "Unit", "PropertyTier"].map(table => events.findIndex(e => e.includes('FROM "' + table + '"')));
  assert.ok(tenancy < cycle && cycle < rowLocks[0]); assert.ok(rowLocks.every((index, i) => i === 0 || index > rowLocks[i - 1]));
  assert.ok(events.indexOf("assignment.read") > rowLocks[3]); assert.ok(events.lastIndexOf("unit.read") > rowLocks[3]);
  assert.ok(events.lastIndexOf("financial.read") > rowLocks[3]);
  assert.ok(events.indexOf("history.read") > events.lastIndexOf("financial.read"));
  assert.ok(events.indexOf("batch.insert") > events.indexOf("history.read"));
});
for (const kind of ["vacancy", "reassignment", "futureMoveOut", "unitInactive", "foreignAssignment"]) test("post-lock revalidation " + kind + " cannot redirect attribution", async () => {
  const f = lateFixture(); f.controls.onLock = (sql: string) => { if (!sql.includes('FROM "Property"')) return;
    if (kind === "unitInactive") f.state.units[0].isActive = false;
    else if (kind === "futureMoveOut") f.state.assignments[0].moveOutDate = new Date("2100-01-01");
    else if (kind === "foreignAssignment") f.state.assignments[0].propertyId = "foreign";
    else { f.state.assignments[0].isCurrent = false; if (kind === "reassignment") f.state.assignments.push({ id: "replacement", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null }); }
  };
  const result = await f.run(); assert.equal(result.posted, 0); assert.equal(result.skipped, 1); assert.equal(f.fees().length, 0);
});
test("future move-in remains eligible under existing predicate", async () => {
  const f = lateFixture(); f.state.assignments[0].moveInDate = new Date("2100-01-01"); assert.equal((await f.run()).posted, 4);
});
for (const change of ["PENDING", "PAID", "zeroBalance", "feeAmounts", "tier"]) test("financial state is fresh after locks " + change, async () => {
  const f = lateFixture(); let fired = false;
  f.controls.onLock = (sql: string) => { if (fired || !sql.includes('FROM "Property"')) return; fired = true;
    if (change === "zeroBalance") f.state.ledger[0].amountCents = 0;
    else if (change === "feeAmounts") f.tiers[0].lateFeeInitialCents = 777;
    else if (change === "tier") { f.tiers.push({ ...f.tiers[0], id: "newTier", lateFeeInitialCents: 888 }); f.state.units[0].tierId = "newTier"; }
    else f.state.payments.push({ id: "payment", unitId: "u", tenantAssignmentId: "a", billingCycle: "2026-10", status: change, amountCents: 1 });
  };
  if (change === "tier") {
    const transaction = f.prisma.$transaction;
    f.prisma.$transaction = async (fn: any, options: any) => { try { return await transaction(fn, options); }
      catch (error) { if (fired) f.state.units[0].tierId = "newTier"; throw error; } };
  }
  const result = await f.run(); assert.equal(result.posted, ["feeAmounts", "tier"].includes(change) ? 4 : 0);
  if (change === "feeAmounts") assert.equal(f.fees()[0].amountCents, 777);
  if (change === "tier") { assert.ok(f.events.includes("rollback")); assert.equal(f.fees()[0].amountCents, 888); }
});
test("cycle change never redirects identity even across bounded retries", async () => {
  const f = lateFixture(); f.controls.onLock = (sql: string) => { if (sql.includes('FROM "Property"')) {
    f.property.rentFrayStartDate = new Date("2026-01-05"); f.property.settings.rentDueDay = 5; f.tiers[0].rentDueDay = 5;
  } };
  // Initial due day 1 at Oct 4 resolves October; due day 5 resolves September.
  const result = await f.run(new Date("2026-10-04T17:00:00Z")); assert.equal(result.posted, 0); assert.equal(result.failedUnits, 1);
  assert.equal(f.attempts(), 3); assert.equal(f.fees().length, 0);
  assert.ok(f.events.filter(e => e.startsWith("advisory:") && e.endsWith(":2026-09")).length === 0);
});
for (const fault of [{ code: "P2034" }, { code: "P2010", meta: { code: "40P01" } }, { code: "P2010", meta: { code: "55P03" } }, { code: "P2002" }]) test("bounded full-batch retry " + JSON.stringify(fault), async () => {
  const f = lateFixture(); let failures = 2; f.controls.fault = () => { if (failures-- > 0) throw fault; };
  const result = await f.run(); assert.equal(result.posted, 4); assert.equal(f.attempts(), 3); assert.equal(f.fees().length, 4);
  assert.equal(f.events.filter(e => e === "rollback").length, 2);
  const exhausted = lateFixture(); exhausted.controls.fault = () => { throw fault; };
  const failure = await exhausted.run(); assert.equal(failure.posted, 0); assert.equal(failure.failedUnits, 1);
  assert.equal(exhausted.attempts(), 3); assert.equal(exhausted.fees().length, 0);
});
test("failure after second insert rolls back initial and daily together", async () => {
  const f = lateFixture(); f.controls.fault = (index: number) => { if (index === 1) throw Error("isolated insertion failure"); };
  await assert.rejects(f.run(), /isolated insertion failure/); assert.equal(f.fees().length, 0); assert.equal(f.attempts(), 1);
});
test("unexpected unique conflict rechecks a competing committed identity after full rollback", async () => {
  const f = lateFixture(); const original = f.prisma.$transaction; let competed = false;
  f.controls.fault = (index: number) => { if (!competed && index === 1) { competed = true; throw { code: "P2002" }; } };
  f.prisma.$transaction = async (fn: any, options: any) => { try { return await original(fn, options); }
    catch (error) { if (competed && (error as any).code === "P2002") f.add({ idempotencyKey: "LATE_FEE_INITIAL:a:2026-10" }); throw error; } };
  const result = await f.run(); assert.equal(result.posted, 3); assert.equal(f.fees().length, 4); assert.equal(f.attempts(), 2);
  assert.equal(f.fees().filter((r: any) => r.chargeType === "LATE_FEE_INITIAL").length, 1);
});
test("NOWAIT rollback never proceeds to history or inserts", async () => {
  const f = lateFixture(); f.controls.onLock = () => { throw { code: "P2010", meta: { code: "55P03" } }; };
  const result = await f.run(); assert.equal(result.failedUnits, 1); assert.equal(f.attempts(), 3);
  assert.ok(!f.events.includes("history.read")); assert.ok(!f.events.includes("batch.insert"));
});
