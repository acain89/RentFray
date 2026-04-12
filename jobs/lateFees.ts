import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { resolveEffectiveBillingSettings } from "@/lib/rentDates";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function safeDate(d: Date): Date {
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

type LateFeesJobResult = {
  ok: true;
  billingCycle: string;
  posted: number;
  skipped: number;
};

export async function runLateFeesJob(asOf = new Date()): Promise<LateFeesJobResult> {
  const now = safeDate(asOf);
  const effectiveDate = startOfDay(now);
  const monthLabel = getMonthLabel(now);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      property: {
        include: {
          settings: true,
        },
      },
      tier: {
        select: {
          rentDueDay: true,
          gracePeriodDays: true,
          lateFeeInitialCents: true,
          lateFeeDailyCents: true,
          maxLateFeeDays: true,
        },
      },
      tenantAssignments: {
        where: { isCurrent: true },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });

  if (units.length === 0) {
    const billingCycle = `${effectiveDate.getFullYear()}-${String(
      effectiveDate.getMonth() + 1
    ).padStart(2, "0")}`;

    return {
      ok: true,
      billingCycle,
      posted: 0,
      skipped: 0,
    };
  }

  const firstUnit = units[0];
  const firstEffective = resolveEffectiveBillingSettings({
    tier: firstUnit.tier,
    propertySettings: firstUnit.property.settings,
  });

  const billingCycle = `${effectiveDate.getFullYear()}-${String(
    effectiveDate.getMonth() + 1
  ).padStart(2, "0")}`;

  const existingFees = await prisma.ledgerEntry.findMany({
  where: {
    entryType: "CHARGE",
    chargeType: "LATE_FEE",
    billingCycle,
    voidedAt: null,
    unitId: {
      in: units.map((unit: (typeof units)[number]) => unit.id),
    },
  },
  select: {
    unitId: true,
    tenantAssignmentId: true,
  },
});

  const existingKeys = new Set<string>(
    existingFees.map(
      (entry: (typeof existingFees)[number]) =>
        `${entry.unitId}::${entry.tenantAssignmentId ?? ""}`
    )
  );

  let posted = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const unit of units) {
      const assignment = unit.tenantAssignments[0] ?? null;

      if (!assignment) {
        skipped++;
        continue;
      }

      const delinquency = await getUnitDelinquencySummary(unit.id, now);

      if (!delinquency.isDelinquent) {
        skipped++;
        continue;
      }

      const effective = resolveEffectiveBillingSettings({
        tier: unit.tier,
        propertySettings: unit.property.settings,
      });

      const feeCents = effective.lateFeeInitialCents;

      if (feeCents <= 0) {
        skipped++;
        continue;
      }

      const key = `${unit.id}::${assignment.id}`;

      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const existingPayment = await tx.payment.findFirst({
        where: {
          unitId: unit.id,
          billingCycle,
          status: {
            in: ["PENDING", "PAID"],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
        },
      });

      if (existingPayment && existingPayment.createdAt <= effectiveDate) {
        skipped++;
        continue;
      }

      const exists = await tx.ledgerEntry.findFirst({
        where: {
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "LATE_FEE",
          billingCycle,
          voidedAt: null,
        },
        select: { id: true },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await tx.ledgerEntry.create({
        data: {
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "LATE_FEE",
          amountCents: feeCents,
          memo: `Late fee - ${monthLabel}`,
          effectiveDate,
          billingCycle,
          createdByManagementUserId: null,
        },
      });

      posted++;
    }
  });

  void firstEffective;

  return {
    ok: true,
    billingCycle,
    posted,
    skipped,
  };
}