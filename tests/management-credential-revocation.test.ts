import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture as authorityFixture, load as authLoad } from "./admin-session-revalidation.test";
import { fixture as routeFixture, load, request, context } from "./management-role-authorization.test";

const credentialA = "$2b$synthetic-credential-A";
const credentialB = "$2b$synthetic-credential-B";
function bound(role = "OWNER") {
  const f = authorityFixture();
  f.state.management = { id: "m", role, propertyId: "p", isActive: true, passwordHash: credentialA };
  const binding = f.session.createManagementCredentialBinding("m", credentialA);
  const claims = { role, propertyId: "p", managementUserId: "m", managementCredentialBinding: binding };
  const token = f.session.createSessionToken(claims); f.values.set("rf_session", token);
  return { ...f, claims, managementToken: token, binding };
}
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " centrally revokes changed credential and refuses refresh upgrade", async () => {
  const f = bound(role); assert.equal((await f.session.requireManagementSession()).role, role);
  const payload = f.session.verifySessionToken(f.managementToken);
  await f.session.refreshSessionCookie(payload); assert.ok(await f.session.getSession());
  f.state.management.passwordHash = credentialB;
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
  if (reason === "role") f.state.management.role = "STAFF";
  if (reason === "inactive") f.state.management.isActive = false;
  if (reason === "deleted") f.state.management = null;
  if (reason === "property") f.state.management.propertyId = "foreign";
  if (reason === "identity") f.state.management.id = "other";
  assert.equal(await f.session.getSession(), null);
});
test("ordinary profile and login timestamps do not revoke", async () => {
  const f = bound(); Object.assign(f.state.management, { lastLoginAt: new Date(), updatedAt: new Date(), emailVerifiedAt: new Date(), displayName: "Changed" });
  assert.ok(await f.session.getSession());
});
for (const race of [false, true]) test("login binds the authenticated snapshot; race=" + race, async () => {
  const f = bound(); const r = routeFixture(null); const snapshot = { ...f.state.management, emailVerifiedAt: new Date() };
  r.db.managementUser.findFirst = async () => snapshot;
  r.imports["@/lib/liveGating"] = { canManagerOperate: () => true };
  r.imports["@/lib/session"] = f.session;
  r.imports["@/lib/managementAuth"] = { verifyManagementPassword: async (password: string, hash: string) => {
    assert.equal(hash, credentialA); assert.equal(password, "authenticated-password");
    if (race) f.state.management.passwordHash = credentialB; return true;
  } };
  const result = await load("app/api/manager/session/route.ts", r.imports).POST(request({ email: "user@isolated.invalid", password: "authenticated-password" }));
  assert.equal(result.status, 200); const token = f.values.get("rf_session")!;
  assert.equal(f.session.verifySessionToken(token).managementCredentialBinding, f.binding);
  assert.equal(Boolean(await f.session.getSession()), !race);
  assert.ok(!JSON.stringify(result.body).includes(credentialA));
});
test("self-change clears cookies, revokes old session and allows only the new credential", async () => {
  const f = bound(); const r = routeFixture(); Object.assign(f.state.management, { email: "old@isolated.invalid", username: "old@isolated.invalid" });
  r.imports["@/lib/session"] = f.session; r.db.managementUser.findUnique = async () => f.state.management;
  r.db.managementUser.findFirst = async () => null;
  r.imports["@/lib/managementAuth"] = { verifyManagementPassword: async (password: string, hash: string) => password === "old-password" && hash === credentialA };
  r.imports.bcryptjs.hash = async () => credentialB;
  r.db.managementUser.update = async ({ data }: any) => { Object.assign(f.state.management, data); return { id: "m", role: "OWNER", isActive: true }; };
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
  assert.match(readFileSync("app/manager/dashboard/ManagerDashboardClient.tsx", "utf8"), /setShowChangeLogin\(false\);\s*window\.location\.href = "\/login\/manager"/);
});
test("unchanged ADMIN reset revokes target credential and keeps audit atomic", async () => {
  const f = bound(); const r = routeFixture("ADMIN");
  r.db.property.findUnique = async () => ({ name: "Property", propertyCode: "1234" });
  r.db.managementUser.findFirst = async () => ({ ...f.state.management, email: "user@isolated.invalid" });
  r.imports.bcryptjs.hash = async () => credentialB;
  let transaction = false, audit = false;
  r.db.$transaction = async (fn: any) => { transaction = true; const result = await fn(r.db); transaction = false; return result; };
  r.db.managementUser.update = async ({ data }: any) => { assert.equal(transaction, true); Object.assign(f.state.management, data); return { id: "m", role: "OWNER" }; };
  r.db.auditLog.create = async ({ data }: any) => { assert.equal(transaction, true); audit = true; assert.ok(!JSON.stringify(data).includes(credentialB)); };
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
  r.db.auditLog.create = async ({ data }: any) => { events.push("audit"); assert.ok(!JSON.stringify(data).includes(credentialA)); };
  r.db.emailVerificationToken.findUnique = async () => ({ id: "t", managementUserId: "m", managementUser: user, usedAt: null, expiresAt: new Date(Date.now() + 10000) });
  const result = issuer === "verification"
    ? await load("app/api/auth/verify-email/route.ts", r.imports).GET({ url: "https://isolated.invalid/?token=valid" })
    : await load("app/api/admin/impersonate/route.ts", r.imports).POST(request({ propertyId: "p", managementUserId: "m" }));
  assert.equal(issued.length, 1); assert.ok(await f.session.validateSessionToken(issued[0]));
  if (issuer === "impersonation") { assert.equal(result.status, 200); assert.equal(events[0], "audit"); }
  f.state.management.passwordHash = credentialB; assert.equal(await f.session.validateSessionToken(issued[0]), null);
});

