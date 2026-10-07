import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fixture, root } from "./tenant-login-assignment-race.test";

const file = "app/api/ledger/charges/route.ts";
const charge = (f: ReturnType<typeof fixture>, extra: any = {}) => f.invoke(file, {
  propertyId: "p", unitId: "u", tenantAssignmentId: "a", type: "OTHER_FEE", amount: 100, effectiveDate: "2026-10-14", memo: "fee", ...extra,
});
for (const type of ["RENT_CHARGE", "OTHER_FEE", "LATE_FEE"]) test("exact assignment preserves manual charge " + type, async () => {
  const f = fixture(); const result = await charge(f, { type, referenceNumber: "ref" }); assert.equal(result.status, 200);
  const row = f.state().ledger[0]; assert.equal(row.tenantAssignmentId, "a"); assert.equal(row.billingCycle, "2026-09");
  assert.equal(row.effectiveDate.toISOString(), "2026-10-14T05:00:00.000Z"); assert.equal(row.amountCents, 10000);
  assert.equal(row.chargeType, type === "RENT_CHARGE" ? "RENT" : type); assert.equal(row.referenceNumber, "ref");
  assert.equal(result.body.data.entry.id, row.id); assert.equal(f.state().audits[0].action, "MANUAL_CHARGE_POSTED"); assert.equal(f.realtime.length, 1);
});
for (const value of [undefined, null, "", 1]) test("manual charge rejects absent/invalid assignment " + value, async () => {
  const f = fixture(); assert.equal((await charge(f, { tenantAssignmentId: value })).status, 400);
  assert.equal(f.events.length, 0); assert.equal(f.state().ledger.length, 0);
});
test("explicit null cannot be replaced by legacy alias", async () => {
  const f = fixture(); assert.equal((await charge(f, { tenantAssignmentId: null, tenantId: "a" })).status, 400); assert.equal(f.events.length, 0);
});
test("existing Unit Detail tenantId alias remains compatible", async () => {
  const f = fixture(); const body: any = { propertyId: "p", unitId: "u", tenantId: "a", type: "OTHER_FEE", amount: 100, effectiveDate: "2026-10-14" };
  assert.equal((await f.invoke(file, body)).status, 200); assert.equal(f.state().ledger[0].tenantAssignmentId, "a");
  const source = readFileSync(resolve(root, "app/manager/units/[id]/page.tsx"), "utf8"); assert.match(source, /tenantId=\{activeAssignment\.id\}/);
});
for (const kind of ["stale", "replaced-at-lock", "foreign", "mismatched-unit", "vacant"]) test("manual charge cannot write for " + kind, async () => {
  const f = fixture();
  if (kind === "replaced-at-lock") f.controls.onLock = f.replace;
  else if (kind === "stale") f.replace();
  else if (kind === "foreign") f.state().assignments[0].propertyId = "other";
  else if (kind === "mismatched-unit") f.state().assignments[0].unitId = "other";
  else f.state().assignments = [];
  assert.equal((await charge(f)).status, 409); assert.equal(f.state().ledger.length, 0); assert.equal(f.state().audits.length, 0); assert.equal(f.realtime.length, 0);
});
test("charge audit failure rolls back ledger and emits no success", async () => {
  const f = fixture(); f.controls.failAudit = true; assert.equal((await charge(f)).status, 500); assert.equal(f.state().ledger.length, 0); assert.equal(f.realtime.length, 0);
});
test("charge retains selected date, future effectiveness and hard-start clamping", async () => {
  const f = fixture(); f.state().unit.property.rentFrayStartDate = new Date("2027-01-15T06:00:00Z");
  assert.equal((await charge(f, { effectiveDate: "2026-12-20" })).status, 200);
  assert.equal(f.state().ledger[0].effectiveDate.toISOString(), "2026-12-20T06:00:00.000Z"); assert.equal(f.state().ledger[0].billingCycle, "2027-01");
});
for (const role of ["OWNER", "MANAGER"]) test("manual charge admits " + role, async () => { assert.equal((await charge(fixture(role))).status, 200); });
for (const role of [null, "STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test("manual charge denies " + role, async () => { const f = fixture(role); assert.equal((await charge(f)).status, 401); assert.equal(f.events.length, 0); });
test("foreign property charge denied before transaction", async () => { const f = fixture(); assert.equal((await charge(f, { propertyId: "other" })).status, 403); assert.equal(f.events.length, 0); });
test("historical NULL accounting and all financial SSOTs are byte-for-byte unchanged", () => {
  for (const path of ["lib/ledger.ts", "lib/unitFinancialState.ts", "lib/paymentStatus.ts", "lib/rentDates.ts", "lib/billingCalendar.ts"]) {
    assert.equal(readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n"), execFileSync("git", ["show", "HEAD:" + path], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n"));
  }
});
