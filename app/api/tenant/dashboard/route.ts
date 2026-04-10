
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import {
  getProcessingFeeCents,
  formatCentsToDollars,
} from "@/lib/billingConfig";
import { canMakePayments } from "@/lib/liveGating";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

type StatementItem = {
  label: string;
  amount: number;
};

function buildTenantName(firstName: string | null, lastName: string | null) {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Tenant";
}

function normalizePaymentStatus(value: unknown): PaymentStatus | null {
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
  return Number((cents / 100).toFixed(2));
}

function buildStatementLabel(entry: {
  entryType: string;
  chargeType: string | null;
  memo: string | null;
}) {
  if (entry.memo && entry.memo.trim()) {
    return entry.memo.trim();
  }

  if (entry.entryType === "PAYMENT") return "Payment";
  if (entry.entryType === "CREDIT") return "Credit";
  if (entry.entryType === "ADJUSTMENT") return "Adjustment";

  switch (entry.chargeType) {
    case "RENT":
      return "Rent";
    case "LATE_FEE":
      return "Late Fee";
    case "RECURRING_FEE":
      return "Recurring Charge";
    case "PROCESSING_FEE":
      return "Processing Fee";
    case "OTHER_FEE":
      return "Other Charge";
    default:
      return "Charge";
  }
}

