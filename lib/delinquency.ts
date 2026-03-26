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
          amount: true,
        },
      },
    },
  });

  if (!unit) throw new Error("Unit not found");

  const ledger = await getUnitLedgerSummary(unitId);
  const today = startOfDay(asOf);

  const activeAssignment = unit.tenantAssignments[0] ?? null;

  const billingDay =
    unit.tier?.rentDueDay ?? unit.property.settings?.rentDueDay ?? 1;

  const gracePeriodDays =
    unit.tier?.gracePeriodDays ??
    unit.property.settings?.gracePeriodDays ??
    0;

  const lateFeeInitial =
    unit.tier?.lateFeeInitial ??
    unit.property.settings?.lateFeeFlat ??
    0;

  const lateFeeDaily = unit.tier?.lateFeeDaily ?? 0;
  const lateFeeMaxDays = unit.tier?.lateFeeMaxDays ?? 0;

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
      tier: null,
    };
  }

  // 🔒 Derive from ledger (safe)
  let rentCharges = 0;
  let lateFeeCharges = 0;

  for (const entry of unit.ledgerEntries) {
    const amount = Number(entry.amount || 0);

    if (entry.entryType === "CHARGE" && amount > 0) {
      if (entry.chargeType === "RENT") {
        rentCharges += amount;
      }
      if (entry.chargeType === "LATE_FEE") {
        lateFeeCharges += amount;
      }
    }
  }

  const totalBalance = roundMoney(ledger.balance);

  // Conservative split (prevents overstating)
  const unpaidRent = roundMoney(Math.min(totalBalance, rentCharges));
  const lateFeesOwed = roundMoney(
    Math.max(0, totalBalance - unpaidRent)
  );

  const amountDueNow = roundMoney(Math.max(totalBalance, 0));
  const isDelinquent = amountDueNow > 0 && today >= initialLateFeeDate;
  const daysPastDue = isDelinquent ? diffDays(today, dueDate) : 0;

  let projectedLateFees = 0;

  if (isDelinquent) {
    let projectedInitial = lateFeeInitial || 0;
    let projectedDaily = 0;

    if (today >= dailyLateFeeStartDate && lateFeeDaily > 0) {
      const days = diffDays(today, dailyLateFeeStartDate) + 1;
      const allowedDays = Math.min(days, lateFeeMaxDays);
      projectedDaily = lateFeeDaily * allowedDays;
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
    totalBalance,
    totalCharges: roundMoney(ledger.totalCharges),
    totalPaid: roundMoney(ledger.totalPaid),
    lastPaymentDate: ledger.lastPaymentDate,
    lastPaymentAmount:
      ledger.lastPaymentAmount === null
        ? null
        : roundMoney(ledger.lastPaymentAmount),
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