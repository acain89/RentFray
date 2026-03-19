// lib/delinquency.ts

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
      assignments: {
        where: { moveOut: null },
        orderBy: { moveIn: "desc" },
        take: 1,
      },
      ledgerEntries: {
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
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

  const activeAssignment = unit.assignments[0] ?? null;
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

  if (!activeAssignment) {
    return {
      unitId: unit.id,
      propertyId: unit.propertyId,
      billingDay: settings.billingDay,
      gracePeriodDays: settings.gracePeriodDays,
      dueDate: null,
      graceEndsOn: null,
      amountDueNow: 0,
      totalBalance: 0,
      totalCharges: 0,
      totalPaid: 0,
      lastPaymentDate: null,
      lastPaymentAmount: null,
      unpaidRent: 0,
      lateFeesOwed: 0,
      daysPastDue: 0,
      isDelinquent: false,
      isPastGrace: false,
      hasPropertySettings: !!unit.property.settings,
    };
  }

  const unpaidRent = unit.ledgerEntries
    .filter((entry) => entry.amount > 0 && entry.type === "RENT_CHARGE")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const lateFeesOwed = unit.ledgerEntries
    .filter((entry) => entry.amount > 0 && entry.type === "LATE_FEE")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const amountDueNow = Math.max(Number(ledger.balance || 0), 0);
  const isDelinquent = amountDueNow > 0 && isPastGrace;
  const daysPastDue = isDelinquent ? diffDays(today, dueDate) : 0;

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
    unpaidRent,
    lateFeesOwed,
    daysPastDue,
    isDelinquent,
    isPastGrace,
    hasPropertySettings: !!unit.property.settings,
  };
}