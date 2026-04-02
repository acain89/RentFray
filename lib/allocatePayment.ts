// lib/allocatePayment.ts

type LedgerLikeEntry = {
  id: string;
  amountCents: number;
  entryType: string;
  appliedAmountCents?: number | null;
};

type Allocation = {
  ledgerEntryId: string;
  appliedAmountCents: number;
};

type AllocationResult = {
  allocations: Allocation[];
  remainingCents: number;
  totalOpenChargeCents: number;
  isExactPaymentMatch: boolean;
};

type CanonicalLedgerEntryType = "CHARGE" | "PAYMENT" | "CREDIT" | "ADJUSTMENT";

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function normalizeLedgerEntryType(value: unknown): CanonicalLedgerEntryType | null {
  const normalized = String(value ?? "").trim().toUpperCase();

  switch (normalized) {
    case "CHARGE":
    case "PAYMENT":
    case "CREDIT":
    case "ADJUSTMENT":
      return normalized;
    default:
      return null;
  }
}

function isAllocatableChargeType(type: CanonicalLedgerEntryType): boolean {
  return type === "CHARGE";
}

/*
V1 RULE:
- No partial payments allowed
- Payment must exactly match total currently open charges
- If it does not match exactly, return no allocations
*/
export function allocatePayment(
  paymentAmountCents: number,
  entries: LedgerLikeEntry[]
): AllocationResult {
  const safePaymentAmountCents = Math.max(0, toSafeInteger(paymentAmountCents));

  const openCharges = entries
    .map((entry) => {
      const entryType = normalizeLedgerEntryType(entry.entryType);
      const amountCents = Math.max(0, toSafeInteger(entry.amountCents));
      const appliedAmountCents = Math.max(
        0,
        toSafeInteger(entry.appliedAmountCents ?? 0)
      );

      if (!entryType || !isAllocatableChargeType(entryType)) {
        return null;
      }

      const openAmountCents = Math.max(0, amountCents - appliedAmountCents);

      if (openAmountCents <= 0) {
        return null;
      }

      return {
        id: entry.id,
        openAmountCents,
      };
    })
    .filter((entry): entry is { id: string; openAmountCents: number } => entry !== null);

  const totalOpenChargeCents = openCharges.reduce(
    (sum, entry) => sum + entry.openAmountCents,
    0
  );

  const isExactPaymentMatch =
    safePaymentAmountCents > 0 && safePaymentAmountCents === totalOpenChargeCents;

  if (!isExactPaymentMatch) {
    return {
      allocations: [],
      remainingCents: safePaymentAmountCents,
      totalOpenChargeCents,
      isExactPaymentMatch: false,
    };
  }

  const allocations: Allocation[] = openCharges.map((entry) => ({
    ledgerEntryId: entry.id,
    appliedAmountCents: entry.openAmountCents,
  }));

  return {
    allocations,
    remainingCents: 0,
    totalOpenChargeCents,
    isExactPaymentMatch: true,
  };
}