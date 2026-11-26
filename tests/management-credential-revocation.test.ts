import { requiredValue, requiredRecord } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { fixture as routeFixture, load, request, context } from "./management-role-authorization.fixture";
import { credentialA, credentialB, bound } from "./management-credential-revocation.fixture";

for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " centrally revokes changed credential and refuses refresh upgrade", async () => {
  const f = bound(role); assert.equal((await f.session.requireManagementSession()).role, role);
  const payload = f.session.verifySessionToken(f.managementToken);
  await f.session.refreshSessionCookie(payload); assert.ok(await f.session.getSession());
  requiredValue(f.state.management).passwordHash = credentialB;
  assert.equal(await f.session.getSession(), null); await assert.rejects(f.session.requireManagementSession(), /Unauthorized/);
  const writes = f.writes.length; await assert.rejects(f.session.refreshSessionCookie(payload), /Unauthorized/);
  assert.equal(f.writes.length, writes); assert.equal(await f.session.validateSessionToken(f.managementToken), null);
});
for (const binding of [undefined, null, "", "broken", "f".repeat(64)]) test("missing/malformed/stale binding rejects without upgrade: " + String(binding), async () => {
  const f = bound(); const claims = { ...f.claims, managementCredentialBinding: binding };
  const legacy = f.signed(claims); assert.equal(await f.session.validateSessionToken(legacy), null);
  await assert.rejects(f.session.refreshSessionCookie({ ...claims, iat: 1, exp: 9999999999 }), /Unauthorized/);
  assert.equal(f.writes.length, 0);
});
test("binding is keyed, user-specific, deterministic, domain-separated and private", () => {
  const f = bound(); const derive = f.session.createManagementCredentialBinding;
  assert.equal(derive("m", credentialA), f.binding); assert.notEqual(derive("m", credentialB), f.binding);
  assert.notEqual(derive("other", credentialA), f.binding);
  const raw = Buffer.from(f.managementToken.split(".")[0], "base64url").toString();
  assert.ok(!raw.includes(credentialA)); assert.ok(!raw.includes("passwordHash")); assert.match(f.binding, /^[a-f0-9]{64}$/);
  const source = readFileSync("lib/session.ts", "utf8"); assert.match(source, /management-credential-binding:v1/);
  assert.match(source, /crypto\.createHmac\("sha256", getSessionSecret\(\)\)/); assert.match(source, /crypto\.timingSafeEqual/);
});
for (const reason of ["role", "inactive", "deleted", "property", "identity"]) test("existing authority guard preserved: " + reason, async () => {
  const f = bound();
  if (reason === "role") requiredValue(f.state.management).role = "STAFF";
  if (reason === "inactive") requiredValue(f.state.management).isActive = false;
  if (reason === "deleted") f.state.management = null;
  if (reason === "property") requiredValue(f.state.management).propertyId = "foreign";
  if (reason === "identity") requiredValue(f.state.management).id = "other";
  assert.equal(await f.session.getSession(), null);
});
test("ordinary profile and login timestamps do not revoke", async () => {
  const f = bound(); Object.assign(requiredValue(f.state.management), { lastLoginAt: new Date(), updatedAt: new Date(), emailVerifiedAt: new Date(), displayName: "Changed" });
  assert.ok(await f.session.getSession());
});
for (const race of [false, true]) test("login binds the authenticated snapshot; race=" + race, async () => {
  const f = bound(); const r = routeFixture(null); const snapshot = { ...f.state.management, emailVerifiedAt: new Date() };
  r.db.managementUser.findFirst = async () => snapshot;
  r.imports["@/lib/liveGating"] = { canManagerOperate: () => true };
  r.imports["@/lib/session"] = f.session;
  r.imports["@/lib/managementAuth"] = { verifyManagementPassword: async (password: string, hash: string) => {
    assert.equal(hash, credentialA); assert.equal(password, "authenticated-password");
    if (race) requiredValue(f.state.management).passwordHash = credentialB; return true;
  } };
  const result = await load("app/api/manager/session/route.ts", r.imports).POST(request({ email: "user@isolated.invalid", password: "authenticated-password" }));
  assert.equal(result.status, 200); const token = f.values.get("rf_session")!;
  assert.equal(requiredValue(f.session.verifySessionToken(token)).managementCredentialBinding, f.binding);
  assert.equal(Boolean(await f.session.getSession()), !race);
  assert.ok(!JSON.stringify(result.body).includes(credentialA));
});
test("self-change clears cookies, revokes old session and allows only the new credential", async () => {
  const f = bound(); const r = routeFixture(); Object.assign(requiredValue(f.state.management), { email: "old@isolated.invalid", username: "old@isolated.invalid" });
  r.imports["@/lib/session"] = f.session; r.db.managementUser.findUnique = async () => f.state.management;
  r.db.managementUser.findFirst = async () => null;
  r.imports["@/lib/managementAuth"] = { verifyManagementPassword: async (password: string, hash: string) => password === "old-password" && hash === credentialA };
  requiredRecord(r.imports.bcryptjs).hash = async () => credentialB;
  r.db.managementUser.update = async ({ data }: { data: Record<string, unknown> }) => { Object.assign(requiredValue(f.state.management), data); return { id: "m", role: "OWNER", isActive: true }; };
  const result = await load("app/api/manager/account/change-login/route.ts", r.imports).POST(request({ currentLogin: "old@isolated.invalid", currentPassword: "old-password", newEmail: "new@isolated.invalid", newPassword: "new-password", confirmPassword: "new-password" }));
  assert.equal(result.status, 200); assert.equal(result.body.redirectTo, "/login/manager");
  assert.equal(f.values.get("rf_session"), ""); assert.equal(await f.session.validateSessionToken(f.managementToken), null);
  r.db.managementUser.findFirst = async () => ({ ...f.state.management, emailVerifiedAt: new Date() });
  r.imports["@/lib/liveGating"] = { canManagerOperate: () => true };
  r.imports["@/lib/managementAuth"] = { verifyManagementPassword: async (password: string, hash: string) => password === "new-password" && hash === credentialB };
  const login = load("app/api/manager/session/route.ts", r.imports);
  assert.equal((await login.POST(request({ email: "new@isolated.invalid", password: "old-password" }))).status, 401);
  assert.equal((await login.POST(request({ email: "new@isolated.invalid", password: "new-password" }))).status, 200);
  assert.ok(await f.session.getSession());
  assert.match(readFileSync("app/manager/dashboard/ManagerDashboardClient.tsx", "utf8"), /setShowChangeLogin\(false\);\s*navigateDocument\("\/login\/manager"\)/);
});
test("unchanged ADMIN reset revokes target credential and keeps audit atomic", async () => {
  const f = bound(); const r = routeFixture("ADMIN");
  r.db.property.findUnique = async () => ({ name: "Property", propertyCode: "1234" });
  r.db.managementUser.findFirst = async () => ({ ...f.state.management, email: "user@isolated.invalid" });
  requiredRecord(r.imports.bcryptjs).hash = async () => credentialB;
  let transaction = false, audit = false;
  r.db.$transaction = async <Result>(fn: (tx: typeof r.db) => Promise<Result>): Promise<Result> => { transaction = true; const result = await fn(r.db); transaction = false; return result; };
  r.db.managementUser.update = async ({ data }: { data: Record<string, unknown> }) => { assert.equal(transaction, true); Object.assign(requiredValue(f.state.management), data); return { id: "m", role: "OWNER" }; };
  r.db.auditLog.create = async ({ data }: { data: Record<string, unknown> }) => { assert.equal(transaction, true); audit = true; assert.ok(!JSON.stringify(data).includes(credentialB)); };
  const result = await load("app/api/admin/properties/[id]/management-users/reset-password/route.ts", r.imports).POST(request({ userId: "m", temporaryPassword: "new-password" }), context());
  assert.equal(result.status, 200); assert.equal(audit, true); assert.equal(await f.session.validateSessionToken(f.managementToken), null);
});
for (const issuer of ["verification", "impersonation"]) test(issuer + " binds current credential and later revokes", async () => {
  const f = bound(); const r = routeFixture(issuer === "impersonation" ? "ADMIN" : null);
  const user = { ...f.state.management, email: "user@isolated.invalid", property: { name: "Property", propertyCode: "1234" } };
  const issued: string[] = []; const events: string[] = [];
  r.imports["@/lib/session"] = { ...f.session, getSession: async () => issuer === "impersonation" ? { role: "ADMIN", adminAccessId: "a" } : null,
    setSessionCookie: async (token: string) => { issued.push(token); } };
  r.imports["next/headers"] = { cookies: async () => ({ get: () => ({ value: "admin-cookie" }), set: (name: string, token: string) => { events.push("cookie"); if (name === "rf_session") issued.push(token); } }) };
  r.db.managementUser.findFirst = async () => user; r.db.managementUser.findUnique = async () => user;
  r.db.auditLog.create = async ({ data }: { data: Record<string, unknown> }) => { events.push("audit"); assert.ok(!JSON.stringify(data).includes(credentialA)); };
  r.db.emailVerificationToken.findUnique = async () => ({ id: "t", managementUserId: "m", managementUser: user, usedAt: null, expiresAt: new Date(Date.now() + 10000) });
  const result = issuer === "verification"
    ? await load("app/api/auth/verify-email/route.ts", r.imports).GET({ url: "https://isolated.invalid/?token=valid" })
    : await load("app/api/admin/impersonate/route.ts", r.imports).POST(request({ propertyId: "p", managementUserId: "m" }));
  assert.equal(issued.length, 1); assert.ok(await f.session.validateSessionToken(issued[0]));
  if (issuer === "impersonation") { assert.equal(result.status, 200); assert.equal(events[0], "audit"); }
  requiredValue(f.state.management).passwordHash = credentialB; assert.equal(await f.session.validateSessionToken(issued[0]), null);
});
