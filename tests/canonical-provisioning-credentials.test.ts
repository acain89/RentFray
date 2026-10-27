import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture, load, request } from "./management-role-authorization.test";
import { assertApprovedProvisioningChange } from "./recurring-charge-boundaries-schema.test";
import { assertApprovedDraftChange } from "./admin-draft-credential-safety.test";
import { assertApprovedCredentialChange } from "./management-credential-revocation.test";

export function assertApprovedRecoveryEmailChange(before: string, after: string): void {
  if (before === after) return;
  const addition = "export async function sendPasswordRecoveryEmail(input: { email: string; token: string }): Promise<void> {\n  const origin = process.env.NODE_ENV === \"production\" ? \"https://www.rentfray.com\" : getBaseUrl();\n  const url = new URL(origin);\n  if (process.env.NODE_ENV !== \"production\" && ![\"localhost\", \"127.0.0.1\", \"[::1]\"].includes(url.hostname)) {\n    throw new Error(\"Invalid recovery email configuration.\");\n  }\n  const resetUrl = `${url.origin}/login/manager/reset-password#token=${encodeURIComponent(input.token)}`;\n  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: input.email,\n    subject: \"Reset your RentFray password\", html: `<p>A password reset was requested for your RentFray management account.</p><p><a href=\"${escapeHtml(resetUrl)}\">Reset password</a></p><p>This link expires in 30 minutes. Only the latest link can be used. If you did not request this, ignore this email.</p>` });\n  if (error) throw new Error(\"Password recovery email delivery failed.\");\n}\n\n";
  assert.equal(after.split(addition).length, 2, "Exactly one approved reset email function");
  assert.equal(after.replace(addition, ""), before, "All verification-email behavior preserved");
}

