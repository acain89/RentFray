import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, historyModels } from "./unit-deletion-retention.test";
// Mocked lock interleavings prove structure/rechecks, not PostgreSQL lock semantics.
for (const kind of ["manager", "admin"] as const) test(kind + ": property then scoped unit lock before reads and deletion", async () => {
  const f = fixture(kind === "manager" ? "MANAGER" : "ADMIN"); await f.callUnit(kind);
  assert.match(f.events[0], /FROM "Property".*FOR UPDATE/); assert.match(f.events[1], /FROM "Unit".*"propertyId".*"id".*FOR UPDATE/);
  assert.equal(f.events[2], "unit.read"); const deletion = f.events.indexOf("unit.delete");
  for (const name of historyModels) assert.ok(f.events.indexOf(name + ".read") < deletion);
});
for (const kind of ["manager", "admin"] as const) for (const model of ["payment", "ledgerEntry", "tenantAssignment"])
  test(kind + ": rechecks " + model + " committed before lock acquisition", async () => {
    const f = fixture(kind === "manager" ? "MANAGER" : "ADMIN"); const raw = f.prisma.$queryRaw; let locked = false;
    f.prisma.$queryRaw = async (...args: any[]) => { if (!locked) { f.records[model].push({ id: "racing", unitId: "unit", propertyId: "a" }); locked = true; } return raw(...args); };
    assert.equal((await f.callUnit(kind)).status, 409); assert.equal(f.writes(), 0);
  });
test("property: locks mutable children before property eligibility read", async () => {
  const f = fixture(); await f.callProperty(); const read = f.events.indexOf("property.read");
  assert.match(f.events[0], /FROM "Property"/);
  for (const table of ["Unit", "ManagementUser", "MaintenanceUser", "PropertySettings", "PaymentConnectionStatus"])
    assert.ok(f.events.findIndex(event => event.includes('FROM "' + table + '"')) > 0 &&
      f.events.findIndex(event => event.includes('FROM "' + table + '"')) < read);
  assert.ok(f.events.indexOf("property.delete") > read);
});
for (const model of ["payment", "ledgerEntry", "tenantAssignment"]) test("property: rechecks committed " + model, async () => {
  const f = fixture(); const raw = f.prisma.$queryRaw; let locked = false;
  f.prisma.$queryRaw = async (...args: any[]) => { if (!locked) { f.records[model].push({ id: "racing", propertyId: "a" }); locked = true; } return raw(...args); };
  assert.equal((await f.callProperty()).status, 409); assert.equal(f.writes(), 0);
});
test("locks: IDs remain bound parameters, never SQL text", async () => {
  const f = fixture("MANAGER"); const hostile = "a'; DELETE FROM Payment; --"; f.unit.propertyId = hostile;
  await f.callUnit("manager", hostile); assert.ok(f.events.filter(e => e.includes("FOR UPDATE")).every(e => !e.includes(hostile)));
});
