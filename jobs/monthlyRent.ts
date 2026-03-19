// jobs/monthlyRent.ts

import { prisma } from "@/lib/prisma";

export async function runMonthlyRentJob() {
  const properties = await prisma.property.findMany({
    include: {
      settings: true,
      units: true,
    },
  });

  const now = new Date();

  for (const property of properties) {
    const billingDay = property.settings?.billingDay ?? 1;

    if (now.getDate() !== billingDay) continue;

    for (const unit of property.units) {
      const assignment = await prisma.unitAssignment.findFirst({
        where: {
          unitId: unit.id,
          moveOut: null,
        },
      });

      if (!assignment) continue;

      const rent = Number(unit.marketRent || 0);
      if (rent <= 0) continue;

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantId: assignment.tenantId,
          type: "RENT_CHARGE",
          amount: rent,
          effectiveDate: now,
          memo: "Monthly Rent",
          source: "SYSTEM",
        },
      });
    }
  }

  return { ok: true };
}