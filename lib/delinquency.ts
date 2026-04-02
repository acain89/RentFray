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

function diffDays(later: Date, earlier: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    0,
    Math.floor(
      (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / msPerDay
    )
  );
}

function getClampedBillingDay(year: number, monthIndex: number, billingDay: number) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(billingDay, lastDayOfMonth));
}

function getCurrentCycleDueDate(today: Date, billingDay: number) {
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const day = getClampedBillingDay(year, monthIndex, billingDay);
  return new Date(year, monthIndex, day);
}

export async function getUnitDelinquencySummary(
  unitId: string,
  asOf = new Date()
) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      property: { include: { settings: true } },
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      ledgerEntries: {
        where: { voidedAt: null },
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        select: {
          entryType: true,
          chargeType: true,
          amountCents: true,
        },
      },
    },
  });

  if (!unit) throw new Error("Unit not found");

  // ✅ FIXED
  const ledger = await getUnitLedgerSummary(unit.id);

  const today = startOfDay(asOf);
  const activeAssignment = unit.tenantAssignments[0] ?? null;

  const billingDay =
    unit.tier?.rentDueDay ?? unit.property.settings?.rentDueDay ?? 1;

  const gracePeriodDays =
    unit.tier?.gracePeriodDays ??
    unit.property.settings?.gracePeriodDays ??
    0;

  // ✅ FIXED (schema aligned)
  const lateFeeInitial =
    unit.tier?.lateFeeInitialCents ??
    unit.property.settings?.lateFeeFlatCents ??
    0;

  const lateFeeDaily = unit.tier?.lateFeeDailyCents ?? 0;
  const lateFeeMaxDays = unit.tier?.maxLateFeeDays ?? 0;

  const dueDate = startOfDay(getCurrentCycleDueDate(today, billingDay));
  const graceEndsOn = startOfDay(addDays(dueDate, gracePeriodDays));
  const initialLateFeeDate = startOfDay(addDays(dueDate, gracePeriodDays + 1));
  const dailyLateFeeStartDate = startOfDay(addDays(initialLateFeeDate, 1));

  const isPastGrace = today >= initialLateFeeDate;

  if (!activeAssignment) {
    return {
      unitId: unit.id,
      propertyId: unit.propertyId,
      billingDay,
      gracePeriodDays,
      dueDate: null,
      graceEndsOn: null,
      initialLateFeeDate: null,
      dailyLateFeeStartDate: null,
      amountDueNowCents: 0,
      totalBalanceCents: 0,
      totalChargesCents: 0,
      totalPaidCents: 0,
      lastPaymentDate: null,
      lastPaymentAmountCents: null,
      unpaidRentCents: 0,
      lateFeesOwedCents: 0,
      projectedLateFeesCents: 0,
      daysPastDue: 0,
      isDelinquent: false,
      isPastGrace: false,
      hasPropertySettings: !!unit.property.settings,
      tier: null,
    };
  }

  let rentChargesCents = 0;

  for (const entry of unit.ledgerEntries) {
    if (entry.entryType === "CHARGE" && entry.chargeType === "RENT") {
      rentChargesCents += entry.amountCents ?? 0;
    }
  }

  const totalBalanceCents = ledger.balanceCents;

  const unpaidRentCents = Math.min(totalBalanceCents, rentChargesCents);
  const lateFeesOwedCents = Math.max(0, totalBalanceCents - unpaidRentCents);

  const amountDueNowCents = Math.max(totalBalanceCents, 0);
  const isDelinquent = amountDueNowCents > 0 && today >= initialLateFeeDate;
  const daysPastDue = isDelinquent ? diffDays(today, dueDate) : 0;

  let projectedLateFeesCents = 0;

  if (isDelinquent) {
    let projectedInitial = lateFeeInitial;
    let projectedDaily = 0;

    if (today >= dailyLateFeeStartDate && lateFeeDaily > 0) {
      const days = diffDays(today, dailyLateFeeStartDate) + 1;
      const allowedDays = Math.min(days, lateFeeMaxDays);
      projectedDaily = lateFeeDaily * allowedDays;
    }

    projectedLateFeesCents = projectedInitial + projectedDaily;
  }

  return {
    unitId: unit.id,
    propertyId: unit.propertyId,
    billingDay,
    gracePeriodDays,
    dueDate,
    graceEndsOn,
    initialLateFeeDate,
    dailyLateFeeStartDate,
    amountDueNowCents,
    totalBalanceCents,
    totalChargesCents: ledger.totalChargesCents, // ✅ FIXED
    totalPaidCents: ledger.totalPaidCents,       // ✅ FIXED
    lastPaymentDate: ledger.lastPaymentDate,
    lastPaymentAmountCents: ledger.lastPaymentAmountCents,
    unpaidRentCents,
    lateFeesOwedCents,
    projectedLateFeesCents,
    daysPastDue,
    isDelinquent,
    isPastGrace,
    hasPropertySettings: !!unit.property.settings,
    tier: unit.tier
      ? {
          id: unit.tier.id,
          name: unit.tier.name,
          rentDueDay: unit.tier.rentDueDay,
          gracePeriodDays: unit.tier.gracePeriodDays,
          lateFeeInitial: unit.tier.lateFeeInitialCents,
          lateFeeDaily: unit.tier.lateFeeDailyCents,
          lateFeeMaxDays: unit.tier.maxLateFeeDays,
        }
      : null,
  };
}