import { prisma } from "@/lib/prisma";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampDay(year: number, month: number, day: number) {
  const max = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, max));
}

function getBillingCycle(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function runMonthlyRentJob(asOf = new Date()) {
  const today = startOfDay(asOf);
  const billingCycle = getBillingCycle(today);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      property: true,
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        take: 1,
      },
      recurringFeeItems: {
        where: { isActive: true },
      },
    },
  });

  for (const unit of units) {
    const { property, tier } = unit;
    const assignment = unit.tenantAssignments[0];

    if (!property || !tier || !assignment) continue;

    const dueDay = clampDay(
      today.getFullYear(),
      today.getMonth(),
      tier.rentDueDay
    );

    if (today.getDate() !== dueDay) continue;

    const existingRent = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        billingCycle,
        chargeType: "RENT",
        entryType: "CHARGE",
      },
    });

    if (!existingRent && tier.baseRentCents > 0) {
      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "RENT",
          amountCents: tier.baseRentCents,
          billingCycle,
          effectiveDate: today,
          memo: "Monthly Rent",
        },
      });
    }

    for (const fee of unit.recurringFeeItems) {
      const exists = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          billingCycle,
          chargeType: "RECURRING_FEE",
          memo: fee.label,
        },
      });

      if (exists || fee.amountCents <= 0) continue;

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "RECURRING_FEE",
          amountCents: fee.amountCents,
          billingCycle,
          effectiveDate: today,
          memo: fee.label,
        },
      });
    }
  }

  return { ok: true };
}