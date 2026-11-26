import { requiredRecord, callArguments } from "./fixture-assertions";

import { test } from "node:test";
import assert from "node:assert/strict";





import { load, request, context, fixture, reads } from "./management-role-authorization.fixture";

for (const route of reads) for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " reads " + route, async () => {
  const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).GET(request(), context());
  assert.equal(result.status, 200);
  for (const [operation, args] of f.calls) if (operation.endsWith("findMany") || operation.endsWith("findUnique")) {
    assert.ok(requiredRecord(requiredRecord(args).where).propertyId === "p" || requiredRecord(requiredRecord(args).where).id === "p", operation + " must be property scoped");
  }
});
for (const route of ["admin/properties/[id]", "admin/properties/[id]/charges", "admin/properties/[id]/management-users"])
  for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " foreign read denied " + route, async () => {
    const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).GET(request(), context("foreign"));
    assert.ok([401, 403].includes(result.status)); assert.equal(f.calls.length, 0);
  });
for (const [route, method] of [["manager/maintenance/update", "POST"], ["manager/account/change-login", "POST"],
  ["manager/units/toggle-active", "POST"], ["admin/properties/[id]/charges", "POST"],
  ["admin/properties/[id]", "PATCH"], ["manager/onboarding/property", "PATCH"]] as const) test("STAFF denied " + route, async () => {
    const f = fixture("STAFF"); const result = await load("app/api/" + route + "/route.ts", f.imports)[method](request(), context());
    assert.ok(result.status >= 400); assert.equal(f.calls.length, 0);
  });
for (const role of ["OWNER", "MANAGER", "MAINTENANCE"]) for (const instruction of [{ status: "COMPLETE" }, { action: "DELETE" }]) test(role + " maintenance " + JSON.stringify(instruction), async () => {
  const f = fixture(role); f.db.maintenanceRequest.findFirst = async (args: { where: Record<string, unknown> }) => {
    assert.equal(requiredRecord(requiredRecord(args).where).propertyId, "p"); return { id: "request", status: "OPEN", unit: { unitNumber: "1" } };
  };
  const result = await load("app/api/manager/maintenance/update/route.ts", f.imports).POST(request({ requestId: "request", ...instruction }));
  assert.equal(result.status, 200); assert.ok(f.calls.some(c => c[0] === ("action" in instruction ? "maintenanceRequest.delete" : "maintenanceRequest.update")));
});
for (const role of ["OWNER", "MANAGER"]) {
  test(role + " changes own credentials", async () => {
    const f = fixture(role); let reads = 0;
    f.db.managementUser.findUnique = async (args: { where: Record<string, unknown> }) => { assert.equal(requiredRecord(requiredRecord(args).where).id, "caller"); return { id: "caller", email: "old@isolated.invalid", username: "old@isolated.invalid", isActive: true, passwordHash: "hash" }; };
    f.db.managementUser.findFirst = async () => { reads++; return null; };
    const result = await load("app/api/manager/account/change-login/route.ts", f.imports).POST(request({ currentLogin: "old@isolated.invalid", currentPassword: "oldpassword", newEmail: "new@isolated.invalid", newPassword: "password123", confirmPassword: "password123" }));
    assert.equal(result.status, 200); assert.equal(reads, 1); assert.equal(requiredRecord(callArguments(f.calls, "managementUser.update").where).id, "caller");
  });
  test(role + " toggles scoped unit", async () => {
    const f = fixture(role); f.db.unit.findFirst = async (args: { where: Record<string, unknown> }) => { assert.equal(requiredRecord(requiredRecord(args).where).propertyId, "p"); return { id: "unit", tenantAssignments: [], tierId: null }; };
    const result = await load("app/api/manager/units/toggle-active/route.ts", f.imports).POST(request({ unitId: "unit", makeActive: true }));
    assert.equal(result.status, 200); assert.equal(requiredRecord(callArguments(f.calls, "unit.update").data).isActive, true);
  });
  for (const route of ["manager/maintenance/update", "manager/units/toggle-active"]) test(role + " foreign resource rejected " + route, async () => {
    const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).POST(request({ requestId: "foreign", status: "COMPLETE", unitId: "foreign", makeActive: false }));
    assert.ok(result.status >= 400); assert.ok(!f.calls.some(c => /\.(update|delete|create)$/.test(c[0])));
  });
}