const root = resolve(__dirname, "..");
for (const kind of ["public", "admin"] as const) for (const mailFailure of [false, true]) {
  test(kind + " provisioning retains bcrypt, one OWNER and verification; mailFailure=" + mailFailure, async () => {
    const f = fixture(kind === "admin" ? "ADMIN" : null); let committed = false, emails = 0;
    f.imports["@prisma/client"].Prisma.TransactionIsolationLevel.ReadCommitted = "ReadCommitted";
    f.db.property.findUnique = async () => null;
    f.db.$transaction = async (fn: any) => { const result = await fn(f.db); committed = true; return result; };
    const password = "isolated-password-123";
    f.imports["bcryptjs"] = { hash: async (value: string, cost: number) => {
      assert.equal(value, password); assert.equal(cost, kind === "public" ? 12 : 10); return bcrypt.hash(value, cost);
    } };
    f.imports["@/lib/email"].sendVerificationEmail = async (input: any) => {
      assert.equal(committed, true); assert.equal(input.email, "owner@example.invalid"); assert.ok(input.managementUserId); emails++;
      if (mailFailure) throw Error("isolated mail unavailable");
    };
    // No referral cookie: exercise unchanged canonical provisioning.
    f.imports["next/headers"] = { cookies: async () => ({ get: () => undefined }) };
    f.imports["@/lib/representativeReferrals"] = { readRepresentativeReferral: () => null, attributeRepresentative: async () => false,
      REPRESENTATIVE_COOKIE: "rf_representative_referral", representativeCookieOptions: {} };
    f.imports["@/lib/creatorReferrals"] = { attributeCreator: async (_tx: unknown, cookie: unknown) => {
      assert.equal(cookie, undefined); return false;
    }, REFERRAL_COOKIE: "rf_creator_referral", referralCookieOptions: {} };
    const file = kind === "public" ? "app/api/setup/create-account/route.ts" : "app/api/admin/properties/route.ts";
    const payload = kind === "public" ? { firstName: "Test", lastName: "Owner", email: "owner@example.invalid", password }
      : { account: { email: "owner@example.invalid", password, fullName: "Test Owner" }, property: { name: "Property", address: "Address" },
        tiers: [{ name: "Tier", unitLabels: "1", baseRent: 0, dueDay: 1, graceDays: 0, lateFeeInitial: 0, lateFeeDaily: 0, lateFeeMaxDays: 0 }] };
    const result = await load(file, f.imports).POST(request(payload)); assert.equal(result.status, 200);
    const owners = f.calls.filter(row => row[0] === "managementUser.create"); assert.equal(owners.length, 1);
    const data = owners[0][1].data; assert.equal(data.role, "OWNER"); assert.ok(data.passwordHash.startsWith("$2"));
    assert.equal(await bcrypt.compare(password, data.passwordHash), true); assert.ok(!data.passwordHash.includes("plain:"));
    assert.equal(data.isActive, kind === "admin"); assert.equal(emails, 1);
    assert.equal(result.body.verificationEmailSent, !mailFailure); assert.equal(f.calls.some(row => row[0] === "session"), false);
    const serialized = JSON.stringify(result.body); assert.ok(!serialized.includes(password)); assert.ok(!serialized.includes(data.passwordHash));
    assert.ok(!serialized.includes("tokenHash")); assert.ok(!serialized.includes("passwordHash"));
  });
}
test("canonical provisioning, verification, compatibility and hard-start authorities remain unchanged", () => {
    const restoreAUD06Session = (source: string): string => {
      let restored = source.replace(/\r\n/g, "\n");
      const deltas: Array<[string, string, number]> = [
  [
    "",
    "export type SessionValidationOptions = Readonly<{ strictAuthority?: boolean }>;\n\n// Only errors created by session authorization may become 401/403 responses.\nexport class SessionAuthorizationError extends Error {\n  readonly status: 401 | 403;\n  constructor(status: 401 | 403) {\n    super(status === 401 ? \"Unauthorized\" : \"Forbidden\");\n    this.name = \"SessionAuthorizationError\";\n    this.status = status;\n  }\n}\n\n",
    1
  ],
  [
    "async function hasCurrentManagementAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentManagementAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentTenantAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentTenantAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "export async function validateSessionToken(token: string): Promise<SessionPayload | null> {",
    "export async function validateSessionToken(token: string, options: SessionValidationOptions = {}): Promise<SessionPayload | null> {",
    1
  ],
  [
    "export async function getSession() {",
    "export async function getSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireSession() {",
    "export async function requireSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireRole(role: SessionRole) {",
    "export async function requireRole(role: SessionRole, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function refreshSessionCookie(session: SessionPayload) {",
    "export async function refreshSessionCookie(session: SessionPayload, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "} catch {\n    return false;",
    "} catch (error) {\n    if (options.strictAuthority) throw error;\n    return false;",
    2
  ],
  [
    "} catch {\n      return false;",
    "} catch (error) {\n      if (options.strictAuthority) throw error;\n      return false;",
    2
  ],
  [
    "hasCurrentManagementAuthority(session)",
    "hasCurrentManagementAuthority(session, options)",
    2
  ],
  [
    "hasCurrentTenantAuthority(session)",
    "hasCurrentTenantAuthority(session, options)",
    2
  ],
  [
    "hasCurrentAuthority(session)",
    "hasCurrentAuthority(session, options)",
    3
  ],
  [
    "validateSessionToken(token)",
    "validateSessionToken(token, options)",
    1
  ],
  [
    "getSession()",
    "getSession(options)",
    1
  ],
  [
    "requireSession()",
    "requireSession(options)",
    1
  ],
  [
    "throw new Error(\"Unauthorized\");",
    "throw new SessionAuthorizationError(401);",
    5
  ],
  [
    "throw new Error(\"Forbidden\");",
    "throw new SessionAuthorizationError(403);",
    1
  ]
];
      for (const [original, approved, count] of deltas) {
        assert.equal(restored.split(approved).length - 1, count, "Exact AUD-06 session delta: " + approved);
        restored = restored.split(approved).join(original);
      }
      return restored;
    };
  for (const file of ["app/api/setup/create-account/route.ts", "app/setup/page.tsx", "app/api/admin/properties/route.ts", "app/admin/properties/new/page.tsx",
    "app/api/auth/verify-email/route.ts", "lib/email.ts", "lib/managementAuth.ts", "lib/session.ts", "proxy.ts", "lib/billingCalendar.ts",
    "app/api/admin/properties/[id]/route.ts", "app/api/admin/properties/[id]/lifecycle/route.ts", "app/api/admin/properties/[id]/override/route.ts"]) {
    const baseline = file === "app/api/admin/properties/[id]/override/route.ts"
      ? "072eb51fdabd8f53d31b8a382e7b8fa513cab234"
      : "eda6c70dafc95079b2757d7ed5139ee03a225e5c";
    const before = execFileSync("git", ["--no-optional-locks", "show", baseline + ":" + file], { cwd: root, encoding: "utf8", windowsHide: true });
    let after = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
    // The approved starting HEAD already contains the grace-period validation
    // changes in these protected files. Pin every byte to that approved version
    // rather than comparing them with the older pre-grace historical baseline.
    if (["app/api/admin/properties/route.ts", "app/admin/properties/new/page.tsx", "app/api/admin/properties/[id]/route.ts"].includes(file)) {
      const approved = execFileSync("git", ["--no-optional-locks", "show", "34d386ff721e61acd331847c4354dd4dc7525013:" + file],
        { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
      assert.equal(after, approved, "Protected approved baseline: " + file);
      continue;
    }
    // Reverse only the exact approved referral insertions; all prior authority
    // assertions still compare every remaining byte against their original baseline.
    const removeOnce = (value: string) => {
      assert.equal(after.split(value).length, 2, "exactly one approved referral insertion");
      after = after.replace(value, "");
    };
    if (file === "app/api/setup/create-account/route.ts") {
      for (const insertion of [
        'import { attributeRepresentative, readRepresentativeReferral, REPRESENTATIVE_COOKIE, representativeCookieOptions } from "@/lib/representativeReferrals";\n',
        '    const representativeTouch = readRepresentativeReferral((await cookies()).get(REPRESENTATIVE_COOKIE)?.value);\n',
        '            createdAt: true,\n',
        '        const representativeAttributed = await attributeRepresentative(tx, representativeTouch, property, "RENTFRAY");\n',
        '          representativeAttributed,\n',
        'if (result.representativeAttributed) response.cookies.set(REPRESENTATIVE_COOKIE, "", { ...representativeCookieOptions, maxAge: 0 });\n',
      ]) removeOnce(insertion);
      const approvedRegistrationChanges: Array<[string, string]> = [
  [
    "function clean(value: unknown): string {",
    "class RegistrationConflictError extends Error {\n  constructor() { super(\"An account with that email already exists.\"); }\n}\n\nfunction logSignupFailure(stage: \"account_creation\" | \"verification_email\", error: unknown): void {\n  const code = typeof error === \"object\" && error !== null && \"code\" in error &&\n    typeof error.code === \"string\" && /^(P[0-9]{4}|40001|40P01|55P03)$/.test(error.code)\n    ? error.code : undefined;\n  console.error(\"Public signup failed:\", { stage, category: code ? \"DATABASE_ERROR\" : \"UNEXPECTED_ERROR\", ...(code ? { code } : {}) });\n}\n\nfunction clean(value: unknown): string {"
  ],
  [
    "    const existingManager = await prisma.managementUser.findFirst({\n      where: {\n        OR: [\n          {\n            email,\n          },\n          {\n            username: email,\n          },\n        ],\n      },\n      select: {\n        id: true,\n      },\n    });\n\n    if (existingManager) {\n      return NextResponse.json(\n        {\n          ok: false,\n          error: \"An account with that email already exists.\",\n        },\n        {\n          status: 409,\n        }\n      );\n    }\n\n    const passwordHash",
    "    const passwordHash"
  ],
  [
    "      async (tx: Prisma.TransactionClient) => {\n",
    "      async (tx: Prisma.TransactionClient) => {\n        // Two-integer keys occupy a separate advisory-lock space from existing\n        // single-key property/tenancy locks. Read the identity only after waiting.\n        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${\"public-registration\"}), hashtext(${email}))`;\n        const existingManager = await tx.managementUser.findFirst({\n          where: { OR: [{ email }, { username: email }] },\n          select: { id: true },\n        });\n        if (existingManager) throw new RegistrationConflictError();\n\n"
  ],
  [
    "    maxWait: 10_000,\n",
    "    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,\n    maxWait: 10_000,\n"
  ],
  [
    "  console.error(\"Initial verification email failed:\", error);",
    "  logSignupFailure(\"verification_email\", error);"
  ],
  [
    "    console.error(\"Create manager account failed:\", error);\n\n    const message =\n      error instanceof Error\n        ? error.message\n        : \"Could not create your account.\";",
    "    if (error instanceof RegistrationConflictError) {\n      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });\n    }\n    logSignupFailure(\"account_creation\", error);\n    const message = \"Could not create your account.\";"
  ]
];
      for (const [original, approved] of approvedRegistrationChanges.reverse()) {
        assert.equal(after.split(approved).length, 2, "Exactly one approved registration change must remain present");
        after = after.replace(approved, original);
      }
      for (const insertion of [
        'import { cookies } from "next/headers";\nimport { attributeCreator, REFERRAL_COOKIE, referralCookieOptions } from "@/lib/creatorReferrals";\n',
        '    const referralCookie = (await cookies()).get(REFERRAL_COOKIE)?.value;\n',
        '            name: true,\n',
        '        const attributed = await attributeCreator(tx, referralCookie, property);\n\n',
        '          attributed,\n',
        'if (result.attributed) response.cookies.set(REFERRAL_COOKIE, "", { ...referralCookieOptions, maxAge: 0 });\nreturn response;\n',
      ]) removeOnce(insertion.replace(/\\n/g, "\n"));
      assert.equal(after.split('const response = NextResponse.json({').length, 2);
      after = after.replace('const response = NextResponse.json({', 'return NextResponse.json({');
    }
    if (file === "proxy.ts") {
      removeOnce('  // The representative portal validates its own dedicated session server-side.\n' +
        '  if (/^\\/r\\/portal\\/?$/.test(pathname)) {\n' +
        '    const response = NextResponse.next();\n' +
        '    response.headers.set("Cache-Control", "private, no-store");\n' +
        '    response.headers.set("Referrer-Policy", "no-referrer");\n' +
        '    return response;\n  }\n\n');
      removeOnce('  // Only the representative redirect shape is public; the handler validates slugs.\n' +
        '  if (/^\\/r\\/[a-z][a-z0-9-]{1,47}\\/?$/i.test(pathname) && !/^\\/r\\/portal\\/?$/i.test(pathname)) {\n' +
        '    return NextResponse.next();\n  }\n\n');
      removeOnce('import { prisma } from "@/lib/prisma";\nimport { isCreatorSlug, normalizeCreatorSlug } from "@/lib/creatorSlugRules";\n'.replace(/\\n/g, "\n"));
      const block = '  // Only an existing, nonreserved, single-segment creator URL is public.\n' +
        '  const candidate = /^\\/([^/]+)\\/?$/.exec(pathname)?.[1];\n' +
        '  const creatorSlug = candidate ? normalizeCreatorSlug(candidate) : "";\n' +
        '  if (isCreatorSlug(creatorSlug)) {\n    try {\n' +
        '      if (await prisma.creator.findUnique({ where: { slug: creatorSlug }, select: { id: true } })) {\n' +
        '        return NextResponse.next();\n      }\n    } catch {\n' +
        '      // Keep existing authentication routing on database/schema unavailability.\n    }\n  }\n\n';
      removeOnce(block.replace(/\\n/g, "\n").replace(/\\\\/g, "\\"));
      assert.equal(after.split('export async function proxy(').length, 2);
      after = after.replace('export async function proxy(', 'export function proxy(');
    }
    if (file === "app/api/admin/properties/route.ts") assertApprovedProvisioningChange(before.replace(/\r\n/g, "\n"), after);
    else if (file === "app/admin/properties/new/page.tsx") assertApprovedDraftChange(before.replace(/\r\n/g, "\n"), after);
    else if (file === "lib/session.ts") assertApprovedCredentialChange(file, before, restoreAUD06Session(after));
    else if (file === "app/api/auth/verify-email/route.ts") assertApprovedCredentialChange(file, before, after);
    else if (file === "proxy.ts") {
      const original = before.replace(/\r\n/g, "\n");
      const anchor = '  "/role-select",\n';
      assert.equal(original.split(anchor).length, 2, "one public-page insertion point");
      assert.equal(after, original.replace(anchor, anchor + '  "/verify-email",\n'),
        "Only RF-12 verification recovery page admission changed");
    }
    else if (file === "lib/email.ts") assertApprovedRecoveryEmailChange(before.replace(/\r\n/g, "\n"), after);
    else assert.equal(after, before.replace(/\r\n/g, "\n"), file);
  }
});

test("recovery email normalization rejects verification and destination mutations", () => {
  const after = readFileSync(resolve(root, "lib/email.ts"), "utf8").replace(/\r\n/g, "\n");
  const addition = "export async function sendPasswordRecoveryEmail(input: { email: string; token: string }): Promise<void> {\n  const origin = process.env.NODE_ENV === \"production\" ? \"https://www.rentfray.com\" : getBaseUrl();\n  const url = new URL(origin);\n  if (process.env.NODE_ENV !== \"production\" && ![\"localhost\", \"127.0.0.1\", \"[::1]\"].includes(url.hostname)) {\n    throw new Error(\"Invalid recovery email configuration.\");\n  }\n  const resetUrl = `${url.origin}/login/manager/reset-password#token=${encodeURIComponent(input.token)}`;\n  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: input.email,\n    subject: \"Reset your RentFray password\", html: `<p>A password reset was requested for your RentFray management account.</p><p><a href=\"${escapeHtml(resetUrl)}\">Reset password</a></p><p>This link expires in 30 minutes. Only the latest link can be used. If you did not request this, ignore this email.</p>` });\n  if (error) throw new Error(\"Password recovery email delivery failed.\");\n}\n\n";
  const before = after.replace(addition, "");
  assert.doesNotThrow(() => assertApprovedRecoveryEmailChange(before, after));
  assert.throws(() => assertApprovedRecoveryEmailChange(before, after.replace("24 * 60 * 60 * 1000", "60 * 1000")));
  assert.throws(() => assertApprovedRecoveryEmailChange(before, after.replace("https://www.rentfray.com", "https://attacker.invalid")));
});
