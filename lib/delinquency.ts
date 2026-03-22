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

function getClampedBillingDay(
  year: number,
  monthIndex: number,
  billingDay: number
) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(billingDay, lastDayOfMonth));
}

function getCurrentCycleDueDate(today: Date, billingDay: number) {
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const day = getClampedBillingDay(year, monthIndex, billingDay);
  return new Date(year, monthIndex, day);
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export async function getUnitDelinquencySummary(
  unitId: string,
  asOf = new Date()
) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      property: {
        include: {
          settings: true,
        },
      },
      tier: true,
      tenantAssignments: {
        where: { isCurrent: true },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      ledgerEntries: {
        where: {
          voidedAt: null,
        },
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          entryType: true,
          chargeType: true,
          amount: true,
          effectiveDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!unit) {
    throw new Error("Unit not found");
  }

  type LedgerEntry = (typeof unit.ledgerEntries)[number];

  const activeAssignment = unit.tenantAssignments[0] ?? null;
  const ledger = await getUnitLedgerSummary(unitId);

  const today = startOfDay(asOf);

  const billingDay = unit.tier?.rentDueDay ?? unit.property.settings?.rentDueDay ?? 1;
  const gracePeriodDays =
    unit.tier?.gracePeriodDays ?? unit.property.settings?.gracePeriodDays ?? 0;

  const lateFeeInitial =
    unit.tier?.lateFeeInitial ?? unit.property.settings?.lateFeeFlat ?? 0;

  const lateFeeDaily = unit.tier?.lateFeeDaily ?? 0;
  const lateFeeMaxDays = unit.tier?.lateFeeMaxDays ?? 0;

  const dueDate = startOfDay(getCurrentCycleDueDate(today, billingDay));

  // grace covers dueDate + gracePeriodDays
  const graceEndsOn = startOfDay(addDays(dueDate, gracePeriodDays));

  // initial late fee posts the next day
  const initialLateFeeDate = startOfDay(addDays(dueDate, gracePeriodDays + 1));

  // daily late fee starts the day after the initial late fee
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
      amountDueNow: 0,
      totalBalance: 0,
      totalCharges: 0,
      totalPaid: 0,
      lastPaymentDate: null,
      lastPaymentAmount: null,
      unpaidRent: 0,
      lateFeesOwed: 0,
      projectedLateFees: 0,
      daysPastDue: 0,
      isDelinquent: false,
      isPastGrace: false,
      hasPropertySettings: !!unit.property.settings,
      tier: unit.tier
        ? {
            id: unit.tier.id,
            name: unit.tier.name,
            rentDueDay: unit.tier.rentDueDay,
            gracePeriodDays: unit.tier.gracePeriodDays,
            lateFeeInitial: roundMoney(Number(unit.tier.lateFeeInitial || 0)),
            lateFeeDaily: roundMoney(Number(unit.tier.lateFeeDaily || 0)),
            lateFeeMaxDays: Number(unit.tier.lateFeeMaxDays || 0),
          }
        : null,
    };
  }

  const unpaidRent = roundMoney(
    unit.ledgerEntries
      .filter(
        (entry: LedgerEntry) =>
          entry.entryType === "CHARGE" &&
          entry.chargeType === "RENT" &&
          Number(entry.amount || 0) > 0
      )
      .reduce(
        (sum: number, entry: LedgerEntry) => sum + Number(entry.amount || 0),
        0
      )
  );

  const lateFeesOwed = roundMoney(
    unit.ledgerEntries
      .filter(
        (entry: LedgerEntry) =>
          entry.entryType === "CHARGE" &&
          entry.chargeType === "LATE_FEE" &&
          Number(entry.amount || 0) > 0
      )
      .reduce(
        (sum: number, entry: LedgerEntry) => sum + Number(entry.amount || 0),
        0
      )
  );

  const amountDueNow = roundMoney(Math.max(Number(ledger.balance || 0), 0));
  const isDelinquent = amountDueNow > 0 && today >= initialLateFeeDate;
  const daysPastDue = isDelinquent ? diffDays(today, dueDate) : 0;

  let projectedLateFees = 0;

  if (isDelinquent) {
    let projectedInitial = 0;
    let projectedDaily = 0;

    if (Number(lateFeeInitial || 0) > 0) {
      projectedInitial = Number(lateFeeInitial || 0);
    }

    if (today >= dailyLateFeeStartDate && Number(lateFeeDaily || 0) > 0) {
      const elapsedDailyFeeDays = diffDays(today, dailyLateFeeStartDate) + 1;
      const allowedDailyFeeDays = Math.min(
        Math.max(0, elapsedDailyFeeDays),
        Math.max(0, lateFeeMaxDays)
      );

      projectedDaily = Number(lateFeeDaily || 0) * allowedDailyFeeDays;
    }

    projectedLateFees = roundMoney(projectedInitial + projectedDaily);
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
    amountDueNow,
    totalBalance: roundMoney(Number(ledger.balance || 0)),
    totalCharges: roundMoney(Number(ledger.totalCharges || 0)),
    totalPaid: roundMoney(Number(ledger.totalPaid || 0)),
    lastPaymentDate: ledger.lastPaymentDate,
    lastPaymentAmount: roundMoney(Number(ledger.lastPaymentAmount || 0)),
    unpaidRent,
    lateFeesOwed,
    projectedLateFees,
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
          lateFeeInitial: roundMoney(Number(unit.tier.lateFeeInitial || 0)),
          lateFeeDaily: roundMoney(Number(unit.tier.lateFeeDaily || 0)),
          lateFeeMaxDays: Number(unit.tier.lateFeeMaxDays || 0),
        }
      : null,
  };
}