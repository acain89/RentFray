import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
// Pin the boundary to the approved pre-representative commit, never to mutable HEAD.
const protectedCommit = "34d386ff721e61acd331847c4354dd4dc7525013";
const protectedPaths = [
  "app/api/admin/impersonate/exit/route.ts",
  "app/api/admin/impersonate/route.ts",
  "app/api/admin/properties/[id]/charges/route.ts",
  "app/api/admin/properties/[id]/gplf/route.ts",
  "app/api/admin/properties/[id]/lifecycle/route.ts",
  "app/api/admin/properties/[id]/management-users/reset-password/route.ts",
  "app/api/admin/properties/[id]/management-users/route.ts",
  "app/api/admin/properties/[id]/management-users/support-list/route.ts",
  "app/api/admin/properties/[id]/override/route.ts",
  "app/api/admin/properties/[id]/payment-status/route.ts",
  "app/api/admin/properties/[id]/route.ts",
  "app/api/admin/properties/[id]/setup/route.ts",
  "app/api/admin/properties/[id]/stripe-sync/route.ts",
  "app/api/admin/properties/[id]/tiers/route.ts",
  "app/api/admin/properties/[id]/units/route.ts",
  "app/api/admin/properties/check-code/route.ts",
  "app/api/admin/properties/list/route.ts",
  "app/api/admin/properties/page.module.css",
  "app/api/admin/properties/route.ts",
  "app/api/admin/property/set-status/route.ts",
  "app/api/admin/requests/[id]/route.ts",
  "app/api/admin/requests/list/route.ts",
  "app/api/admin/session/route.ts",
  "app/api/auth/resend-verification/route.ts",
  "app/api/auth/session/route.ts",
  "app/api/auth/verify-email/route.ts",
  "app/api/cron/late-fees/route.ts",
  "app/api/cron/monthly-rent/route.ts",
  "app/api/exports/balances/route.ts",
  "app/api/exports/ledger/route.ts",
  "app/api/exports/payments/route.ts",
  "app/api/ledger/adjust/route.ts",
  "app/api/ledger/charges/route.ts",
  "app/api/ledger/post-recurring-fees/route.ts",
  "app/api/ledger/post-rent/route.ts",
  "app/api/maintenance/dashboard/route.ts",
  "app/api/maintenance/session/route.ts",
  "app/api/manager/account/change-login/route.ts",
  "app/api/manager/audit-log/route.ts",
  "app/api/manager/dashboard/route.ts",
  "app/api/manager/logout/route.ts",
  "app/api/manager/maintenance/pin/route.ts",
  "app/api/manager/maintenance/route.ts",
  "app/api/manager/maintenance/update/route.ts",
  "app/api/manager/onboarding/property/route.ts",
  "app/api/manager/password-recovery/request/route.ts",
  "app/api/manager/password-recovery/reset/route.ts",
  "app/api/manager/property/payment-status/route.ts",
  "app/api/manager/property/qr/route.ts",
  "app/api/manager/property/readiness/route.ts",
  "app/api/manager/property/set-payment-status/route.ts",
  "app/api/manager/property/unit-count/route.ts",
  "app/api/manager/proration/route.ts",
  "app/api/manager/remind/route.ts",
  "app/api/manager/retry/route.ts",
  "app/api/manager/session/route.ts",
  "app/api/manager/setup-complete/route.ts",
  "app/api/manager/tenants/reset-pin/route.ts",
  "app/api/manager/units/delete/route.ts",
  "app/api/manager/units/inactive/route.ts",
  "app/api/manager/units/move-tier/route.ts",
  "app/api/manager/units/toggle-active/route.ts",
  "app/api/manager/units/vacate/route.ts",
  "app/api/manual-payments/route.ts",
  "app/api/notes/route.ts",
  "app/api/payments/create-session/route.ts",
  "app/api/property/resolve/route.ts",
  "app/api/public/property/lookup/route.ts",
  "app/api/public/stats/route.ts",
  "app/api/request-setup/route.ts",
  "app/api/setup/route.ts",
  "app/api/stream/route.ts",
  "app/api/stripe/connect/route.ts",
  "app/api/stripe/onboard/route.ts",
  "app/api/stripe/webhook/route.ts",
  "app/api/tenant/activate/route.ts",
  "app/api/tenant/balance/route.ts",
  "app/api/tenant/dashboard/route.ts",
  "app/api/tenant/ledger/route.ts",
  "app/api/tenant/maintenance/create/route.ts",
  "app/api/tenant/maintenance/list/route.ts",
  "app/api/tenant/maintenance/route.ts",
  "app/api/tenant/me/route.ts",
  "app/api/tenant/payment-history/route.ts",
  "app/api/tenant/payment-receipts/route.ts",
  "app/api/tenant/session/route.ts",
  "app/api/test/load/manager-dashboard/route.ts",
  "app/api/test/load/monthly-rent-cron/route.ts",
  "app/api/test/load/payment-session-preflight/route.ts",
  "app/api/test/load/tenant-dashboard/route.ts",
  "app/property-code/activate/page.tsx",
  "app/property-code/activate/TenantActivateClient.tsx",
  "app/property-code/page.tsx",
  "app/property-code/role/page.tsx",
  "app/property-code/role/RoleSelectClient.tsx",
  "app/tenant/activate/page.tsx",
  "app/tenant/activate/TenantActivateClient.tsx",
  "app/tenant/balance/page.tsx",
  "app/tenant/dashboard/page.tsx",
  "app/tenant/layout.tsx",
  "app/tenant/login/page.tsx",
  "app/tenant/maintenance/page.tsx",
  "app/tenant/page.tsx",
  "app/tenant/pay/page.tsx",
  "app/tenant/payment-history/page.tsx",
  "jobs/delinquency.ts",
  "jobs/lateFees.ts",
  "jobs/monthlyRent.ts",
  "lib/allocatePayment.ts",
  "lib/authThrottle.ts",
  "lib/billingCalendar.ts",
  "lib/billingConfig.ts",
  "lib/checkoutCollectibility.ts",
  "lib/creatorReferrals.ts",
  "lib/creatorSlugRules.ts",
  "lib/dashboard.ts",
  "lib/delinquency.ts",
  "lib/destructiveRetention.ts",
  "lib/email.ts",
  "lib/financialAccess.ts",
  "lib/gracePeriod.ts",
  "lib/lateFees.ts",
  "lib/ledger.ts",
  "lib/liveGating.ts",
  "lib/managementAuth.ts",
  "lib/managementPasswordRecovery.ts",
  "lib/manualFinancialOperations.ts",
  "lib/occupancy.ts",
  "lib/paymentAllocation.ts",
  "lib/paymentStatus.ts",
  "lib/permissions.ts",
  "lib/pin.ts",
  "lib/pinLockout.ts",
  "lib/prisma.ts",
  "lib/propertyCapacity.ts",
  "lib/propertyCode.ts",
  "lib/propertySettings.ts",
  "lib/propertyStatus.ts",
  "lib/proration.ts",
  "lib/qr.ts",
  "lib/rateLimit.ts",
  "lib/realtime.ts",
  "lib/rentDates.ts",
  "lib/rentPreview.ts",
  "lib/resend.ts",
  "lib/session.ts",
  "lib/stats.ts",
  "lib/stripe.ts",
  "lib/stripeAccountStatus.ts",
  "lib/unitFilters.ts",
  "lib/unitFinancialState.ts",
  "lib/unitStatusEngine.ts",
  "prisma/migrations/0_init/migration.sql",
  "prisma/migrations/20260806130000_harden_financial_uniqueness/migration.sql",
  "prisma/migrations/20260813100000_add_email_verification/migration.sql",
  "prisma/migrations/20260814101500_add_setup_complete_acknowledged_at/migration.sql",
  "prisma/migrations/20260914223000_add_ledger_idempotency_key/migration.sql",
  "prisma/migrations/20261005000000_add_auth_throttle_bucket/migration.sql",
  "prisma/migrations/20261006000000_bind_maintenance_request_assignment/migration.sql",
  "prisma/migrations/20261006010000_add_tier_charge_effective_until/migration.sql",
  "prisma/migrations/20261007010000_add_creator_referrals/migration.sql",
  "prisma/migrations/20261012010000_add_management_password_reset_tokens/migration.sql",
  "scripts/check-new-accounts.ts",
  "tests/management-response-security.test.ts"
] as const;
const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, "\n");
function gitContent(ref: string, file: string): string {
  return normalizeLineEndings(execFileSync("git", ["show", `${ref}:${file}`], { cwd: root, encoding: "utf8", windowsHide: true }));
}
function gitContents(ref: string, files: readonly string[]): Map<string, string> {
  const output = execFileSync("git", ["cat-file", "--batch"], { cwd: root, windowsHide: true,
    input: files.map(file => `${ref}:${file}\n`).join(""), maxBuffer: 32 * 1024 * 1024 });
  const contents = new Map<string, string>();
  let offset = 0;
  for (const file of files) {
    const end = output.indexOf(10, offset);
    assert.ok(end >= offset, `${file}: missing Git object header`);
    const header = output.subarray(offset, end).toString("ascii");
    assert.match(header, /^[a-f0-9]+ blob [0-9]+$/, `${file}: expected committed file content`);
    const size = Number(header.split(" ")[2]);
    assert.ok(Number.isSafeInteger(size) && size >= 0);
    offset = end + 1;
    assert.equal(output[offset + size], 10, `${file}: incomplete Git object`);
    contents.set(file, normalizeLineEndings(output.subarray(offset, offset + size).toString("utf8")));
    offset += size + 1;
  }
  assert.equal(offset, output.length);
  return contents;
}
function replaceExactly(source: string, before: string, after: string, count = 1): string {
  assert.equal(source.split(before).length - 1, count, "Approved pre-existing edit must match its pinned source exactly");
  return source.split(before).join(after);
}
// These two non-financial files were already edited before Stage 1. Permit only
// their exact approved working-copy variants as well as their committed content.
// Committed versions are still checked against protectedCommit for all 164 files.
function approvedWorkingCopy(file: string, original: string): string | undefined {
  if (file === "scripts/check-new-accounts.ts") {
    return replaceExactly(replaceExactly(original,
      "  const accounts = await prisma.property.findMany({\n", "  const accounts = await prisma.property.findMany({\n      take: 100,\n"),
      "    take: 20,\n", "");
  }
  if (file === "tests/management-response-security.test.ts") {
    return replaceExactly(original, "require(name: string) {\n", "require(name: string) { if (name === \"@/lib/gracePeriod\") return gracePolicy;\n", 3);
  }
  return undefined;
}
function assertProtectedContent(actual: string, original: string, approved?: string): void {
  const normalized = normalizeLineEndings(actual);
  if (approved !== undefined && normalized === normalizeLineEndings(approved)) return;
  assert.equal(normalized, normalizeLineEndings(original));
}

