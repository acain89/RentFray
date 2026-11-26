
import assert from "node:assert/strict";


import { resolve } from "node:path";


export const root = resolve(__dirname, "..");
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
  const representativeModels = /\nmodel Representative(?:Agreement|ReferralAlias|Referral|Payout)? \{[\s\S]*?\n\}/g;
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
