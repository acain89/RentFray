import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getRentDateSummary, resolveEffectiveBillingSettings } from "@/lib/rentDates";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getBillingCycle(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function safeDate(date: Date): Date {
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  const billingCycle = getBillingCycle(effectiveDate);
  const effectiveDay = isoDay(effectiveDate);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      property: { include: { settings: true } },
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

  let posted = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const unit of units) {
      const assignment = unit.tenantAssignments[0] ?? null;

      if (!assignment) {
        skipped++;
        continue;
      }

      const effective = resolveEffectiveBillingSettings({
        tier: unit.tier,
        propertySettings: unit.property.settings,
      });

      const delinquency = await getUnitDelinquencySummary(unit.id, now);

      if (!delinquency.isDelinquent || delinquency.daysPastDue <= 0) {
        skipped++;
        continue;
      }

      const existingPayment = await tx.payment.findFirst({
  where: {
    unitId: unit.id,
    tenantAssignmentId: assignment.id,
    billingCycle,
    status: { in: ["PENDING", "PAID"] },
  },
  select: { id: true },
});

      if (existingPayment) {
        skipped++;
        continue;
      }

      const shouldPostInitial = delinquency.daysPastDue >= 1;
      const shouldPostDaily =
        delinquency.daysPastDue >= 2 &&
        effective.lateFeeDailyCents > 0 &&
        delinquency.daysPastDue - 1 <= effective.maxLateFeeDays;

      if (shouldPostInitial && effective.lateFeeInitialCents > 0) {
        const initialExists = await tx.ledgerEntry.findFirst({
          where: {
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "LATE_FEE_INITIAL",
            billingCycle,
            voidedAt: null,
          },
          select: { id: true },
        });

        if (!initialExists) {
          await tx.ledgerEntry.create({
            data: {
              propertyId: unit.propertyId,
              unitId: unit.id,
              tenantAssignmentId: assignment.id,
              entryType: "CHARGE",
              chargeType: "LATE_FEE_INITIAL",
              amountCents: effective.lateFeeInitialCents,
              memo: `Initial late fee - ${billingCycle}`,
              effectiveDate,
              billingCycle,
              createdByManagementUserId: null,
            },
          });

          posted++;
        }
      }

      if (shouldPostDaily) {
        const dailyExists = await tx.ledgerEntry.findFirst({
          where: {
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "LATE_FEE_DAILY",
            memo: `Daily late fee - ${effectiveDay}`,
            voidedAt: null,
          },
          select: { id: true },
        });

        if (dailyExists) {
          skipped++;
          continue;
        }

        await tx.ledgerEntry.create({
          data: {
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "LATE_FEE_DAILY",
            amountCents: effective.lateFeeDailyCents,
            memo: `Daily late fee - ${effectiveDay}`,
            effectiveDate,
            billingCycle,
            createdByManagementUserId: null,
          },
        });

        posted++;
      }

      if (!shouldPostInitial && !shouldPostDaily) {
        skipped++;
      }
    }
  });

  return {
    ok: true,
    billingCycle,
    posted,
    skipped,
  };
}