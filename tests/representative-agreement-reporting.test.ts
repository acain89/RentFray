import { test } from "node:test";
import assert from "node:assert/strict";
import { stage2Load } from "./representative-stage2-fixture";
import type * as Reports from "../lib/representativeReports";

const now = new Date("2026-11-25T12:00:00Z");
const cases = [
  { status: "UPCOMING", effectiveAt: new Date("2026-12-01T12:00:00Z"), expiresAt: new Date("2029-12-01T12:00:00Z") },
  { status: "ACTIVE", effectiveAt: new Date("2026-11-01T12:00:00Z"), expiresAt: new Date("2029-11-01T12:00:00Z") },
  { status: "EXPIRED", effectiveAt: new Date("2020-11-01T12:00:00Z"), expiresAt: new Date("2023-11-01T12:00:00Z") },
] as const;
for (const agreement of [...cases, null]) test(`report agreement status retains contract: ${agreement?.status ?? "none"}`, async () => {
  let queries = 0;
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray) => { assert.equal(strings.join(""), "SET TRANSACTION READ ONLY"); return 0; },
    $queryRaw: async () => {
      queries++;
      if (queries === 1) return [{ lifetime: BigInt(0), current: BigInt(0) }];
      if (queries === 2) return [];
      if (queries === 3) return [{ cents: BigInt(0) }];
      assert.fail("Unexpected report query");
    },
    representative: { findUnique: async (query: { where: { id: string } }) => { assert.equal(query.where.id, "rep"); return { displayName: "Representative", slug: "representative" }; } },
    representativeAgreement: { findFirst: async () => agreement },
    representativeReferral: { findMany: async () => [], findFirst: async () => null, count: async () => 0 },
    representativePayout: { findMany: async () => [] },
  };
  const report = stage2Load<typeof Reports>("lib/representativeReports.ts", {
    "@/lib/representativeReferrals": { REPRESENTATIVE_ORIGIN: "https://www.rentfray.com" },
    "@/lib/prisma": { prisma: { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const result = await report.getRepresentativeDashboard("rep", {}, now);
  assert.equal(result.agreement?.status ?? null, agreement?.status ?? null);
  assert.equal(result.summary.lifetimeCents, 0); assert.equal(result.summary.currentMonthCents, 0);
  assert.equal(result.summary.paidCents, 0); assert.equal(result.summary.outstandingCents, 0); assert.equal(queries, 3);
});
