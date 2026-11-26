import { test } from "node:test";
import assert from "node:assert/strict";
import { october, november } from "./recurring-charge-configuration.fixture";
import { monthlyFixture, charge } from "./monthly-recurring-configuration.fixture";


test("actual monthly engine catches up October and bills only November replacement; rerun preserves history", async () => {
  const f = monthlyFixture([charge("old", 1000, october, november), charge("new", 2000, november)]);
  await f.run(new Date("2026-11-20T12:00:00Z"));
  assert.deepEqual(f.ledger.map(r => [r.billingCycle, r.amountCents]), [["2026-10", 1000], ["2026-11", 2000]]);
  assert.equal(f.ledger[0].idempotencyKey, "TIER_RECURRING_FEE:u:2026-10:old");
  const before = structuredClone(f.ledger); await f.run(new Date("2026-11-21T12:00:00Z")); assert.deepEqual(f.ledger, before);
});
test("empty November retains October catch-up and excludes canceled pending item", async () => {
  const canceled = { ...charge("canceled", 2000, november), isActive: false };
  const f = monthlyFixture([charge("old", 1000, october, november), canceled]);
  await f.run(new Date("2026-11-20T12:00:00Z")); assert.equal(f.ledger.length, 1); assert.equal(f.ledger[0].billingCycle, "2026-10");
});
test("same-label legitimate items each bill once and NULL end remains open", async () => {
  const f = monthlyFixture([charge("pet", 1000, october), charge("trash", 2000, october)]);
  await f.run(new Date("2026-10-20T12:00:00Z")); await f.run(new Date("2026-10-21T12:00:00Z"));
  assert.deepEqual(f.ledger.map(r => r.amountCents), [1000, 2000]);
});
test("persistent unit fee timing and identity remain unchanged", async () => {
  const f = monthlyFixture(); f.unit.recurringFeeItems = [{ id: "water", label: "Water", amountCents: 2500, createdAt: new Date("2026-09-01T12:00:00Z") },
    { id: "future", label: "Future", amountCents: 3000, createdAt: new Date("2026-10-20T12:00:00Z") }];
  await f.run(new Date("2026-10-21T12:00:00Z")); assert.equal(f.ledger.length, 1);
  assert.equal(f.ledger[0].idempotencyKey, "UNIT_RECURRING_FEE:u:2026-10:water");
});
test("vacancy skips; current tier and replacement assignment determine new obligations", async () => {
  const f = monthlyFixture([charge("other-tier", 9000, october, null, "other"), charge("current", 1000, october)]);
  f.unit.tenantAssignments = []; await f.run(new Date("2026-10-20T12:00:00Z")); assert.equal(f.ledger.length, 0);
  f.unit.tenantAssignments = [{ id: "replacement", moveInDate: new Date("2026-09-01T12:00:00Z") }];
  await f.run(new Date("2026-10-20T12:00:00Z")); assert.equal(f.ledger.length, 1);
  assert.equal(f.ledger[0].tenantAssignmentId, "replacement"); assert.equal(f.ledger[0].amountCents, 1000);
});
