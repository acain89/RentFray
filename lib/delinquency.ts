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

export async function getUnitDelinquencySummary(unitId: string, asOf = new Date()) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      property: {
        include: {
          settings: true,
        },
      },
      assignments: {
        where: { moveOut: null },
        orderBy: { moveIn: "desc" },
        take: 1,
      },
    },
  });

  if (!unit) {
    throw new Error("Unit not found");
  }

  const activeAssignment = unit.assignments[0] ?? null;

  if (!activeAssignment) {
    return {
      unitId: unit.id,
      propertyId: unit.propertyId,
      billingDay: unit.property.settings?.billingDay ?? 1,
      gracePeriodDays: unit.property.settings?.gracePeriodDays ?? 5,
      dueDate: null,
      graceEndsOn: null,
      amountDueNow: 0,
      totalBalance: 0,
      totalCharges: 0,
      totalPaid: 0,
      lastPaymentDate: null,
      lastPaymentAmount: 0,
      isDelinquent: false,
      isPastGrace: false,
      hasPropertySettings: !!unit.property.settings,
    };
  }

  const settings = unit.property.settings ?? {
    billingDay: 1,
    gracePeriodDays: 5,
    lateFeeType: "FLAT",
    lateFeeValue: 0,
    convenienceFeePct: 0,
  };

  const ledger = await getUnitLedgerSummary(unitId);

  const today = startOfDay(asOf);
  const dueDate = startOfDay(getCurrentCycleDueDate(today, settings.billingDay));
  const graceEndsOn = startOfDay(addDays(dueDate, settings.gracePeriodDays));
  const isPastGrace = today > graceEndsOn;

  const amountDueNow = Math.max(ledger.balance, 0);
  const isDelinquent = amountDueNow > 0 && isPastGrace;

  return {
    unitId: unit.id,
    propertyId: unit.propertyId,
    billingDay: settings.billingDay,
    gracePeriodDays: settings.gracePeriodDays,
    dueDate,
    graceEndsOn,
    amountDueNow,
    totalBalance: ledger.balance,
    totalCharges: ledger.totalCharges,
    totalPaid: ledger.totalPaid,
    lastPaymentDate: ledger.lastPaymentDate,
    lastPaymentAmount: ledger.lastPaymentAmount,
    isDelinquent,
    isPastGrace,
    hasPropertySettings: !!unit.property.settings,
  };
}