import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { monthlyFixture } from "./monthly-recurring-configuration.test";

const now = new Date("2026-10-20T12:00:00Z");
function populated() {
  const f = monthlyFixture([{ id: "tierfee", tierId: "t", label: "Tier", amountCents: 1000, isActive: true, effectiveDate: new Date("2026-10-01T05:00:00Z"), effectiveUntil: null }]);
  f.unit.tier.baseRentCents = 10000;
  f.unit.recurringFeeItems = [{ id: "unitfee", label: "Unit", amountCents: 2000, createdAt: new Date("2026-09-01T12:00:00Z") }];
  return f;
}
test("ISOLATED MODEL: lock precedes authoritative rereads and all writes, commit exposes counts", async () => {
  const f = populated(); const result = await f.run(now);
  assert.equal(f.events[0], "lock:u"); assert.equal(f.events[1], "unit:read");
  assert.ok(f.events.indexOf("ledger:write") > f.events.indexOf("ledger:read"));
  assert.equal(f.events.at(-1), "commit"); assert.equal(result.rentChargesCreated, 1);
  assert.equal(result.recurringFeeChargesCreated, 2); assert.equal(f.ledger.length, 3);
});
for (const stage of ["rent", "unit", "tier"]) test("ISOLATED MODEL: " + stage + " failure rolls back entire chunk; rerun retains identities", async () => {
  const f = populated(); f.controls.failStage = stage;
  await assert.rejects(f.run(now), /insertion failure/); assert.equal(f.ledger.length, 0);
  assert.equal(f.events.at(-1), "rollback"); f.controls.failStage = "";
  const result = await f.run(now); assert.equal(result.rentChargesCreated, 1); assert.equal(result.recurringFeeChargesCreated, 2);
  assert.deepEqual(f.ledger.map(row => row.idempotencyKey), ["RENT:u:2026-10", "UNIT_RECURRING_FEE:u:2026-10:unitfee", "TIER_RECURRING_FEE:u:2026-10:tierfee"]);
});
for (const failure of ["failLock", "failCommit"] as const) test("ISOLATED MODEL: " + failure + " rejects instead of returning successful counts", async () => {
  const f = populated(); f.controls[failure] = true;
  await assert.rejects(f.run(now)); assert.equal(f.ledger.length, 0);
  f.controls[failure] = false; assert.equal((await f.run(now)).rentChargesCreated, 1);
});
test("ISOLATED MODEL: two callers serialize same unit, reread after commit, and do not duplicate", async () => {
  const f = populated(); const results = await Promise.all([f.run(now), f.run(now)]);
  assert.equal(results.reduce((n, row) => n + row.rentChargesCreated, 0), 1);
  assert.equal(results.reduce((n, row) => n + row.recurringFeeChargesCreated, 0), 2);
  const locks = f.events.map((event, i) => event === "lock:u" ? i : -1).filter(i => i >= 0);
  assert.equal(locks.length, 2); assert.ok(locks[1] > f.events.indexOf("commit"));
  assert.equal(f.events[locks[1] + 1], "unit:read"); assert.equal(f.ledger.length, 3);
});
test("ISOLATED MODEL: stale discovery cannot override post-lock vacancy or changed tier", async () => {
  const f = populated(); f.controls.onLock = () => { f.unit.tenantAssignments = []; };
  const result = await f.run(now); assert.equal(result.skippedNoTenant, 1); assert.equal(f.ledger.length, 0);
});
test("stable unit keys: same unit across cycles shares lock; different units use distinct keys", async () => {
  const a = populated(); await a.run(now); await a.run(new Date("2026-11-20T12:00:00Z"));
  assert.equal(a.events.filter(event => event === "lock:u").length, 2);
  const b = populated(); b.unit.id = "other"; await b.run(now); assert.equal(b.events[0], "lock:other");
});
test("production uses transaction-scoped lock and no session acquire/unlock", () => {
  const source = readFileSync(resolve(__dirname, "../jobs/monthlyRent.ts"), "utf8");
  assert.match(source, /pg_advisory_xact_lock/); assert.doesNotMatch(source, /pg_try_advisory_lock|pg_advisory_unlock|pg_advisory_lock\(/);
  assert.match(source, /hashtext\(\$\{unitId\}\)/);
});
