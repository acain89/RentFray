import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
export function normalizePasswordResetSchema(source: string): string {
  const additions = ["model ManagementPasswordResetToken {\n  id                        String @id @default(cuid())\n  tokenHash                 String @unique\n  managementUserId          String\n  propertyId                String\n  emailSnapshot             String\n  credentialBindingSnapshot String\n  createdAt                 DateTime @default(now())\n  expiresAt                 DateTime\n  usedAt                    DateTime?\n  managementUser ManagementUser @relation(fields: [managementUserId], references: [id], onDelete: Cascade)\n  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)\n\n  @@index([managementUserId])\n  @@index([expiresAt])\n}\n\n","  managementPasswordResetTokens ManagementPasswordResetToken[]\n","  passwordResetTokens        ManagementPasswordResetToken[]\n"];
  if (!source.includes("ManagementPasswordResetToken")) return source;
  for (const addition of additions) {
    assert.equal(source.split(addition).length, 2, "Exactly one approved reset schema addition");
    source = source.replace(addition, "");
  }
  return source;
}

export function assertApprovedSchemaChange(before: string, after: string) {
  // Stage 1 only appends these four models. Their full baseline boundary is
  // independently checked in representative-core-boundary.test.ts.
  const representativeModels = /\nmodel Representative(?:Agreement|Referral|Payout)? \{[\s\S]*?\n\}/g;
  before = before.replace(representativeModels, "").trimEnd();
  after = after.replace(representativeModels, "").trimEnd();
  after = normalizePasswordResetSchema(after);
  before = normalizePasswordResetSchema(before);
  // A baseline already containing the creator models must not have them stripped again.
  if (before === after) return;
  const creatorModels = "model Creator {\n  id        String   @id @default(cuid())\n  name      String\n  slug      String   @unique\n  startsAt  DateTime\n  expiresAt DateTime\n  createdAt DateTime @default(now())\n  referrals CreatorReferral[]\n}\n\nmodel CreatorReferral {\n  id                   String   @id @default(cuid())\n  creatorId            String\n  propertyId           String?  @unique\n  retainedPropertyId   String   @unique\n  businessNameSnapshot String\n  attributedAt         DateTime @default(now())\n  creator              Creator  @relation(fields: [creatorId], references: [id], onDelete: Restrict)\n  property             Property? @relation(fields: [propertyId], references: [id], onDelete: SetNull)\n\n  @@index([creatorId, attributedAt])\n}";
  if (after.includes("model Creator {")) {
    assert.ok(after.endsWith(creatorModels), "Only the exact approved creator models may be appended");
    after = after.slice(0, -creatorModels.length);
    const relation = "  creatorReferral             CreatorReferral?\n";
    assert.equal(after.split(relation).length, 2, "Only one creator relation added to Property");
    after = after.replace(relation, "").trimEnd();
    before = before.trimEnd();
  }
  if (before === after) return;
  assert.equal(after.replace(/^\s*effectiveUntil\s+DateTime\?[^\n]*\n/m, ""), before);
}
export function assertApprovedMonthlyChange(before: string, after: string) {
  if (before === after) return;
  const expected = before
    .replace('const MONTHLY_RENT_JOB_LOCK_ID = 91024001;\n', 'const MONTHLY_RENT_JOB_LOCK_ID = 91024001;\n\ntype TierRecurringCharge = PropertyTierCharge & { effectiveUntil: Date | null };\n')
    .replace('const tierCharges =', 'const tierCharges: TierRecurringCharge[] =')
    .replace('Map<string, PropertyTierCharge[]>', 'Map<string, TierRecurringCharge[]>')
    .replace('const chargeStartDate = getBusinessDate(charge.effectiveDate);\n          if (chargeStartDate.getTime() > dueDate.getTime()) continue;',
      'if (charge.effectiveDate.getTime() > dueDate.getTime()) continue;\n          if (charge.effectiveUntil && dueDate.getTime() >= charge.effectiveUntil.getTime()) continue;');
  assert.equal(after, expected);
}
export function assertApprovedProvisioningChange(before: string, after: string) {
  assert.ok(!after.includes('memo: "Initial recurring fees setup"'));
  if (before === after) return;
  const expected = before
    .replace('          const recurringTotal = getRecurringChargeTotal(tier.charges || []);\n', '')
    .replace(/            const recurringTotalCents = toCents\(recurringTotal\);\n\n            if \(recurringTotalCents > 0\) \{\n[\s\S]*?            \}\n/, '');
  assert.equal(after, expected);
}
test("tier boundary and approved creator additions preserve existing schema; RF-01 migration remains additive without backfill", () => {
  const file = "prisma/schema.prisma";
  const before = execFileSync("git", ["--no-optional-locks", "show", "HEAD:" + file], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  const after = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
  const tier = after.match(/model PropertyTierCharge \{[\s\S]*?\n\}/)![0]; assert.match(tier, /effectiveUntil\s+DateTime\?/);
  assertApprovedSchemaChange(before, after);
  const sql = readFileSync(resolve(root, "prisma/migrations/20261006010000_add_tier_charge_effective_until/migration.sql"), "utf8").trim();
  assert.equal(sql, 'ALTER TABLE "PropertyTierCharge" ADD COLUMN "effectiveUntil" TIMESTAMP(3);');
});

test("identical committed creator schema passes but unapproved schema changes fail", () => {
  const committed = execFileSync("git", ["show", "24e5d002f69e8ee7cecb64435b4f88a7e6b3ca59:prisma/schema.prisma"], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
  assert.doesNotThrow(() => assertApprovedSchemaChange(committed, committed));
  assert.throws(() => assertApprovedSchemaChange(committed, committed.replace("slug      String   @unique", "slug      String")));
  assert.throws(() => assertApprovedSchemaChange(committed, committed.replace("onDelete: Restrict", "onDelete: Cascade")));
});

test("reset schema normalization rejects altered token and existing financial authorities", () => {
  const source = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
  const original = normalizePasswordResetSchema(source);
  assert.doesNotThrow(() => assertApprovedSchemaChange(original, source));
  for (const changed of [source.replace("  tokenHash                 String @unique", "  tokenHash                 String"), source.replace("  credentialBindingSnapshot String", "  credentialBindingSnapshot String?"), source.replace("@@unique([propertyId, username])", "@@index([propertyId, username])"), source.replace("onDelete: Restrict", "onDelete: Cascade")]) {
    assert.throws(() => assertApprovedSchemaChange(original, changed));
  }
});
