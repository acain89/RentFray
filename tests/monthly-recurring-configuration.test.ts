import { test } from "node:test";
import assert from "node:assert/strict";
import { load, matches, october, november } from "./recurring-charge-configuration.test";

export function monthlyFixture(charges: any[] = []) {
  const calendar = load("lib/rentDates.ts", {});
  const ledger: any[] = [];
  const unit: any = { id: "u", propertyId: "p", unitNumber: "1", isActive: true, tierId: "t",
    property: { id: "p", rentFrayStartDate: new Date("2026-10-01T00:00:00Z"), settings: { rentDueDay: 1 } },
    tier: { id: "t", rentDueDay: 1, baseRentCents: 0 },
    tenantAssignments: [{ id: "assignment", moveInDate: new Date("2026-09-01T12:00:00Z"), isCurrent: true }], recurringFeeItems: [] };
  const db = {
    $queryRaw: async () => [{ locked: true }], $executeRaw: async () => 1,
    unit: { findMany: async ({ cursor }: any) => cursor ? [] : unit.isActive ? [unit] : [] },
    propertyTierCharge: { findMany: async ({ where }: any) => charges.filter(r => matches(r, where)) },
    ledgerEntry: {
      findMany: async ({ where }: any) => ledger.filter(r => matches(r, where)),
      createMany: async ({ data, skipDuplicates }: any) => {
        assert.equal(skipDuplicates, true); let count = 0;
        for (const row of data) if (!ledger.some(r => r.idempotencyKey === row.idempotencyKey)) {
          ledger.push({ id: "ledger-" + ledger.length, voidedAt: null, ...row }); count++;
        }
        return { count };
      },
    },
  };
  const job = load("jobs/monthlyRent.ts", { "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} },
    "@/lib/rentDates": calendar, "@/lib/billingCalendar": { assertTierBillingCalendar: () => 1, BillingCalendarError: class extends Error {} } });
  return { unit, ledger, run: (asOf: Date) => job.runMonthlyRentJob(asOf, "p") };
}
const charge = (id: string, amountCents: number, effectiveDate: Date, effectiveUntil: Date | null = null, tierId = "t") =>
  ({ id, propertyId: "p", tierId, label: "Same label", amountCents, effectiveDate, effectiveUntil, isActive: true, sortOrder: 0 });

test("actual monthly engine catches up October and bills only November replacement; rerun preserves history", async () => {
  const f = monthlyFixture([charge("old", 1000, october, november), charge("new", 2000, november)]);
  await f.run(new Date("2026-11-20T12:00:00Z"));
  assert.deepEqual(f.ledger.map(r => [r.billingCycle, r.amountCents]), [["2026-10", 1000], ["2026-11", 2000]]);
  assert.equal(f.ledger[0].idempotencyKey, "TIER_RECURRING_FEE:u:2026-10:old");
  const before = structuredClone(f.ledger); await f.run(new Date("2026-11-21T12:00:00Z")); assert.deepEqual(f.ledger, before);
});
test("empty November retains October catch-up and excludes canceled pending item", async () => {
  const canceled = { ...charge("canceled", 2000, november), isActive: false };
  const f = monthlyFixture([charge("old", 1000, october, november), canceled]);
  await f.run(new Date("2026-11-20T12:00:00Z")); assert.equal(f.ledger.length, 1); assert.equal(f.ledger[0].billingCycle, "2026-10");
});
test("same-label legitimate items each bill once and NULL end remains open", async () => {
  const f = monthlyFixture([charge("pet", 1000, october), charge("trash", 2000, october)]);
  await f.run(new Date("2026-10-20T12:00:00Z")); await f.run(new Date("2026-10-21T12:00:00Z"));
  assert.deepEqual(f.ledger.map(r => r.amountCents), [1000, 2000]);
});
test("persistent unit fee timing and identity remain unchanged", async () => {
  const f = monthlyFixture(); f.unit.recurringFeeItems = [{ id: "water", label: "Water", amountCents: 2500, createdAt: new Date("2026-09-01T12:00:00Z") },
    { id: "future", label: "Future", amountCents: 3000, createdAt: new Date("2026-10-20T12:00:00Z") }];
  await f.run(new Date("2026-10-21T12:00:00Z")); assert.equal(f.ledger.length, 1);
  assert.equal(f.ledger[0].idempotencyKey, "UNIT_RECURRING_FEE:u:2026-10:water");
});
test("vacancy skips; current tier and replacement assignment determine new obligations", async () => {
  const f = monthlyFixture([charge("other-tier", 9000, october, null, "other"), charge("current", 1000, october)]);
  f.unit.tenantAssignments = []; await f.run(new Date("2026-10-20T12:00:00Z")); assert.equal(f.ledger.length, 0);
  f.unit.tenantAssignments = [{ id: "replacement", moveInDate: new Date("2026-09-01T12:00:00Z") }];
  await f.run(new Date("2026-10-20T12:00:00Z")); assert.equal(f.ledger.length, 1);
  assert.equal(f.ledger[0].tenantAssignmentId, "replacement"); assert.equal(f.ledger[0].amountCents, 1000);
});
