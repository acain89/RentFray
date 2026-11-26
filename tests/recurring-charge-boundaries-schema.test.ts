import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { root, normalizePasswordResetSchema, assertApprovedSchemaChange } from "./recurring-charge-boundaries-schema.fixture";

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
