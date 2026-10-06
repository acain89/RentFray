import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load, request, context } from "./management-role-authorization.test";
const path = "app/api/admin/properties/[id]/management-users/route.ts";
for (const actor of ["OWNER", "MANAGER"]) {
  for (const role of ["OWNER", "ADMIN", "TENANT", "MAINTENANCE", "", "garbage"]) for (const method of ["POST", "PATCH"]) test(actor + " rejects " + role + " " + method, async () => {
    const f = fixture(actor); const result = await load(path, f.imports)[method](request({ email: "user@isolated.invalid", password: "password123", userId: "target", role }), context());
    assert.equal(result.status, 400); assert.ok(!f.calls.some(c => /create|update|email/.test(c[0])));
  });
  for (const role of ["MANAGER", "STAFF"]) test(actor + " creates " + role + " with verification", async () => {
    const f = fixture(actor); const result = await load(path, f.imports).POST(request({ email: "user@isolated.invalid", password: "password123", role }), context());
    assert.equal(result.status, 200); const create = f.calls.find(c => c[0] === "managementUser.create");
    assert.equal(create[1].data.role, role); assert.equal(create[1].data.emailVerifiedAt, undefined);
    assert.ok(f.calls.findIndex(c => c[0] === "email") > f.calls.findIndex(c => c[0] === "managementUser.create"));
    assert.equal(result.body.verificationEmailSent, true); assert.ok(!JSON.stringify(result.body).includes("password123"));
  });
  test(actor + " cannot mutate OWNER target", async () => {
    const f = fixture(actor); f.db.managementUser.findFirst = async (args: any) => { assert.equal(args.where.propertyId, "p"); return { id: "owner", role: "OWNER" }; };
    const result = await load(path, f.imports).PATCH(request({ userId: "owner", role: "STAFF", isActive: false }), context());
    assert.equal(result.status, 403); assert.ok(!f.calls.some(c => c[0].endsWith("update")));
  });
  for (const method of ["POST", "PATCH"]) test(actor + " rejects foreign administration " + method, async () => {
    const f = fixture(actor); const result = await load(path, f.imports)[method](request({ role: "STAFF" }), context("foreign"));
    assert.equal(result.status, 403); assert.equal(f.calls.length, 0);
  });
}
for (const method of ["POST", "PATCH"]) test("STAFF administration denied " + method, async () => {
  const f = fixture("STAFF"); const result = await load(path, f.imports)[method](request({ role: "STAFF" }), context());
  assert.equal(result.status, 401); assert.equal(f.calls.length, 0);
});
for (const actor of ["OWNER", "MANAGER"]) for (const role of ["MANAGER", "STAFF"]) test(actor + " edits/disables " + role, async () => {
  const f = fixture(actor); f.db.managementUser.findFirst = async (args: any) => { assert.equal(args.where.propertyId, "p"); return { id: "target", role, isActive: true }; };
  const result = await load(path, f.imports).PATCH(request({ userId: "target", role, isActive: false }), context());
  assert.equal(result.status, 200); assert.equal(f.calls.find(c => c[0] === "managementUser.update")[1].data.isActive, false);
});
for (const actor of ["OWNER", "MANAGER"]) test(actor + " foreign target not found", async () => {
  const f = fixture(actor); f.db.managementUser.findFirst = async (args: any) => { assert.equal(args.where.propertyId, "p"); return null; };
  const result = await load(path, f.imports).PATCH(request({ userId: "foreign", role: "STAFF" }), context());
  assert.equal(result.status, 404); assert.equal(f.calls.length, 0);
});
