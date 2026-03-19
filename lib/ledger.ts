// lib/ledger.ts

import { prisma } from "@/lib/prisma";

export type LedgerSummary = {
  balance: number;
  totalCharges: number;
  totalPaid: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
};

export async function getUnitLedgerSummary(
  unitId: string
): Promise<LedgerSummary> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { unitId },
    orderBy: [
      { effectiveDate: "asc" },
      { createdAt: "asc" },
    ],
  });

  let balance = 0;
  let totalCharges = 0;
  let totalPaid = 0;

  let lastPaymentDate: Date | null = null;
  let lastPaymentAmount: number | null = null;

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);

    balance += amount;

    if (amount > 0) {
      totalCharges += amount;
    } else if (amount < 0) {
      totalPaid += Math.abs(amount);

      if (
        !lastPaymentDate ||
        new Date(entry.effectiveDate) > new Date(lastPaymentDate)
      ) {
        lastPaymentDate = new Date(entry.effectiveDate);
        lastPaymentAmount = Math.abs(amount);
      }
    }
  }

  return {
    balance,
    totalCharges,
    totalPaid,
    lastPaymentDate,
    lastPaymentAmount,
  };
}