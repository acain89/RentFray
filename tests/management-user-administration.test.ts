import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load, request, context } from "./management-role-authorization.test";
const path = "app/api/admin/properties/[id]/management-users/route.ts";
for (const actor of ["OWNER", "MANAGER"]) {
  for (const scenario of [
    { initial: { role: "MANAGER", isActive: true }, patch: { isActive: false }, expected: { role: "MANAGER", isActive: false } },
    { initial: { role: "MANAGER", isActive: false }, patch: { isActive: true }, expected: { role: "MANAGER", isActive: true } },
    { initial: { role: "STAFF", isActive: false }, patch: { role: "MANAGER" }, expected: { role: "MANAGER", isActive: false } },
    { initial: { role: "MANAGER", isActive: true }, patch: { role: "STAFF" }, expected: { role: "STAFF", isActive: true } },
  ]) test(actor + " partial PATCH " + JSON.stringify(scenario.patch), async () => {
    const f = fixture(actor); let target = { id: "target", ...scenario.initial };
    f.db.managementUser.findFirst = async (args: any) => { assert.equal(args.where.propertyId, "p"); return target; };
    f.db.managementUser.update = async (args: any) => {
      assert.deepEqual(JSON.parse(JSON.stringify(args.data)), scenario.patch);
      assert.equal(Object.hasOwn(args.data, "role"), Object.hasOwn(scenario.patch, "role"));
      assert.equal(Object.hasOwn(args.data, "isActive"), Object.hasOwn(scenario.patch, "isActive"));
      target = { ...target, ...args.data }; return target;
    };
    const result = await load(path, f.imports).PATCH(request({ userId: "target", ...scenario.patch }), context());
    assert.equal(result.status, 200); assert.deepEqual(target, { id: "target", ...scenario.expected });
  });
  for (const value of [null, "true", "false", 1, 0, "", {}, []]) test(actor + " rejects invalid active " + JSON.stringify(value), async () => {
    const f = fixture(actor);
    const result = await load(path, f.imports).PATCH(request({ userId: "target", isActive: value }), context());
    assert.equal(result.status, 400); assert.equal(f.calls.length, 0);
  });
  for (const value of [null, {}, [], 1]) test(actor + " rejects invalid role type " + JSON.stringify(value), async () => {
    const f = fixture(actor);
    const result = await load(path, f.imports).PATCH(request({ userId: "target", role: value }), context());
    assert.equal(result.status, 400); assert.equal(f.calls.length, 0);
  });
  for (const extra of [{}, { name: "ignored", password: "ignored" }]) test(actor + " rejects empty supported update " + JSON.stringify(extra), async () => {
    const f = fixture(actor);
    const result = await load(path, f.imports).PATCH(request({ userId: "target", ...extra }), context());
    assert.equal(result.status, 400); assert.equal(f.calls.length, 0);
  });
}
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
