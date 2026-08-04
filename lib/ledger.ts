import { prisma } from "@/lib/prisma";

export type LedgerSummaryInput = {
  unitId: string;
  tenantAssignmentId?: string;
  asOf: Date;
  billingCycle?: string;
};

export type LedgerSummary = {
  balanceCents: number;
  totalChargesCents: number;
  totalCreditsCents: number;
  totalPaidCents: number;
  currentCycleRentChargesCents: number;
  currentCycleLateFeeChargesCents: number;
  currentCycleRecurringChargesCents: number;

  positiveAdjustmentsCents: number;
  negativeAdjustmentsCents: number;
  netAdjustmentsCents: number;

  balance: number;
  totalCharges: number;
  totalCredits: number;
  totalPaid: number;
  currentCycleRentCharges: number;
  currentCycleLateFeeCharges: number;
  currentCycleRecurringCharges: number;

  positiveAdjustments: number;
  negativeAdjustments: number;
  netAdjustments: number;

  lastPaymentDate: Date | null;
  lastPaymentAmountCents: number | null;
  lastPaymentAmount: number | null;

  hasPendingPayment: boolean;
  pendingPaymentAmountCents: number;

  hasPaidPayment: boolean;
  hasFailedPayment: boolean;
  hasReversedPayment: boolean;
};

type LedgerEntryType =
  | "CHARGE"
  | "PAYMENT"
  | "CREDIT"
  | "ADJUSTMENT";

type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REVERSED";

type LedgerEntryRow = {
  id: string;
  amountCents: number;
  entryType: unknown;
  chargeType: unknown;
  billingCycle: string | null;
  effectiveDate: Date;
  createdAt: Date;
  payment: {
    status: unknown;
  } | null;
};

function normalizeLedgerEntryType(
  value: unknown
): LedgerEntryType | null {
  const type = String(value ?? "").trim().toUpperCase();

  switch (type) {
    case "CHARGE":
    case "PAYMENT":
    case "CREDIT":
    case "ADJUSTMENT":
      return type;
    default:
      return null;
  }
}

