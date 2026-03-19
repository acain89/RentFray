// jobs/monthlyRent.ts

import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getClampedBillingDay(
  year: number,
  monthIndex: number,
  billingDay: number
) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(billingDay, lastDayOfMonth));
}

export async function runMonthlyRentJob(asOf = new Date()) {
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

    const expectedBillingDay = getClampedBillingDay(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );

    if (today.getDate() !== expectedBillingDay) {
      continue;
    }

    for (const unit of property.units) {
      const activeAssignment = unit.assignments[0];

      if (!activeAssignment) {
        continue;
      }

      const rent = Number(unit.marketRent || 0);

      if (rent <= 0) {
        continue;
      }

      const existingCharge = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          type: "RENT_CHARGE",
          effectiveDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
      });

      if (existingCharge) {
        continue;
      }

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantId: activeAssignment.tenantId,
          type: "RENT_CHARGE",
          amount: rent,
          effectiveDate: today,
          memo: "Monthly Rent",
          source: "SYSTEM",
        },
      });
    }
  }

  return { ok: true };
}