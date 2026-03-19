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
  const properties = await prisma.property.findMany({
    include: {
      settings: true,
      units: {
        include: {
          assignments: {
            where: { moveOut: null },
            take: 1,
          },
        },
      },
    },
  });

  const today = startOfDay(asOf);

  for (const property of properties) {
    const billingDay = property.settings?.billingDay ?? 1;
    const gracePeriodDays = property.settings?.gracePeriodDays ?? 5;

    const dueDay = getClampedBillingDay(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );

    const dueDate = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), dueDay)
    );
    const delinquentDate = startOfDay(addDays(dueDate, gracePeriodDays));

    if (today <= delinquentDate) {
      continue;
    }

    for (const unit of property.units) {
      const activeAssignment = unit.assignments[0];

      if (!activeAssignment) {
        continue;
      }

      const summary = await getUnitLedgerSummary(unit.id);

      if (Number(summary.balance || 0) <= 0) {
        continue;
      }

      const existingLog = await prisma.auditLog.findFirst({
        where: {
          actor: "SYSTEM",
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
          actor: "SYSTEM",
          propertyId: property.id,
          action: "UNIT_DELINQUENT",
          targetType: "UNIT",
          targetId: unit.id,
          payloadSnapshot: {
            balance: summary.balance,
            totalCharges: summary.totalCharges,
            totalPaid: summary.totalPaid,
            unitNumber: unit.unitNumber,
            tenantId: activeAssignment.tenantId,
            dueDate: dueDate.toISOString(),
            delinquentDate: delinquentDate.toISOString(),
            loggedAt: today.toISOString(),
          },
        },
      });
    }
  }

  return { ok: true };
}