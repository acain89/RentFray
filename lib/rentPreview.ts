type RentPreviewInput = {
  billingDay: number;
  marketRent: number;
  ledgerEntries: {
    type: string;
    effectiveDate: Date | string;
    amount: number;
  }[];
};

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCycleStart(today: Date, billingDay: number) {
  const year = today.getFullYear();
  const month = today.getMonth();

  const thisMonthBilling = new Date(year, month, billingDay);

  if (today >= thisMonthBilling) {
    return toDateOnly(thisMonthBilling);
  }

  return toDateOnly(new Date(year, month - 1, billingDay));
}

function getNextBillingDate(cycleStart: Date, billingDay: number) {
  const year = cycleStart.getFullYear();
  const month = cycleStart.getMonth();
  return toDateOnly(new Date(year, month + 1, billingDay));
}

export function getRentPreview({
  billingDay,
  marketRent,
  ledgerEntries,
}: RentPreviewInput) {
  const today = toDateOnly(new Date());

  const cycleStart = getCycleStart(today, billingDay);
  const nextBillingDate = getNextBillingDate(cycleStart, billingDay);

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