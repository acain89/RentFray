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
      recurringFees: {
        where: { isActive: true },
      },
    },
  });

  for (const unit of units) {
    const property = unit.property;
    const tier = unit.tier;
    const assignment = unit.tenantAssignments[0];

    if (!property || !tier || !assignment) continue;

    const billingDay = tier.rentDueDay ?? 1;

    const expectedBillingDay = getClampedBillingDay(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );

    if (today.getDate() !== expectedBillingDay) continue;

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // --- RENT CHARGE ---
    const existingRent = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        entryType: "CHARGE",
        chargeType: "RENT",
        effectiveDate: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
    });

    if (!existingRent) {
      const rentAmount = Number(tier.baseRent || 0);

      if (rentAmount > 0) {
        await prisma.ledgerEntry.create({
          data: {
            propertyId: property.id,
            unitId: unit.id,
            tenantAssignmentId: assignment.id,
            entryType: "CHARGE",
            chargeType: "RENT",
            amount: rentAmount,
            effectiveDate: today,
            memo: "Monthly Rent",
          },
        });
      }
    }

    // --- RECURRING FEES ---
    for (const fee of unit.recurringFees) {
      const existingFee = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          entryType: "CHARGE",
          chargeType: "RECURRING_FEE",
          memo: fee.label,
          effectiveDate: {
            gte: monthStart,
            lt: nextMonth,
          },
        },
      });

      if (existingFee) continue;

      const amount = Number(fee.amount || 0);
      if (amount <= 0) continue;

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "RECURRING_FEE",
          amount,
          effectiveDate: today,
          memo: fee.label,
        },
      });
    }
  }

  return { ok: true };
}