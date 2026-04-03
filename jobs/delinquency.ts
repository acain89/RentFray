import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampDay(year: number, month: number, day: number) {
  const max = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, max));
}

export async function runDelinquencyJob(asOf = new Date()) {
  const today = startOfDay(asOf);

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      property: true,
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        take: 1,
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

    const dueDate = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), dueDay)
    );

    const delinquentDate = startOfDay(
      new Date(dueDate.getTime() + (tier.gracePeriodDays + 1) * 86400000)
    );

    if (today < delinquentDate) continue;

    const summary = await getUnitLedgerSummary(unit.id);
    if (summary.balanceCents <= 0) continue;

    const existing = await prisma.auditLog.findFirst({
      where: {
        action: "UNIT_DELINQUENT",
        targetId: unit.id,
      },
    });

    if (existing) continue;

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        propertyId: property.id,
        action: "UNIT_DELINQUENT",
        targetType: "UNIT",
        targetId: unit.id,
        summary: `Unit ${unit.unitNumber} is delinquent`,
        metadataJson: JSON.stringify({
          balanceCents: summary.balanceCents,
          unitId: unit.id,
        }),
      },
    });
  }

  return { ok: true };
}