import { prisma } from "@/lib/prisma";
import {
  resolveEffectiveBillingSettings,
  getRentDateSummary,
} from "@/lib/rentDates";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function runMonthlyRentJob(asOf = new Date()) {
  const today = startOfDay(asOf);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      property: { include: { settings: true } },
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      recurringFeeItems: {
        where: { isActive: true },
      },
    },
  });

  for (const unit of units) {
    const assignment = unit.tenantAssignments[0];
    if (!assignment) continue;

    const effective = resolveEffectiveBillingSettings({
      tier: unit.tier,
      propertySettings: unit.property.settings,
    });

    const rentDates = getRentDateSummary({
      ...effective,
      now: today,
    });

    const billingCycle = rentDates.billingCycle;
    const dueDate = new Date(rentDates.dueDate);

    // ✅ Allow posting ANY time on/after due date (no exact-day dependency)
    if (today < dueDate) continue;

    // --- RENT ---
    const existingRent = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        billingCycle,
        chargeType: "RENT",
        entryType: "CHARGE",
        voidedAt: null,
      },
    });

    if (!existingRent && unit.tier?.baseRentCents > 0) {
      await prisma.ledgerEntry.create({
        data: {
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "RENT",
          amountCents: unit.tier.baseRentCents,
          billingCycle,
          effectiveDate: dueDate,
          memo: "Monthly Rent",
        },
      });
    }

    // --- RECURRING FEES ---
    for (const fee of unit.recurringFeeItems) {
      if (fee.amountCents <= 0) continue;

      const exists = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          billingCycle,
          chargeType: "RECURRING_FEE",
          memo: fee.label,
          voidedAt: null,
        },
      });

      if (exists) continue;

      await prisma.ledgerEntry.create({
        data: {
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantAssignmentId: assignment.id,
          entryType: "CHARGE",
          chargeType: "RECURRING_FEE",
          amountCents: fee.amountCents,
          billingCycle,
          effectiveDate: dueDate,
          memo: fee.label,
        },
      });
    }
  }

  return { ok: true };
}