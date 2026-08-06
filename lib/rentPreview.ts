import { getRentDateSummary } from "@/lib/rentDates";

type RentPreviewInput = {
  billingDay: number;
  marketRent: number;
  ledgerEntries: {
    type: string;
    effectiveDate: Date | string;
    amount: number;
  }[];
};

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(value: string): Date {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}

export function getRentPreview({
  billingDay,
  marketRent,
  ledgerEntries,
}: RentPreviewInput) {
  const today = toDateOnly(new Date());

  const rentDates = getRentDateSummary({
    dueDay: billingDay,
    gracePeriodDays: 0,
    lateFeeEnabled: false,
    lateFeeInitialCents: 0,
    lateFeeDailyCents: 0,
    maxLateFeeDays: 0,
    now: today,
  });

const cycleStart = parseDateOnly(rentDates.dueDate);
const nextBillingDate = parseDateOnly(rentDates.nextDueDate);

  const hasChargeThisCycle = ledgerEntries.some((entry) => {
    if (entry.type !== "RENT_CHARGE") return false;

    const d = toDateOnly(new Date(entry.effectiveDate));
    return d >= cycleStart && d < nextBillingDate;
  });

  const upcomingCharge = hasChargeThisCycle
    ? null
    : {
        type: "RENT_CHARGE",
        amount: Number(marketRent || 0),
        effectiveDate: nextBillingDate,
      };

  return {
    cycleStart,
    nextBillingDate,
    hasChargeThisCycle,
    upcomingCharge,
    evaluatedAt: today,
  };
}