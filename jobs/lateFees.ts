import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";

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

export async function runLateFeesJob(asOf = new Date()) {
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
    },
  });

  for (const unit of units) {
    const { property, tier } = unit;
    const assignment = unit.tenantAssignments[0];

    if (!property || !tier || !assignment) continue;
    if (tier.lateFeeInitialCents <= 0) continue;

    const dueDay = clampDay(
      today.getFullYear(),
      today.getMonth(),
      tier.rentDueDay
    );

    const dueDate = startOfDay(
      new Date(today.getFullYear(), today.getMonth(), dueDay)
    );

    const lateDate = startOfDay(
      new Date(dueDate.getTime() + (tier.gracePeriodDays + 1) * 86400000)
    );

    if (today.getTime() !== lateDate.getTime()) continue;

    const summary = await getUnitLedgerSummary(unit.id);
    if (summary.balanceCents <= 0) continue;

    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        unitId: unit.id,
        billingCycle,
        chargeType: "LATE_FEE",
      },
    });

    if (existing) continue;

    await prisma.ledgerEntry.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        tenantAssignmentId: assignment.id,
        entryType: "CHARGE",
        chargeType: "LATE_FEE",
        amountCents: tier.lateFeeInitialCents,
        billingCycle,
        effectiveDate: today,
        memo: "Initial late fee",
      },
    });
  }

  return { ok: true };
}