test("all 164 protected files match the pinned committed baseline and exact pre-existing edits", () => {
  assert.equal(protectedPaths.length, 164);
  assert.equal(new Set(protectedPaths).size, 164);
  const originals = gitContents(protectedCommit, protectedPaths), committed = gitContents("HEAD", protectedPaths);
  for (const file of protectedPaths) {
    const original = originals.get(file)!;
    assert.equal(committed.get(file), original, `${file}: committed protected content changed`);
    assertProtectedContent(readFileSync(resolve(root, file), "utf8"), original, approvedWorkingCopy(file, original));
  }
});

test("boundary normalization accepts CRLF but rejects meaningful edits, whitespace changes and missing final newlines", () => {
  const original = 'status = "PAID";\namountCents = 250;\n';
  assertProtectedContent(original.replace(/\n/g, "\r\n"), original);
  for (const changed of [original.replace("PAID", "PENDING"), original.replace("250", "251"), original.replace(" = ", "="), original.slice(0, -1)]) {
    assert.throws(() => assertProtectedContent(changed, original));
  }
});

test("pre-existing exceptions accept only their precise approved edits and never apply to financial source", () => {
  for (const file of ["scripts/check-new-accounts.ts", "tests/management-response-security.test.ts"]) {
    const original = gitContent(protectedCommit, file), approved = approvedWorkingCopy(file, original)!;
    assertProtectedContent(original, original, approved);
    assertProtectedContent(approved.replace(/\n/g, "\r\n"), original, approved);
    assert.throws(() => assertProtectedContent(approved + "// unauthorized change\n", original, approved));
  }
  assert.equal(approvedWorkingCopy("lib/ledger.ts", "financial source"), undefined);
});

