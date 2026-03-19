// jobs/lateFees.ts

import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

export async function runLateFeesJob() {
  const properties = await prisma.property.findMany({
    include: {
      settings: true,
      units: true,
    },
  });

  const now = new Date();

  for (const property of properties) {
    const graceDays = property.settings?.gracePeriodDays ?? 0;

    const billingDay = property.settings?.billingDay ?? 1;

    const dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
    const lateDate = new Date(dueDate);
    lateDate.setDate(lateDate.getDate() + graceDays);

    if (now <= lateDate) continue;

    for (const unit of property.units) {
      const assignment = await prisma.unitAssignment.findFirst({
        where: {
          unitId: unit.id,
          moveOut: null,
        },
      });

      if (!assignment) continue;

      const summary = await getUnitLedgerSummary(unit.id);

      if (summary.balance <= 0) continue;

      const existingLateFee = await prisma.ledgerEntry.findFirst({
        where: {
          unitId: unit.id,
          type: "LATE_FEE",
          createdAt: {
            gte: dueDate,
          },
        },
      });

      if (existingLateFee) continue;

      const lateFeeAmount =
        property.settings?.lateFeeMode === "FLAT"
          ? Number(property.settings?.lateFeeAmount || 0)
          : 0;

      if (lateFeeAmount <= 0) continue;

      await prisma.ledgerEntry.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          tenantId: assignment.tenantId,
          type: "LATE_FEE",
          amount: lateFeeAmount,
          effectiveDate: now,
          memo: "Late Fee",
          source: "SYSTEM",
        },
      });
    }
  }

  return { ok: true };
}