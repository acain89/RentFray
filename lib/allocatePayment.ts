// lib/allocatePayment.ts

type LedgerLikeEntry = {
  id: string;
  amount: number;
  type: string;
};

type Allocation = {
  ledgerEntryId: string;
  appliedAmount: number;
};

export function allocatePayment(amount: number, entries: LedgerLikeEntry[]) {
  let remaining = Math.max(0, Number(amount || 0));

  const positiveCharges = entries
    .filter((e) => Number(e.amount || 0) > 0)
    .map((e) => ({
      id: e.id,
      amount: Number(e.amount || 0),
    }));

  const allocations: Allocation[] = [];

  for (const entry of positiveCharges) {
    if (remaining <= 0) break;

    const appliedAmount = Math.min(remaining, entry.amount);

    if (appliedAmount > 0) {
      allocations.push({
        ledgerEntryId: entry.id,
        appliedAmount,
      });

      remaining -= appliedAmount;
    }
  }

  return {
    allocations,
    remaining,
  };
}