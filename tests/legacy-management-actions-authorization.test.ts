import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture, load, root } from "./management-role-authorization.test";

for (const name of ["new", "remove"]) {
  const file = `app/manager/properties/[id]/tenants/${name}/page.tsx`;
  test(`legacy ${name} has no tenancy, credential or success-audit writer`, () => {
    assert.doesNotMatch(readFileSync(resolve(root, file), "utf8"), /use server|tenantAssignment|tenantPinHash|auditLog|<form|@\/lib\/prisma/);
  });
  for (const role of [null, "TENANT", "MAINTENANCE", "ADMIN", "OWNER", "MANAGER", "STAFF"]) test(`${role} retired ${name} authentication/property boundary`, async () => {
    const f = fixture(role);
    f.imports["next/link"] = { __esModule: true, default: "a" };
    f.imports["next/navigation"].notFound = () => { throw Error("not found"); };
    const page = load(file, f.imports).default;
    if (!role || !["OWNER", "MANAGER", "STAFF"].includes(role)) await assert.rejects(page({ params: Promise.resolve({ id: "p" }) }), /Forbidden/);
    else {
      assert.ok(await page({ params: Promise.resolve({ id: "p" }) }));
      await assert.rejects(page({ params: Promise.resolve({ id: "foreign" }) }), /not found/);
    }
    assert.equal(f.calls.length, 0);
  });
}
const pinFile = "app/manager/properties/[id]/pin-reset/page.tsx";
test("tenant PIN action/form retired; maintenance action remains", () => {
  const source = readFileSync(resolve(root, pinFile), "utf8");
  assert.doesNotMatch(source, /resetTenantPin|tenantPinHash|tenantAssignments|name="unitId"/);
  assert.match(source, /form action=\{saveMaintenancePin\}/);
});
for (const role of [null, "STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test(`${role} cannot mutate maintenance PIN`, async () => {
  const f = fixture(role);
  const action = load(pinFile, f.imports, ";exports.action=saveMaintenancePin").action;
  await assert.rejects(action({ get: () => "p" }), /redirect:/);
  assert.equal(f.calls.length, 0);
});
for (const role of ["OWNER", "MANAGER"]) {
  test(`${role} maintenance PIN foreign property denied`, async () => {
    const f = fixture(role);
    const action = load(pinFile, f.imports, ";exports.action=saveMaintenancePin").action;
    await assert.rejects(action({ get: (key: string) => key === "propertyId" ? "foreign" : "1234" }), /redirect:/);
    assert.equal(f.calls.length, 0);
  });
  for (const operation of ["create", "reset"]) test(`${role} maintenance PIN ${operation} remains active`, async () => {
    const f = fixture(role);
    f.db.maintenanceUser = {
      findFirst: async ({ where }: any) => { assert.equal(where.propertyId, "p"); return where.id ? { id: "worker", displayName: "Worker" } : null; },
      create: async ({ data }: any) => { f.calls.push(["maintenance.create", data]); return { id: "worker", ...data }; },
      update: async ({ data }: any) => { f.calls.push(["maintenance.update", data]); return { id: "worker", ...data }; },
    };
    const values: any = { propertyId: "p", maintenanceUserId: operation === "reset" ? "worker" : "", workerName: "Worker", pin: "1234" };
    const action = load(pinFile, f.imports, ";exports.action=saveMaintenancePin").action;
    await assert.rejects(action({ get: (key: string) => values[key] ?? "" }), /maintenanceSuccess=1/);
    assert.ok(f.calls.some(c => c[0] === `maintenance.${operation === "reset" ? "update" : "create"}`));
    assert.ok(f.calls.some(c => c[0] === "auditLog.create"));
    assert.ok(!f.calls.some(c => /^(unit|tenantAssignment)\./.test(c[0])));
  });
}