function normalizePaymentStatus(
  value: unknown
): PaymentStatus | null {
  const status = String(value ?? "").trim().toUpperCase();

  switch (status) {
    case "UNPAID":
    case "PENDING":
    case "PAID":
    case "FAILED":
    case "REVERSED":
      return status;
    default:
      return null;
  }
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function toSafeDate(value: unknown): Date | null {
  if (!value) return null;

  const date =
    value instanceof Date
      ? value
      : new Date(value as string | number);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toSafeInteger(value: unknown): number {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.trunc(amount);
}

function getSignedImpactCents(
  entryType: LedgerEntryType,
  amountCents: number,
  paymentStatus: PaymentStatus | null
): number {
  const safeAmount = toSafeInteger(amountCents);
  const absoluteAmount = Math.abs(safeAmount);

  switch (entryType) {
    case "CHARGE":
      return absoluteAmount;

    case "PAYMENT":
      return paymentStatus === "PAID"
        ? -absoluteAmount
        : 0;

    case "CREDIT":
      return -absoluteAmount;

    case "ADJUSTMENT":
      return safeAmount;

    default:
      return 0;
  }
}

/**
 * Sole authority for unit-level ledger math.
 *
 * Rules:
 * - CHARGE increases the balance.
 * - CREDIT reduces the balance.
 * - Only PAID payments reduce the balance.
 * - PENDING, FAILED, and REVERSED payments do not reduce the balance.
 * - Positive and negative adjustments remain separately reportable.
 * - Voided entries do not count.
 * - Future-dated entries after `asOf` do not count.
 * - The ledger does not silently hide invalid pre-start entries.
 */
export async function getUnitLedgerSummary(
  input: LedgerSummaryInput
): Promise<LedgerSummary> {
  const entries: LedgerEntryRow[] =
    await prisma.ledgerEntry.findMany({
      where: {
        unitId: input.unitId,
        voidedAt: null,

        ...(input.tenantAssignmentId
          ? {
              OR: [
                {
                  tenantAssignmentId:
                    input.tenantAssignmentId,
                },
                {
                  tenantAssignmentId: null,
                },
              ],
            }
          : {}),

        effectiveDate: {
          lte: input.asOf,
        },
      },

      orderBy: [
        { effectiveDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],

      select: {
        id: true,
        amountCents: true,
        entryType: true,
        chargeType: true,
        billingCycle: true,
        effectiveDate: true,
        createdAt: true,
        payment: {
          select: {
            status: true,
          },
        },
      },
    });

  const payments = await prisma.payment.findMany({
    where: {
      unitId: input.unitId,

      ...(input.tenantAssignmentId
        ? {
            OR: [
              {
                tenantAssignmentId:
                  input.tenantAssignmentId,
              },
              {
                tenantAssignmentId: null,
              },
            ],
          }
        : {}),
    },

    select: {
      status: true,
      amountCents: true,
      billingCycle: true,
    },
  });

  let balanceCents = 0;
  let totalChargesCents = 0;
  let totalCreditsCents = 0;
  let totalPaidCents = 0;
  let currentCycleRentChargesCents = 0;
  let currentCycleLateFeeChargesCents = 0;
  let currentCycleRecurringChargesCents = 0;
  let positiveAdjustmentsCents = 0;
  let negativeAdjustmentsCents = 0;

  let lastPaymentDate: Date | null = null;
  let lastPaymentCreatedAt: Date | null = null;
  let lastPaymentAmountCents: number | null = null;

  let hasPendingPayment = false;
  let pendingPaymentAmountCents = 0;

  const currentCycleStatuses: PaymentStatus[] = [];

  for (const payment of payments) {
    const status = normalizePaymentStatus(payment.status);

    if (!status) {
      continue;
    }

    if (status === "PENDING") {
      hasPendingPayment = true;

      pendingPaymentAmountCents += Math.max(
        0,
        Math.abs(toSafeInteger(payment.amountCents))
      );
    }

    if (
      input.billingCycle &&
      payment.billingCycle === input.billingCycle
    ) {
      currentCycleStatuses.push(status);
    }
  }

  const hasPaidPayment =
    currentCycleStatuses.includes("PAID");

  const hasFailedPayment =
    !hasPaidPayment &&
    !hasPendingPayment &&
    currentCycleStatuses.includes("FAILED");

  const hasReversedPayment =
    !hasPaidPayment &&
    !hasPendingPayment &&
    currentCycleStatuses.includes("REVERSED");

  for (const entry of entries) {
    const entryType = normalizeLedgerEntryType(
      entry.entryType
    );

    if (!entryType) {
      continue;
    }

    const rawAmountCents = toSafeInteger(
      entry.amountCents
    );

    const paymentStatus = normalizePaymentStatus(
      entry.payment?.status
    );

    balanceCents += getSignedImpactCents(
      entryType,
      rawAmountCents,
      paymentStatus
    );

    switch (entryType) {
     case "CHARGE": {
  const chargeAmountCents = Math.abs(rawAmountCents);
  totalChargesCents += chargeAmountCents;

  if (
    input.billingCycle &&
    entry.billingCycle === input.billingCycle
  ) {
    const chargeType = String(
      entry.chargeType ?? ""
    )
      .trim()
      .toUpperCase();

    if (chargeType === "RENT") {
      currentCycleRentChargesCents +=
        chargeAmountCents;
    } else if (
      chargeType === "LATE_FEE" ||
      chargeType === "LATE_FEE_INITIAL" ||
      chargeType === "LATE_FEE_DAILY"
    ) {
      currentCycleLateFeeChargesCents +=
        chargeAmountCents;
    } else if (
      chargeType === "RECURRING_FEE" ||
      chargeType === "RECURRING_CHARGE"
    ) {
      currentCycleRecurringChargesCents +=
        chargeAmountCents;
    }
  }

  break;
}

      case "CREDIT":
        totalCreditsCents += Math.abs(rawAmountCents);
        break;

      case "ADJUSTMENT":
        if (rawAmountCents > 0) {
          positiveAdjustmentsCents += rawAmountCents;
        } else if (rawAmountCents < 0) {
          negativeAdjustmentsCents += Math.abs(
            rawAmountCents
          );
        }
        break;

      case "PAYMENT":
        if (paymentStatus !== "PAID") {
          break;
        }

        const paymentAmountCents =
          Math.abs(rawAmountCents);

        totalPaidCents += paymentAmountCents;

        const effectiveDate = toSafeDate(
          entry.effectiveDate
        );

        const createdAt = toSafeDate(entry.createdAt);

        if (!effectiveDate || !createdAt) {
          break;
        }

        const isLaterPayment =
          lastPaymentDate === null ||
          effectiveDate.getTime() >
            lastPaymentDate.getTime() ||
          (effectiveDate.getTime() ===
            lastPaymentDate.getTime() &&
            (lastPaymentCreatedAt === null ||
              createdAt.getTime() >
                lastPaymentCreatedAt.getTime()));

        if (isLaterPayment) {
          lastPaymentDate = effectiveDate;
          lastPaymentCreatedAt = createdAt;
          lastPaymentAmountCents =
            paymentAmountCents;
        }
        break;
    }
  }

  const netAdjustmentsCents =
    positiveAdjustmentsCents -
    negativeAdjustmentsCents;

  return {
    balanceCents,
    totalChargesCents,
    totalCreditsCents,
    totalPaidCents,
    currentCycleRentChargesCents,
    currentCycleLateFeeChargesCents,
    currentCycleRecurringChargesCents,

    positiveAdjustmentsCents,
    negativeAdjustmentsCents,
    netAdjustmentsCents,

    balance: centsToDollars(balanceCents),
    totalCharges: centsToDollars(
      totalChargesCents
    ),
    totalCredits: centsToDollars(
      totalCreditsCents
    ),
    totalPaid: centsToDollars(totalPaidCents),
    currentCycleRentCharges: centsToDollars(
    currentCycleRentChargesCents
    ),
    currentCycleLateFeeCharges: centsToDollars(
    currentCycleLateFeeChargesCents
    ),
    currentCycleRecurringCharges: centsToDollars(
    currentCycleRecurringChargesCents
    ),

    positiveAdjustments: centsToDollars(
      positiveAdjustmentsCents
    ),
    negativeAdjustments: centsToDollars(
      negativeAdjustmentsCents
    ),
    netAdjustments: centsToDollars(
      netAdjustmentsCents
    ),

    lastPaymentDate,
    lastPaymentAmountCents,
    lastPaymentAmount:
      lastPaymentAmountCents === null
        ? null
        : centsToDollars(lastPaymentAmountCents),

    hasPendingPayment,
    pendingPaymentAmountCents,

    hasPaidPayment,
    hasFailedPayment,
    hasReversedPayment,
  };
}