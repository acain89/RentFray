// jobs/delinquency.ts

import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

export async function runDelinquencyJob() {
  const properties = await prisma.property.findMany({
    include: {
      settings: true,
      units: true,
    },
  });

  const now = new Date();

  for (const property of properties) {
    const billingDay = property.settings?.billingDay ?? 1;
    const graceDays = property.settings?.gracePeriodDays ?? 0;

    const dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
    const delinquentDate = new Date(dueDate);
    delinquentDate.setDate(delinquentDate.getDate() + graceDays);

    if (now <= delinquentDate) continue;

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

      await prisma.auditLog.create({
        data: {
          actor: "SYSTEM",
          propertyId: property.id,
          action: "UNIT_DELINQUENT",
          targetType: "UNIT",
          targetId: unit.id,
          payloadSnapshot: {
            balance: summary.balance,
            unitNumber: unit.unitNumber,
            tenantId: assignment.tenantId,
            date: now.toISOString(),
          },
        },
      });
    }
  }

  return { ok: true };
}