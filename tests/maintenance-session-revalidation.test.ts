import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load } from "./admin-session-revalidation.test";
for (const condition of ["active", "inactive", "deleted", "moved", "different", "db-error", "pin-only"]) test("MAINTENANCE " + condition, async () => {
  const f = fixture("MAINTENANCE"); if (condition === "inactive") f.state.worker.isActive = false;
  if (condition === "deleted") f.state.worker = null;
  if (condition === "moved") f.state.worker.propertyId = "other";
  if (condition === "different") f.state.worker.id = "other";
  if (condition === "db-error") f.state.fail = true;
  if (condition === "pin-only") f.state.worker.pinHash = "replacement";
  assert.equal(Boolean(await f.session.getSession()), ["active", "pin-only"].includes(condition)); assert.deepEqual(JSON.parse(JSON.stringify(f.reads)), [{ id: "w" }]);
});
for (const missing of ["maintenanceUserId", "propertyId"]) test("MAINTENANCE missing " + missing, async () => {
  const f = fixture("MAINTENANCE"); f.values.set("rf_session", f.signed({ [missing]: undefined })); assert.equal(await f.session.getSession(), null);
});
for (const active of [true, false]) test("MAINTENANCE refresh active=" + active, async () => {
  const f = fixture("MAINTENANCE"); const payload = f.session.verifySessionToken(f.token); f.state.worker.isActive = active;
  if (active) { await f.session.refreshSessionCookie(payload); assert.equal(f.session.verifySessionToken(f.writes[0].value).maintenanceUserId, "w"); }
  else { await assert.rejects(f.session.refreshSessionCookie(payload), /Unauthorized/); assert.equal(f.writes.length, 0); }
});
for (const route of ["maintenance/dashboard", "manager/maintenance", "manager/maintenance/update"]) test("stale worker cannot access " + route, async () => {
  const f = fixture("MAINTENANCE"); f.state.worker.isActive = false;
  const blocked = new Proxy({}, { get() { throw Error("Resource accessed before authorization"); } });
  const api = load("app/api/" + route + "/route.ts", { "@/lib/session": f.session, "@/lib/prisma": { prisma: blocked }, "@prisma/client": { Prisma: {} },
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } } });
  const result = await (api.GET ? api.GET() : api.POST({ json: async () => { throw Error("Request parsed before authorization"); } })); assert.equal(result.status, 401);
});
for (const role of ["OWNER", "MANAGER", "STAFF"]) for (const condition of ["valid", "deleted", "inactive", "role", "property"]) test(role + " existing authority " + condition, async () => {
  const f = fixture(); f.state.management = { id: "m", propertyId: "p", isActive: true, role, passwordHash: "synthetic-credential" };
  f.values.set("rf_session", f.session.createSessionToken({ role, managementUserId: "m", propertyId: "p",
    managementCredentialBinding: f.session.createManagementCredentialBinding("m", f.state.management.passwordHash) }));
  if (condition === "deleted") f.state.management = null; if (condition === "inactive") f.state.management.isActive = false;
  if (condition === "role") f.state.management.role = "OTHER"; if (condition === "property") f.state.management.propertyId = "other";
  assert.equal(Boolean(await f.session.getSession()), condition === "valid");
});
for (const condition of ["valid", "deleted", "not-current", "vacated", "unit", "property", "unit-property"]) test("TENANT existing binding " + condition, async () => {
  const f = fixture(); f.state.assignment = { id: "t", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } };
  f.values.set("rf_session", f.session.createSessionToken({ role: "TENANT", tenantAssignmentId: "t", unitId: "u", propertyId: "p" }));
  if (condition === "deleted") f.state.assignment = null; if (condition === "not-current") f.state.assignment.isCurrent = false;
  if (condition === "vacated") f.state.assignment.moveOutDate = new Date(0); if (condition === "unit") f.state.assignment.unitId = "other";
  if (condition === "property") f.state.assignment.propertyId = "other"; if (condition === "unit-property") f.state.assignment.unit.propertyId = "other";
  assert.equal(Boolean(await f.session.getSession()), condition === "valid");
});
