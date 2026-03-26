type LedgerRow = {
  id: string;
  amount: number;
  type: string;
  effectiveDate: Date;
  appliedAmount?: number | null;
};

type PaymentAllocation = {
  chargeId: string;
  applied: number;
};

type PaymentAllocationResult = {
  allocations: PaymentAllocation[];
  remaining: number;
};

type NormalizedChargeType =
  | "CHARGE"
  | "RENT"
  | "LATE_FEE"
  | "FEE"
  | "ADJUSTMENT";

function toCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function normalizeChargeType(value: unknown): NormalizedChargeType | null {
  const normalized = String(value ?? "").trim().toUpperCase();

  switch (normalized) {
    case "CHARGE":
    case "RENT":
    case "LATE_FEE":
    case "FEE":
    case "ADJUSTMENT":
      return normalized;
    default:
      return null;
  }
}

function isChargeType(value: unknown): value is NormalizedChargeType {
  return normalizeChargeType(value) !== null;
}

function toDateMs(value: unknown): number {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function allocatePayment(
  amount: number,
  charges: LedgerRow[]
): PaymentAllocationResult {
  let remainingCents = Math.max(0, toCents(amount));

  if (remainingCents <= 0 || !Array.isArray(charges) || charges.length === 0) {
    return {
      allocations: [],
      remaining: fromCents(remainingCents),
    };
  }

  const seenChargeIds = new Set<string>();

  const sortedCharges = charges
    .filter((charge) => {
      const id = String(charge.id ?? "").trim();
      if (!id || seenChargeIds.has(id)) return false;
      seenChargeIds.add(id);

      const normalizedType = normalizeChargeType(charge.type);
      if (!normalizedType) return false;

      const amountCents = toCents(charge.amount);
      if (amountCents <= 0) return false;

      return true;
    })
    .map((charge) => {
      const amountCents = toCents(charge.amount);
      const appliedCents = Math.max(0, toCents(charge.appliedAmount ?? 0));
      const openCents = Math.max(0, amountCents - appliedCents);

      return {
        id: String(charge.id).trim(),
        effectiveDateMs: toDateMs(charge.effectiveDate),
        openCents,
      };
    })
    .filter((charge) => charge.openCents > 0)
    .sort((a, b) => {
      if (a.effectiveDateMs !== b.effectiveDateMs) {
        return a.effectiveDateMs - b.effectiveDateMs;
      }

      return a.id.localeCompare(b.id);
    });

  const allocations: PaymentAllocation[] = [];

  for (const charge of sortedCharges) {
    if (remainingCents <= 0) break;

    const appliedCents = Math.min(charge.openCents, remainingCents);
    if (appliedCents <= 0) continue;

    allocations.push({
      chargeId: charge.id,
      applied: fromCents(appliedCents),
    });

    remainingCents -= appliedCents;
  }

  return {
    allocations,
    remaining: fromCents(remainingCents),
  };
}