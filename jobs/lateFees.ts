// jobs/lateFees.ts

import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getClampedBillingDay(
  year: number,
  monthIndex: number,
  billingDay: number
) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(billingDay, lastDayOfMonth));
}

export async function runLateFeesJob(asOf = new Date()) {
  const today = startOfDay(asOf);

  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
    },
    include: {
      property: true,
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  for (const unit of units) {
    const property = unit.property;
    const tier = unit.tier;
    const assignment = unit.tenantAssignments[0];

    if (!property || !tier || !assignment) continue;

    const billingDay = Number(tier.rentDueDay || 1);
    const gracePeriodDays = Number(tier.gracePeriodDays || 0);
    const lateFeeAmount = Number(tier.lateFeeInitial || 0);

    if (lateFeeAmount <= 0) continue;

    const dueDay = getClampedBillingDay(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );

    const dueDate = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), dueDay)
    );

    // charge on day after grace expires
    const lateFeeDate = startOfDay(addDays(dueDate, gracePeriodDays + 1));

    if (today.getTime() !== lateFeeDate.getTime()) {
      continue;
    }

    const summary = await getUnitLedgerSummary(unit.id);

    if (Number(summary.balance || 0) <= 0) {
      continue;
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const existingLateFee = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        entryType: "CHARGE",
        chargeType: "LATE_FEE",
        effectiveDate: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
      orderBy: {
        effectiveDate: "desc",
      },
    });

    if (existingLateFee) {
      continue;
    }

    await prisma.ledgerEntry.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        entryType: "CHARGE",
        chargeType: "LATE_FEE",
        amount: lateFeeAmount,
        effectiveDate: today,
        memo: "Initial late fee",
      },
    });
  }

  return { ok: true };
}