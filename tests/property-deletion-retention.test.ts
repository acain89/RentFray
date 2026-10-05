import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, historyModels } from "./unit-deletion-retention.test";
for (const role of ["absent", "invalid", "OWNER", "MANAGER", "STAFF"])
  test("property: rejects " + role, async () => { const f = fixture(role); assert.equal((await f.callProperty()).status, 401); assert.equal(f.writes(), 0); });
for (const status of ["SETUP", "TEST"]) test("property: pristine " + status + " config succeeds", async () => {
  const f = fixture(); f.property.status = status;
  const response = await f.callProperty(); assert.equal(response.status, 200); assert.equal(response.body.ok, true); assert.equal(f.writes(), 1);
});
for (const model of historyModels) test("property: " + model + " blocks even in SETUP/TEST", async () => {
  for (const status of ["SETUP", "TEST"]) { const f = fixture(); f.property.status = status;
    f.records[model].push({ id: "history", propertyId: "a", unitId: "unit" });
    const before = JSON.stringify(f.records); const response = await f.callProperty(); assert.equal(response.status, 409);
    assert.match(response.body.error, /preserve|Preserve/); assert.equal(f.writes(), 0); assert.equal(JSON.stringify(f.records), before); }
});
for (const status of ["UNPAID", "PENDING", "FAILED", "PAID", "REVERSED"]) test("property: Payment " + status, async () => {
  const f = fixture(); f.records.payment.push({ id: "p", propertyId: "a", status }); assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0);
});
for (const [field, value] of [["stripeAccountId", "acct_isolated"], ["stripeAccountId", ""], ["rentFrayStartDate", new Date()],
  ["setupCompleteAcknowledgedAt", new Date()], ["status", "READY"], ["status", "LIVE"], ["status", "SUSPENDED"], ["status", "unknown"]] as [string, any][])
  test("property: protected " + field + " " + value, async () => { const f = fixture(); f.property[field] = value;
    assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
for (const field of ["processorConnected", "bankConnected", "chargesEnabled", "payoutsEnabled", "onboardingComplete", "requirementsDue", "requirementsSummary", "lastSyncedAt", "readyForLive"])
  test("property: connection evidence " + field, async () => { const f = fixture(); f.property.paymentStatus[field] = field === "lastSyncedAt" ? new Date() : field === "requirementsSummary" ? "" : true;
    assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
for (const field of ["onboardingComplete", "setupComplete"]) test("property: setup completion " + field, async () => {
  const f = fixture(); f.property.settings[field] = true; assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
for (const field of ["lastLoginAt", "emailVerifiedAt"]) test("property: management use " + field, async () => {
  const f = fixture(); f.property.managementUsers[0][field] = new Date(); assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
test("property: maintenance login blocks", async () => { const f = fixture(); f.property.maintenanceUsers[0].lastLoginAt = new Date(); assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
test("property: historical child with inconsistent scope blocks", async () => { const f = fixture(); f.records.payment.push({ id: "p", unitId: "unit", propertyId: "legacy-other" });
  assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
test("property: child portal evidence blocks", async () => { const f = fixture(); f.unit.tenantPinHash = "legacy";
  assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0); });
test("property: missing/foreign URL never deletes another property", async () => { const f = fixture(); assert.notEqual((await f.callProperty("b")).status, 200); assert.equal(f.writes(), 0); });
test("property: configuration-only tiers and charges are not history queries", async () => { const f = fixture();
  f.property.tiers = [{ id: "tier", charges: [{ amountCents: 100 }] }]; assert.equal((await f.callProperty()).status, 200); });
