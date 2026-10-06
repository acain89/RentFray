import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load } from "./management-role-authorization.test";
for (const [path, action] of [["tenants/new", "createTenantAssignment"], ["tenants/remove", "removeTenantAssignment"], ["pin-reset", "resetTenantPin"]]) {
  for (const role of ["STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test(role + " legacy " + action + " denied", async () => {
    const f = fixture(role); const fn = load("app/manager/properties/[id]/" + path + "/page.tsx", f.imports, ";exports.action=" + action).action;
    await assert.rejects(fn({ get: () => "p" })); assert.equal(f.calls.length, 0);
  });
  for (const role of ["OWNER", "MANAGER"]) test(role + " legacy " + action + " foreign property denied", async () => {
    const f = fixture(role); const fn = load("app/manager/properties/[id]/" + path + "/page.tsx", f.imports, ";exports.action=" + action).action;
    await assert.rejects(fn({ get: (key: string) => key === "propertyId" ? "foreign" : "1234" })); assert.equal(f.calls.length, 0);
  });
}
for (const [path, action] of [["tenants/new", "createTenantAssignment"], ["tenants/remove", "removeTenantAssignment"], ["pin-reset", "resetTenantPin"]])
  for (const role of ["OWNER", "MANAGER"]) test(role + " executes " + action, async () => {
    const f = fixture(role);
    f.db.unit.findFirst = async (args: any) => {
      assert.equal(args.where.propertyId, "p");
      return { id: "unit", unitNumber: "1", tenantAssignments: path === "tenants/new" ? [] : [{ id: "assignment", firstName: "Current", lastName: "Tenant" }] };
    };
    const values: any = { propertyId: "p", unitId: "unit", firstName: "New", lastName: "Tenant", pin: "1234", activateNow: "yes" };
    const fn = load("app/manager/properties/[id]/" + path + "/page.tsx", f.imports, ";exports.action=" + action).action;
    await assert.rejects(fn({ get: (key: string) => values[key] ?? "" }), /redirect:/);
    assert.ok(f.calls.some(c => c[0] === "unit.update")); assert.ok(f.calls.some(c => c[0] === "auditLog.create"));
    if (path === "tenants/remove") assert.equal(f.calls.find(c => c[0] === "tenantAssignment.update")[1].data.isCurrent, false);
  });
