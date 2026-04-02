// lib/paymentAllocation.ts

type LedgerRow = {
  id: string;
  amountCents: number;
  entryType: string;
  effectiveDate: Date | string;
  appliedAmountCents?: number | null;
};

type PaymentAllocation = {
  chargeId: string;
  appliedAmountCents: number;
};

type PaymentAllocationResult = {
  allocations: PaymentAllocation[];
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

function isChargeEntryType(type: CanonicalLedgerEntryType): boolean {
  return type === "CHARGE";
}

function toDateMs(value: unknown): number {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/*
V1 RULES
- No partial payments
- Payment must exactly match total currently open charges
- Allocation order remains oldest charge first for deterministic traceability
*/
export function allocatePayment(
  paymentAmountCents: number,
  charges: LedgerRow[]
): PaymentAllocationResult {
  const safePaymentAmountCents = Math.max(0, toSafeInteger(paymentAmountCents));

  if (safePaymentAmountCents <= 0 || !Array.isArray(charges) || charges.length === 0) {
    return {
      allocations: [],
      remainingCents: safePaymentAmountCents,
      totalOpenChargeCents: 0,
      isExactPaymentMatch: false,
    };
  }

  const seenChargeIds = new Set<string>();

  const sortedOpenCharges = charges
    .map((charge) => {
      const id = String(charge.id ?? "").trim();
      if (!id || seenChargeIds.has(id)) {
        return null;
      }
      seenChargeIds.add(id);

      const entryType = normalizeLedgerEntryType(charge.entryType);
      if (!entryType || !isChargeEntryType(entryType)) {
        return null;
      }

      const amountCents = Math.max(0, toSafeInteger(charge.amountCents));
      const appliedAmountCents = Math.max(
        0,
        toSafeInteger(charge.appliedAmountCents ?? 0)
      );
      const openAmountCents = Math.max(0, amountCents - appliedAmountCents);

      if (openAmountCents <= 0) {
        return null;
      }

      return {
        id,
        effectiveDateMs: toDateMs(charge.effectiveDate),
        openAmountCents,
      };
    })
    .filter(
      (
        charge
      ): charge is {
        id: string;
        effectiveDateMs: number;
        openAmountCents: number;
      } => charge !== null
    )
    .sort((a, b) => {
      if (a.effectiveDateMs !== b.effectiveDateMs) {
        return a.effectiveDateMs - b.effectiveDateMs;
      }

      return a.id.localeCompare(b.id);
    });

  const totalOpenChargeCents = sortedOpenCharges.reduce(
    (sum, charge) => sum + charge.openAmountCents,
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

  const allocations: PaymentAllocation[] = sortedOpenCharges.map((charge) => ({
    chargeId: charge.id,
    appliedAmountCents: charge.openAmountCents,
  }));

  return {
    allocations,
    remainingCents: 0,
    totalOpenChargeCents,
    isExactPaymentMatch: true,
  };
}