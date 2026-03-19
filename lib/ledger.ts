import { prisma } from "@/lib/prisma";

const PAYMENT_TYPES = new Set(["MANUAL_PAYMENT", "PAYMENT"]);
const CHARGE_TYPES = new Set(["RENT_CHARGE", "LATE_FEE", "OTHER_FEE"]);

export async function getUnitLedgerSummary(unitId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: { unitId },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });

  let runningBalance = 0;

  let totalCharges = 0;
  let totalPaidRaw = 0;

  let lastPaymentDate: Date | null = null;
  let lastPaymentAmount = 0;

  for (const e of entries) {
    runningBalance += e.amount;

    if (CHARGE_TYPES.has(e.type) && e.amount > 0) {
      totalCharges += e.amount;
    }

    if (PAYMENT_TYPES.has(e.type) && e.amount < 0) {
      totalPaidRaw += e.amount;

      if (
        !lastPaymentDate ||
        new Date(e.effectiveDate) > lastPaymentDate
      ) {
        lastPaymentDate = new Date(e.effectiveDate);
        lastPaymentAmount = Math.abs(e.amount);
      }
    }
  }

  return {
    balance: runningBalance,
    totalCharges,
    totalPaid: Math.abs(totalPaidRaw),
    lastPaymentDate,
    lastPaymentAmount,
    entryCount: entries.length,
  };
}