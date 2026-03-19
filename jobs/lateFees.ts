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
    const lateFeeDate = startOfDay(addDays(dueDate, gracePeriodDays));

    if (today <= lateFeeDate) {
      continue;
    }

    const lateFeeAmount =
      property.settings?.lateFeeMode === "FLAT"
        ? Number(property.settings?.lateFeeAmount || 0)
        : 0;

    if (lateFeeAmount <= 0) {
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

      const existingLateFee = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          type: "LATE_FEE",
          effectiveDate: {
            gte: dueDate,
            lt: addDays(dueDate, 32),
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
          tenantId: activeAssignment.tenantId,
          type: "LATE_FEE",
          amount: lateFeeAmount,
          effectiveDate: today,
          memo: "Late Fee",
          source: "SYSTEM",
        },
      });
    }
  }

  return { ok: true };
}