test("existing financial models/enums are unchanged; only five representative models appended", () => {
  const original = execFileSync("git", ["show", "34d386ff721e61acd331847c4354dd4dc7525013:prisma/schema.prisma"], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n").trimEnd();
  const current = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(current.slice(0, original.length), original);
  const added = current.slice(original.length);
  assert.deepEqual([...added.matchAll(/^model (\w+) \{/gm)].map(match => match[1]),
    ["Representative", "RepresentativeReferralAlias", "RepresentativeAgreement", "RepresentativeReferral", "RepresentativePayout"]);
  assert.doesNotMatch(added, /^enum /m);
  assert.doesNotMatch(added, /references: \[.*propertyId/);
  assert.doesNotMatch(added, /Property\??\s+@relation/);
});

test("migration only creates representative tables/indexes and their foreign keys", () => {
  const sql = readFileSync(resolve(root, "prisma/migrations/20261027010000_add_representative_program/migration.sql"), "utf8").replace(/--[^\n]*/g, "");
  const statements = sql.split(";").map(statement => statement.trim()).filter(Boolean);
  for (const statement of statements) assert.match(statement,
    /^(?:CREATE TABLE|CREATE (?:UNIQUE )?INDEX "[^"]+" ON|ALTER TABLE) "Representative(?:Agreement|Referral|Payout)?"[\s(]/);
  assert.equal(statements.filter(statement => statement.startsWith("CREATE TABLE")).length, 4);
  assert.doesNotMatch(sql, /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE TYPE)\b/i);
  assert.doesNotMatch(sql, /REFERENCES "Property"/);
});

test("creator application and reporting source remains unchanged", () => {
  for (const file of ["app/[creatorSlug]/route.ts", "scripts/create-creator.ts", "scripts/check-creator-referrals.ts"]) {
    const original = execFileSync("git", ["show", "34d386ff721e61acd331847c4354dd4dc7525013:" + file], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
    assert.equal(readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n"), original, file);
  }
});

