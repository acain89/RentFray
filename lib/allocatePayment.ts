// lib/allocatePayment.ts

type LedgerLikeEntry = {
  id: string;
  amount: number;
  type: string;
  appliedAmount?: number | null;
};

type Allocation = {
  ledgerEntryId: string;
  appliedAmount: number;
};

type AllocationResult = {
  allocations: Allocation[];
  remaining: number;
};

function toCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function isChargeType(type: unknown): boolean {
  const normalized = String(type ?? "").trim().toUpperCase();

  return (
    normalized === "CHARGE" ||
    normalized === "RENT" ||
    normalized === "LATE_FEE" ||
    normalized === "FEE" ||
    normalized === "ADJUSTMENT"
  );
}

export function allocatePayment(
  amount: number,
  entries: LedgerLikeEntry[]
): AllocationResult {
  let remainingCents = Math.max(0, toCents(amount));

  const openCharges = entries
    .filter((entry) => {
      const entryAmountCents = toCents(entry.amount);
      return isChargeType(entry.type) && entryAmountCents > 0;
    })
    .map((entry) => {
      const amountCents = toCents(entry.amount);
      const alreadyAppliedCents = Math.max(0, toCents(entry.appliedAmount ?? 0));
      const openAmountCents = Math.max(0, amountCents - alreadyAppliedCents);

      return {
        id: entry.id,
        openAmountCents,
      };
    })
    .filter((entry) => entry.openAmountCents > 0);

  const allocations: Allocation[] = [];

  for (const entry of openCharges) {
    if (remainingCents <= 0) break;

    const appliedCents = Math.min(remainingCents, entry.openAmountCents);

    if (appliedCents > 0) {
      allocations.push({
        ledgerEntryId: entry.id,
        appliedAmount: fromCents(appliedCents),
      });

      remainingCents -= appliedCents;
    }
  }

  return {
    allocations,
    remaining: fromCents(remainingCents),
  };
}