export async function POST() {
  try {
    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        tier: {
          select: {
            rentDueDay: true,
            gracePeriodDays: true,
            lateFeeInitialCents: true,
            lateFeeDailyCents: true,
            maxLateFeeDays: true,
          },
        },
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }

    const property = unit.property;

    const currentAssignment = await prisma.tenantAssignment.findFirst({
      where: {
        propertyId: session.propertyId,
        unitId: unit.id,
        isCurrent: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });

    const currentAssignmentId = currentAssignment?.id ?? null;

    const ledgerSummary = await getUnitLedgerSummary(
      unit.id,
      currentAssignmentId
    );

    const balanceCents = Math.max(0, ledgerSummary.balanceCents);
    const processingFeeCents =
      balanceCents > 0 ? getProcessingFeeCents(balanceCents) : 0;
    const totalDueCents =
      balanceCents > 0 ? balanceCents + processingFeeCents : 0;

    const paymentEnabled = canMakePayments({
      status: property.status,
      settings: property.settings,
      units: property.units,
      paymentConnectionStatus: property.paymentStatus,
    });

    const effectiveBillingSettings = resolveEffectiveBillingSettings({
      tier: unit.tier,
      propertySettings: property.settings,
    });

    const rentDates = getRentDateSummary(effectiveBillingSettings);
    const billingCycle = rentDates.billingCycle;

    const cyclePayments = await prisma.payment.findMany({
      where: {
        propertyId: session.propertyId,
        unitId: session.unitId,
        billingCycle,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        amountCents: true,
        processingFeeCents: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        failedAt: true,
        reversedAt: true,
        stripePaymentIntentId: true,
        stripeSessionId: true,
      },
    });

    const latestPayment = cyclePayments[0] ?? null;
    const latestPaymentStatus = normalizePaymentStatus(latestPayment?.status);

    const tenantPaymentStatus: PaymentStatus =
      totalDueCents <= 0
        ? "PAID"
        : latestPaymentStatus === "PENDING"
        ? "PENDING"
        : latestPaymentStatus === "FAILED"
        ? "FAILED"
        : latestPaymentStatus === "REVERSED"
        ? "REVERSED"
        : "UNPAID";

    let paymentMessage = "Payment required.";
    if (tenantPaymentStatus === "PENDING") paymentMessage = "Processing";
    if (tenantPaymentStatus === "PAID") paymentMessage = "Payment successful";
    if (tenantPaymentStatus === "FAILED") paymentMessage = "Payment failed";
    if (tenantPaymentStatus === "REVERSED") paymentMessage = "Payment reversed";
    if (tenantPaymentStatus === "UNPAID") paymentMessage = "Payment required";

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        propertyId: session.propertyId,
        unitId: session.unitId,
        tenantAssignmentId: currentAssignmentId,
        voidedAt: null,
      },
      orderBy: [
        { effectiveDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: {
        id: true,
        entryType: true,
        chargeType: true,
        billingCycle: true,
        amountCents: true,
        effectiveDate: true,
        memo: true,
        referenceNumber: true,
        payment: {
          select: {
            status: true,
            paidAt: true,
            failedAt: true,
            reversedAt: true,
            createdAt: true,
          },
        },
      },
    });

    const filteredLedgerEntries = ledgerEntries.filter(
      (entry: (typeof ledgerEntries)[number]) => {
        if (entry.entryType !== "PAYMENT") return true;
        return normalizePaymentStatus(entry.payment?.status) === "PAID";
      }
    );

    const isDelinquent = balanceCents > 0 && rentDates.isDelinquent;

    const statementSourceEntries = filteredLedgerEntries;

    let rentCents = 0;
    let recurringChargesCents = 0;
    let lateFeesCents = 0;
    let creditsCents = 0;

    const statementItems: StatementItem[] = statementSourceEntries.map(
      (entry: (typeof statementSourceEntries)[number]) => {
        const isCreditLike =
          entry.entryType === "PAYMENT" ||
          entry.entryType === "CREDIT" ||
          entry.entryType === "ADJUSTMENT";

        if (entry.entryType === "CHARGE") {
          if (entry.chargeType === "RENT") {
            rentCents += entry.amountCents;
          } else if (entry.chargeType === "LATE_FEE") {
            lateFeesCents += entry.amountCents;
          } else if (
            entry.chargeType === "RECURRING_FEE" ||
            entry.chargeType === "OTHER_FEE"
          ) {
            recurringChargesCents += entry.amountCents;
          }
        } else if (isCreditLike) {
          creditsCents += Math.abs(entry.amountCents);
        }

        return {
          label: buildStatementLabel(entry),
          amount: centsToDollars(
            isCreditLike ? -Math.abs(entry.amountCents) : entry.amountCents
          ),
        };
      }
    );

    const subtotalCents = rentCents + recurringChargesCents + lateFeesCents;

    return NextResponse.json({
      ok: true,

      tenantName: buildTenantName(
        unit.portalFirstName ?? null,
        unit.portalLastName ?? null
      ),

      propertyName: property.name,
      propertyStatus: property.status,
      paymentEnabled,

      unitNumber: unit.unitNumber,
      unitId: unit.id,
      billingCycle,

      balanceCents,
      processingFeeCents,
      totalDueCents,

      balance: balanceCents / 100,
      processingFee: formatCentsToDollars(processingFeeCents),
      totalDue: formatCentsToDollars(totalDueCents),

      totalPaidCents: ledgerSummary.totalPaidCents,
      totalPaid: ledgerSummary.totalPaidCents / 100,
      isDelinquent,

      statement: {
        rent: centsToDollars(rentCents),
        recurringCharges: centsToDollars(recurringChargesCents),
        lateFees: centsToDollars(lateFeesCents),
        processingFee: centsToDollars(processingFeeCents),
        credits: centsToDollars(creditsCents),
        subtotal: centsToDollars(subtotalCents),
        totalDue: centsToDollars(totalDueCents),
        items: statementItems,
      },

      paymentStatus: tenantPaymentStatus,
      paymentMessage,
      latestPaymentTimestamp:
        latestPayment?.paidAt?.toISOString() ??
        latestPayment?.failedAt?.toISOString() ??
        latestPayment?.reversedAt?.toISOString() ??
        latestPayment?.createdAt?.toISOString() ??
        null,

      paymentHistory: cyclePayments.map(
        (payment: (typeof cyclePayments)[number]) => ({
          id: payment.id,
          amountCents: payment.amountCents,
          processingFeeCents: payment.processingFeeCents ?? 0,
          totalChargedCents:
            payment.amountCents + (payment.processingFeeCents ?? 0),
          amount: centsToDollars(payment.amountCents),
          processingFee: centsToDollars(payment.processingFeeCents ?? 0),
          totalCharged: centsToDollars(
            payment.amountCents + (payment.processingFeeCents ?? 0)
          ),
          status: normalizePaymentStatus(payment.status) ?? "UNPAID",
          timestamp:
            payment.paidAt?.toISOString() ??
            payment.failedAt?.toISOString() ??
            payment.reversedAt?.toISOString() ??
            payment.createdAt.toISOString(),
          message:
            normalizePaymentStatus(payment.status) === "PENDING"
              ? "Processing"
              : normalizePaymentStatus(payment.status) === "PAID"
              ? "Payment successful"
              : normalizePaymentStatus(payment.status) === "FAILED"
              ? "Payment failed"
              : normalizePaymentStatus(payment.status) === "REVERSED"
              ? "Payment reversed"
              : "Payment required",
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeSessionId: payment.stripeSessionId,
        })
      ),

      dueDate: rentDates.dueDate,
      graceEndsOn: rentDates.graceEndsOn,
      initialLateFeeDate: rentDates.initialLateFeeDate,
      dailyLateFeeStartDate: rentDates.dailyLateFeeStartDate,
      dailyLateFeeLastDate: rentDates.dailyLateFeeLastDate,

      ledger: filteredLedgerEntries.map(
        (entry: (typeof filteredLedgerEntries)[number]) => ({
          id: entry.id,
          type: entry.entryType,
          chargeType: entry.chargeType ?? null,
          billingCycle: entry.billingCycle ?? null,
          amountCents: entry.amountCents,
          amount: formatCentsToDollars(entry.amountCents),
          effectiveDate: entry.effectiveDate.toISOString(),
          memo: entry.memo ?? null,
          referenceNumber: entry.referenceNumber ?? null,
        })
      ),
    });
  } catch (error) {
    console.error("POST /api/tenant/dashboard failed", error);

    return NextResponse.json(
      { error: "Failed to load dashboard." },
      { status: 500 }
    );
  }
}
