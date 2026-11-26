import { requiredValue } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";





import { load, fixture } from "./admin-session-revalidation.fixture";

for (const condition of ["active", "deleted", "inactive", "different", "db-error", "hash-only"]) test("ADMIN " + condition, async () => {
  const f = fixture(); if (condition === "deleted") f.state.admin = null;
  if (condition === "inactive") requiredValue(f.state.admin).isActive = false;
  if (condition === "different") f.state.admin = { id: "b", isActive: true };
  if (condition === "db-error") f.state.fail = true;
  if (condition === "hash-only") requiredValue(f.state.admin).codeHash = "replacement";
  assert.equal(Boolean(await f.session.getSession()), ["active", "hash-only"].includes(condition)); assert.deepEqual(JSON.parse(JSON.stringify(f.reads)), [{ id: "a" }]);
});
for (const id of [undefined, "", " ", 123, null]) test("ADMIN malformed/missing ID " + id, async () => {
  const f = fixture(); f.values.set("rf_session", f.signed({ adminAccessId: id })); assert.equal(await f.session.getSession(), null); assert.equal(f.reads.length, 0);
});
for (const active of [true, false]) test("ADMIN refresh active=" + active, async () => {
  const f = fixture(); const payload = f.session.verifySessionToken(f.token); requiredValue(f.state.admin).isActive = active;
  if (active) { await f.session.refreshSessionCookie(payload); assert.equal(requiredValue(f.session.verifySessionToken(f.writes[0].value)).adminAccessId, "a"); }
  else { await assert.rejects(f.session.refreshSessionCookie(payload), /Unauthorized/); assert.equal(f.writes.length, 0); }
});
test("ADMIN login binds exact authenticating ID without changing response", async () => {
  const inputs: Parameters<typeof import("../lib/session").createSessionToken>[0][] = []; const route = load("app/api/admin/session/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } },
    "bcryptjs": { compare: async () => true }, "@/lib/authThrottle": { admitAdminLogin: async () => ({ admitted: true }) },
    "@/lib/prisma": { prisma: { adminAccess: { findFirst: async () => ({ id: "selected", codeHash: "hash" }), update: async () => {} } } },
    "@/lib/session": { createSessionToken: (input: Parameters<typeof import("../lib/session").createSessionToken>[0]) => { inputs.push(input); return "mock"; }, setSessionCookie: async () => {}, getSession: async () => null } });
  assert.deepEqual(JSON.parse(JSON.stringify(await requiredValue(route.POST)({ json: async () => ({ code: "123456" }) }))), { body: { ok: true, role: "ADMIN" }, status: 200 });
  assert.deepEqual(JSON.parse(JSON.stringify(inputs)), [{ role: "ADMIN", adminAccessId: "selected" }]);
});
