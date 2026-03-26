// lib/ledger.ts

import { prisma } from "@/lib/prisma";

export type LedgerSummary = {
  balance: number;
  totalCharges: number;
  totalPaid: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
};

// --- MONEY HELPERS (STRICT) ---

function toSafeCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- ENTRY TYPE HANDLING (STRICT) ---

type EntryType = "PAYMENT" | "CHARGE" | "RENT" | "LATE_FEE" | "FEE";

function normalizeEntryType(value: unknown): EntryType | null {
  const type = String(value ?? "").trim().toUpperCase();

  switch (type) {
    case "PAYMENT":
    case "CHARGE":
    case "RENT":
    case "LATE_FEE":
    case "FEE":
      return type;
    default:
      return null;
  }
}

function isCharge(type: EntryType): boolean {
  return (
    type === "CHARGE" ||
    type === "RENT" ||
    type === "LATE_FEE" ||
    type === "FEE"
  );
}

function isPayment(type: EntryType): boolean {
  return type === "PAYMENT";
}

// --- DATE SAFETY ---

function toSafeDate(value: unknown): Date | null {
  const d = new Date(value as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

// --- MAIN FUNCTION ---

export async function getUnitLedgerSummary(
  unitId: string
): Promise<LedgerSummary> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { unitId },
    orderBy: [
      { effectiveDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      amount: true,
      entryType: true,
      effectiveDate: true,
      createdAt: true,
    },
  });

  let balanceCents = 0;
  let totalChargesCents = 0;
  let totalPaidCents = 0;

  let lastPaymentDate: Date | null = null;
  let lastPaymentAmountCents: number | null = null;
  let lastPaymentCreatedAt: Date | null = null;

  for (const entry of entries) {
    const type = normalizeEntryType(entry.entryType);
    if (!type) continue; // 🚫 ignore invalid rows (prevents corruption)

    const amountCents = toSafeCents(entry.amount);
    if (!Number.isFinite(amountCents)) continue;

    // --- ENFORCE SIGN RULES ---
    if (isCharge(type) && amountCents < 0) continue;
    if (isPayment(type) && amountCents > 0) continue;

    balanceCents += amountCents;

    if (isCharge(type)) {
      totalChargesCents += amountCents;
    }

    if (isPayment(type)) {
      const paymentCents = Math.abs(amountCents);
      totalPaidCents += paymentCents;

      const effectiveDate = toSafeDate(entry.effectiveDate);
      const createdAt = toSafeDate(entry.createdAt);

      if (!effectiveDate || !createdAt) continue;

      const isLaterPayment =
        !lastPaymentDate ||
        effectiveDate.getTime() > lastPaymentDate.getTime() ||
        (effectiveDate.getTime() === lastPaymentDate.getTime() &&
          (!lastPaymentCreatedAt ||
            createdAt.getTime() > lastPaymentCreatedAt.getTime()));

      if (isLaterPayment) {
        lastPaymentDate = effectiveDate;
        lastPaymentCreatedAt = createdAt;
        lastPaymentAmountCents = paymentCents;
      }
    }
  }

  return {
    balance: roundMoney(centsToDollars(balanceCents)),
    totalCharges: roundMoney(centsToDollars(totalChargesCents)),
    totalPaid: roundMoney(centsToDollars(totalPaidCents)),
    lastPaymentDate,
    lastPaymentAmount:
      lastPaymentAmountCents === null
        ? null
        : roundMoney(centsToDollars(lastPaymentAmountCents)),
  };
}