import { requiredText } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";





import { fixture, type HistoryModel, type HistoryRow } from "./unit-deletion-retention.fixture";

for (const kind of ["manager", "admin"] as const) {
  for (const role of ["absent", "invalid", "STAFF", ...(kind === "manager" ? ["ADMIN"] : ["OWNER", "MANAGER"])])
    test(kind + ": rejects " + role, async () => { const f = fixture(role); assert.equal((await f.callUnit(kind)).status, kind === "manager" && ["STAFF", "ADMIN"].includes(role) ? 403 : 401); assert.equal(f.writes(), 0); assert.equal(f.events.length, 0); });
  for (const role of kind === "manager" ? ["OWNER", "MANAGER"] : ["ADMIN"])
    test(kind + ": pristine succeeds for " + role, async () => { const f = fixture(role); const response = await f.callUnit(kind);
      assert.equal(response.status, 200); assert.equal(response.body.ok, true);
      if (kind === "admin") { assert.equal(response.body.data?.unitId, "unit"); assert.ok(f.events.includes("tier.update")); }
      else assert.equal(f.writes(), 1); });
  for (const id of ["missing", "foreign"]) test(kind + ": " + id + " scope rejected", async () => {
    const f = fixture(kind === "manager" ? "OWNER" : "ADMIN"); if (id === "foreign") f.unit.propertyId = "b";
    assert.notEqual((await f.callUnit(kind, id === "missing" ? id : "unit")).status, 200); assert.equal(f.writes(), 0);
  });
  for (const [model, extra] of [
    ["tenantAssignment", { isCurrent: true, moveOutDate: null }], ["tenantAssignment", { isCurrent: false }],
    ["tenantAssignment", { isCurrent: true, moveInDate: new Date("2099-01-01"), moveOutDate: new Date("2099-12-31") }],
    ["ledgerEntry", {}], ["ledgerEntry", { amountCents: 0 }], ["ledgerEntry", { voidedAt: new Date() }],
    ...["UNPAID", "PENDING", "FAILED", "PAID", "REVERSED"].map((status): [HistoryModel, Partial<HistoryRow>] => ["payment", { status }]),
    ["payment", { stripeSessionId: "cs_isolated", stripePaymentIntentId: "pi_isolated" }],
    ["maintenanceRequest", {}], ["unitNote", {}], ["unitRecurringFee", {}],
    ["auditLog", { targetId: "unit", action: "UNIT_VACATED" }],
    ["auditLog", { metadataJson: JSON.stringify({ unitId: "unit" }), propertyId: null }],
  ] satisfies [HistoryModel, Partial<HistoryRow>][] ) test(kind + ": preserves " + model + " " + JSON.stringify(extra), async () => {
    const f = fixture(kind === "manager" ? "OWNER" : "ADMIN"); f.records[model].push({ id: "history", unitId: "unit", propertyId: "a", ...extra });
    const before = JSON.stringify(f.records); const response = await f.callUnit(kind);
    assert.equal(response.status, 409); assert.match(requiredText(response.body.error), /history/); assert.equal(f.writes(), 0);
    assert.equal(JSON.stringify(f.records), before); assert.equal(f.unit.isActive, false);
  });
  for (const field of ["portalActivated", "portalFirstName", "portalLastName", "tenantPinHash", "activatedAt", "activationSource"] as const)
    test(kind + ": portal evidence " + field, async () => { const f = fixture(kind === "manager" ? "OWNER" : "ADMIN");
      if (field === "portalActivated") f.unit[field] = true;
      else if (field === "activatedAt") f.unit[field] = new Date();
      else f.unit[field] = "";
      assert.equal((await f.callUnit(kind)).status, 409); assert.equal(f.writes(), 0); });
  test(kind + ": zero net balance remains historical", async () => { const f = fixture(kind === "manager" ? "OWNER" : "ADMIN");
    f.records.ledgerEntry.push({ id: "charge", unitId: "unit", amountCents: 100 }, { id: "credit", unitId: "unit", amountCents: -100 });
    assert.equal((await f.callUnit(kind)).status, 409); assert.equal(f.writes(), 0); });
}
test("manager: active pristine unit still rejected", async () => { const f = fixture("MANAGER"); f.unit.isActive = true;
  assert.equal((await f.callUnit("manager")).status, 404); assert.equal(f.writes(), 0); });
test("admin: URL property scope remains authoritative", async () => { const f = fixture();
  assert.notEqual((await f.callUnit("admin", "unit", "b")).status, 200); assert.equal(f.writes(), 0); });
