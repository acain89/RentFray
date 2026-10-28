import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { stage3Fixture } from "./representative-stage3-fixture";
import { stage2Load, representativeRequest } from "./representative-stage2-fixture";

test("USD validation is exact integer cents, with no floating-point rounding", () => {
  const { admin } = stage3Fixture({});
  for (const [value, cents] of [["0.01", 1], ["125", 12500], ["12.5", 1250], ["21474836.47", 2147483647]] as const) assert.equal(admin.representativeUsdCents(value), cents);
  for (const value of [0.01, "0", "-1", "1.001", "1e3", "21474836.48", "01.00", "NaN"]) assert.throws(() => admin.representativeUsdCents(value));
});
test("administrative dates preserve Chicago midnight on DST days", () => {
  const { admin } = stage3Fixture({});
  assert.equal(admin.representativeAdminDate("2026-11-01").toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(admin.representativeAdminDate("2026-03-08").toISOString(), "2026-03-08T06:00:00.000Z");
  assert.equal(admin.representativeAdminDate("2024-02-29").toISOString(), "2024-02-29T06:00:00.000Z");
  assert.throws(() => admin.representativeAdminDate("2026-02-30"));
});
test("schema adds exactly one nullable field and migration contains only ADD COLUMN", () => {
  const before = execFileSync("git", ["show", "ceac0e18bb8992198128ec358483f4ee29ad66ed:prisma/schema.prisma"], { encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  const current = readFileSync("prisma/schema.prisma", "utf8").replace(/\r\n/g, "\n")
    .replace("  referralAliases          RepresentativeReferralAlias[]\n", "")
    .replace(/\nmodel RepresentativeReferralAlias \{[\s\S]*?\n\}\n/, "");
  const addition = "  commissionEligibleFrom DateTime? @db.Timestamptz(3)\n";
  assert.equal(current.split(addition).length, 2); assert.equal(current.replace(addition, ""), before);
  assert.equal(readFileSync("prisma/migrations/20261027020000_add_representative_eligibility_timestamp/migration.sql", "utf8").trim(),
    'ALTER TABLE "RepresentativeReferral" ADD COLUMN "commissionEligibleFrom" TIMESTAMPTZ(3);');
});
test("admin guard rejects every non-admin role before database or work execution", async () => {
  for (const role of [null, "OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE", "REPRESENTATIVE"]) {
    let worked = false;
    const { admin } = stage3Fixture({}, undefined, { session: { getSession: async () => role ? { role, adminAccessId: "forged" } : null } });
    const response = await admin.runRepresentativeAdmin(representativeRequest("/api/admin/representatives"), false, async () => { worked = true; });
    assert.equal(response.status, role ? 403 : 401); assert.equal(worked, false);
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
  }
});
test("admin mutations require same origin and strict authority revalidation", async () => {
  let strict = false;
  const { admin } = stage3Fixture({}, undefined, { session: { getSession: async (options: { strictAuthority: boolean }) => { strict = options.strictAuthority; return { role: "ADMIN", adminAccessId: "actual-admin" }; } } });
  const response = await admin.runRepresentativeAdmin(representativeRequest("/api/admin/representatives", {}, "https://evil.invalid"), true, async () => {});
  assert.equal(response.status, 403); assert.equal(strict, true);
});
test("later-authorization input cannot supply dates, another representative, or mutable business clocks", () => {
  const { admin } = stage3Fixture({});
  for (const field of ["commissionEligibleFrom", "businessCreatedAt", "businessExpiresAt", "representativeId", "approvedByAdminId"]) {
    assert.throws(() => admin.representativeAdminFields({ agreementId: "approved", [field]: "spoofed" }, ["agreementId"]));
  }
});
test("all admin API handlers use the shared admin-only wrapper", async () => {
  const paths = ["route.ts", "[id]/route.ts", "[id]/agreements/route.ts", "[id]/referrals/[referralId]/route.ts", "[id]/payouts/route.ts", "[id]/password-reset/route.ts"];
  for (const path of paths) {
    let checked = false;
    const route = stage2Load<Record<string, (request: Request, context: unknown) => Promise<Response>>>("app/api/admin/representatives/" + path, {
      "@/lib/representativeAdmin": { runRepresentativeAdmin: async () => { checked = true; return new Response(null, { status: 403 }); } },
    });
    for (const method of Object.keys(route).filter(key => ["GET", "POST", "PATCH"].includes(key))) {
      assert.equal((await route[method](representativeRequest("/", method === "GET" ? undefined : {}), { params: Promise.resolve({ id: "rep", referralId: "ref" }) })).status, 403);
      assert.equal(checked, true); checked = false;
    }
  }
});
test("administration has no financial execution paths, and later authorization updates only the grant fields", () => {
  const source = readFileSync("lib/representativeAdmin.ts", "utf8");
  assert.doesNotMatch(source, /@\/lib\/(?:stripe|ledger|billing|payment)|\.payment\.(?:create|update|delete)|\.ledgerEntry\.(?:create|update|delete)/);
  assert.match(source, /data: \{ authorizingAgreementId: agreementId, commissionEligibleFrom: now \}/);
  assert.match(source, /REPRESENTATIVE_BUSINESS_AUTHORIZED/); assert.match(source, /REPRESENTATIVE_PAYOUT_RECORDED/);
});
