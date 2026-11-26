import { requiredRecord, requiredText, callArguments } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, load, request, context } from "./management-role-authorization.fixture";
test("email failure preserves created subordinate and reports recovery", async () => {
  const f = fixture(); requiredRecord(f.imports["@/lib/email"]).sendVerificationEmail = async () => { throw Error("isolated failure"); };
  const result = await load("app/api/admin/properties/[id]/management-users/route.ts", f.imports).POST(request({ email: "user@isolated.invalid", password: "password123", role: "STAFF" }), context());
  assert.equal(result.status, 200); assert.equal(result.body.ok, true); assert.equal(result.body.verificationEmailSent, false);
  assert.ok(requiredText(result.body.verificationRecoveryUrl).includes("code=1234")); assert.ok(!f.calls.some(c => c[0].endsWith("delete")));
});
for (const scoped of [true, false]) test("resend " + (scoped ? "property" : "public email-only") + " recovery", async () => {
  const f = fixture(null); f.db.property.findUnique = async () => ({ id: "other", propertyCode: "5678" });
  f.db.managementUser.findFirst = async (args: { where: Record<string, unknown> }) => { assert.equal(args.where.email, "user@isolated.invalid"); assert.equal(args.where.propertyId, scoped ? "other" : undefined); return { id: "recipient", email: "user@isolated.invalid", isActive: true, role: "STAFF" }; };
  const result = await load("app/api/auth/resend-verification/route.ts", f.imports).POST(request({ email: "user@isolated.invalid", ...(scoped ? { propertyCode: "5678" } : {}) }));
  assert.equal(result.status, 200); assert.equal(callArguments(f.calls, "email").managementUserId, "recipient");
});
for (const [role, active, allowed] of [["OWNER", false, true], ["MANAGER", false, false], ["STAFF", false, false], ["MANAGER", true, true], ["STAFF", true, true]] as const) test(role + " active=" + active + " verification", async () => {
  const f = fixture(null); const manager = { id: "user", propertyId: "p", role, isActive: active, passwordHash: "synthetic-credential", email: "user@isolated.invalid", property: { name: "Property", propertyCode: "1234" } };
  f.db.emailVerificationToken.findUnique = async () => ({ id: "token", managementUserId: "user", expiresAt: new Date(Date.now() + 100000), usedAt: null, managementUser: manager });
  f.db.managementUser.findUnique = async () => manager;
  const result = await load("app/api/auth/verify-email/route.ts", f.imports).GET({ url: "https://isolated.invalid/api/auth/verify-email?token=secret" });
  assert.ok(result.url.includes(allowed ? "/manager/dashboard" : "status=invalid"));
  assert.equal(f.calls.some(c => c[0] === "session"), allowed);
  assert.equal(f.calls.some(c => c[0] === "managementUser.update"), allowed);
});
for (const used of [true, false]) test(used ? "used verification rejected" : "expired verification rejected", async () => {
  const f = fixture(null); f.db.emailVerificationToken.findUnique = async () => ({ usedAt: used ? new Date() : null, expiresAt: new Date(Date.now() - 1000) });
  const result = await load("app/api/auth/verify-email/route.ts", f.imports).GET({ url: "https://isolated.invalid/?token=secret" });
  assert.ok(result.url.includes("status=invalid")); assert.equal(f.calls.length, 0);
});
for (const verified of [false, true]) test("normal subordinate login verified=" + verified, async () => {
  const f = fixture(null); f.imports["@/lib/liveGating"] = { canManagerOperate: () => true };
  f.db.managementUser.findFirst = async () => ({ id: "recipient", role: "STAFF", propertyId: "p", isActive: true, passwordHash: "hash", emailVerifiedAt: verified ? new Date() : null });
  const result = await load("app/api/manager/session/route.ts", f.imports).POST(request({ email: "user@isolated.invalid", password: "password123" }));
  assert.equal(result.status, verified ? 200 : 401); assert.equal(f.calls.some(c => c[0] === "session"), verified);
});
for (const fail of [false, true]) test("ADMIN provisioning verification send failure=" + fail, async () => {
  const f = fixture("ADMIN"); let committed = false;
  f.db.property.findUnique = async () => null;
  f.db.$transaction = async <Result>(fn: (tx: typeof f.db) => Promise<Result>): Promise<Result> => { const result = await fn(f.db); committed = true; return result; };
  requiredRecord(f.imports["@/lib/email"]).sendVerificationEmail = async (input: Parameters<typeof import("../lib/email").sendVerificationEmail>[0]) => { assert.equal(committed, true); assert.equal(input.email, "owner@isolated.invalid"); if (fail) throw Error("mail unavailable"); f.calls.push(["email", input]); };
  const result = await load("app/api/admin/properties/route.ts", f.imports).POST(request({ account: { email: "owner@isolated.invalid", password: "password123", fullName: "Owner" }, property: { name: "Property", address: "Address" }, tiers: [{ name: "Tier", unitLabels: "1", baseRent: 0, dueDay: 1, graceDays: 0, lateFeeInitial: 0, lateFeeDaily: 0, lateFeeMaxDays: 0 }] }));
  assert.equal(result.status, 200); assert.equal(result.body.verificationEmailSent, !fail);
  assert.ok(f.calls.some(c => c[0] === "managementUser.create" && requiredRecord(requiredRecord(c[1]).data).role === "OWNER"));
  assert.ok(!f.calls.some(c => c[0].endsWith("delete"))); assert.ok(!JSON.stringify(result.body).includes("password123"));
});

for (const email of [null, undefined, ""]) test(`verification rejects missing locked email: ${String(email)}`, async () => {
  const f = fixture(null);
  const manager = { id: "user", propertyId: "p", role: "OWNER", isActive: false, passwordHash: "synthetic-credential", email, property: { name: "Property", propertyCode: "1234" } };
  const token = { id: "token", managementUserId: "user", expiresAt: new Date(Date.now() + 100000), usedAt: null, managementUser: manager };
  f.db.emailVerificationToken.findUnique = async () => token;
  f.db.managementUser.findUnique = async () => manager;
  requiredRecord(f.imports["@/lib/email"]).sendWelcomeEmail = async () => assert.fail("No welcome email for missing ownership identity");
  const result = await load("app/api/auth/verify-email/route.ts", f.imports).GET({ url: "https://isolated.invalid/?token=secret" });
  assert.ok(result.url.includes("status=invalid")); assert.equal(f.calls.length, 0); assert.equal(token.usedAt, null);
});
