type LedgerRow = {
  id: string;
  amount: number;
  type: string;
  effectiveDate: Date;
};

export function allocatePayment(
  amount: number,
  charges: LedgerRow[]
) {
  let remaining = amount;

  // only positive balances (charges)
  const sorted = charges
    .filter((c) => c.amount > 0)
    .sort(
      (a, b) =>
        new Date(a.effectiveDate).getTime() -
        new Date(b.effectiveDate).getTime()
    );

  const allocations: {
    chargeId: string;
    applied: number;
  }[] = [];

  for (const charge of sorted) {
    if (remaining <= 0) break;

    const applied = Math.min(charge.amount, remaining);

    allocations.push({
      chargeId: charge.id,
      applied,
    });

    remaining -= applied;
  }

  return {
    allocations,
    remaining, // overpayment (credit)
  };
}