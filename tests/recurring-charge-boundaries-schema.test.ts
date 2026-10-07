import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
export function assertApprovedSchemaChange(before: string, after: string) {
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
test("nullable tier boundary is the sole schema change and migration is additive without backfill", () => {
  const file = "prisma/schema.prisma";
  const before = execFileSync("git", ["--no-optional-locks", "show", "HEAD:" + file], { cwd: root, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  const after = readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
  const tier = after.match(/model PropertyTierCharge \{[\s\S]*?\n\}/)![0]; assert.match(tier, /effectiveUntil\s+DateTime\?/);
  assertApprovedSchemaChange(before, after);
  const sql = readFileSync(resolve(root, "prisma/migrations/20261006010000_add_tier_charge_effective_until/migration.sql"), "utf8").trim();
  assert.equal(sql, 'ALTER TABLE "PropertyTierCharge" ADD COLUMN "effectiveUntil" TIMESTAMP(3);');
});
