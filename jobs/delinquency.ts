// jobs/delinquency.ts

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

export async function runDelinquencyJob(asOf = new Date()) {
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

    const dueDay = getClampedBillingDay(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );

    const dueDate = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), dueDay)
    );

    const delinquentDate = startOfDay(addDays(dueDate, gracePeriodDays + 1));

    if (today < delinquentDate) {
      continue;
    }

    const summary = await getUnitLedgerSummary(unit.id);

    if (Number(summary.balance || 0) <= 0) {
      continue;
    }

    const existingLog = await prisma.auditLog.findFirst({
      where: {
        actorType: "SYSTEM",
        propertyId: property.id,
        action: "UNIT_DELINQUENT",
        targetType: "UNIT",
        targetId: unit.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const alreadyLoggedToday =
      existingLog &&
      startOfDay(new Date(existingLog.createdAt)).getTime() === today.getTime();

    if (alreadyLoggedToday) {
      continue;
    }

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        propertyId: property.id,
        action: "UNIT_DELINQUENT",
        targetType: "UNIT",
        targetId: unit.id,
        summary: `Unit ${unit.unitNumber} is delinquent.`,
        metadataJson: JSON.stringify({
          balance: Number(summary.balance || 0),
          totalCharges: Number(summary.totalCharges || 0),
          totalPaid: Number(summary.totalPaid || 0),
          unitNumber: unit.unitNumber,
          tenantAssignmentId: assignment.id,
          dueDate: dueDate.toISOString(),
          delinquentDate: delinquentDate.toISOString(),
          loggedAt: today.toISOString(),
        }),
      },
    });
  }

  return { ok: true };
}