// Reverse only the exact RF-15 additions, then retain whole-source equality.
export function assertApprovedCredentialChange(file: string, before: string, after: string) {
  let restored = after.replace(/\r\n/g, "\n"); const original = before.replace(/\r\n/g, "\n");
  if (file === "lib/session.ts") {
    restored = restored.replace(/export function createManagementCredentialBinding[\s\S]*?\n}\n\nfunction isManagementCredentialBinding[\s\S]*?\n}\n\n/, "");
    restored = restored.replace(/^  managementCredentialBinding\?: string;\n/m, "").replace(/^      managementCredentialBinding: string;\n/m, "");
    restored = restored.replace('isNonEmptyString(parsed.managementUserId) &&\n      isManagementCredentialBinding(parsed.managementCredentialBinding)', 'isNonEmptyString(parsed.managementUserId)');
    restored = restored.replace('      if (!isManagementCredentialBinding(input.managementCredentialBinding)) {\n        throw new Error("Invalid management session.");\n      }\n', "");
    restored = restored.replace('        managementCredentialBinding: input.managementCredentialBinding,\n', "");
    restored = restored.replace('      ...((parsed.role === "OWNER" || parsed.role === "MANAGER" || parsed.role === "STAFF")\n        ? { managementCredentialBinding: parsed.managementCredentialBinding }\n        : {}),\n', "");
    restored = restored.replace('!isNonEmptyString(session.propertyId) ||\n      !isManagementCredentialBinding(session.managementCredentialBinding)', '!isNonEmptyString(session.propertyId)');
    const start = restored.indexOf("async function hasCurrentManagementAuthority"); const end = restored.indexOf("async function hasCurrentTenantAuthority", start);
    const current = restored.slice(start, end).replace('        passwordHash: true,\n', "").replace('      user.id === session.managementUserId &&\n', "").replace('user.role === session.role &&\n      isNonEmptyString(user.passwordHash) &&\n      safeEqual(session.managementCredentialBinding, createManagementCredentialBinding(user.id, user.passwordHash))', 'user.role === session.role');
    restored = restored.slice(0, start) + current + restored.slice(end);
    restored = restored.replace('      managementCredentialBinding: session.managementCredentialBinding!,\n', "");
    assert.match(after, /safeEqual\(session\.managementCredentialBinding, createManagementCredentialBinding\(user\.id, user\.passwordHash\)\)/);
    assert.match(after, /managementCredentialBinding: session\.managementCredentialBinding!/);
  } else if (file === "app/api/auth/verify-email/route.ts") {
    restored = restored.replace('createSessionToken, createManagementCredentialBinding, setSessionCookie', 'createSessionToken, setSessionCookie');
    restored = restored.replace('emailVerifiedAt: true, passwordHash: true,', 'emailVerifiedAt: true,');
    restored = restored.replace('      managementCredentialBinding: createManagementCredentialBinding(manager.id, manager.passwordHash),\n', "");
  } else throw Error("Unsupported RF-15 source guard " + file);
  assert.equal(restored.replace(/\n$/, ""), original.replace(/\n$/, ""), "Only approved RF-15 credential additions may differ: " + file);
}
