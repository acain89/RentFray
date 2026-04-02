import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getProcessingFeeCents, formatCentsToDollars } from "@/lib/billingConfig";
import { canMakePayments } from "@/lib/liveGating";

type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED";

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

function getCurrentBillingCycle(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function buildDueDate(now: Date, dueDay: number): Date {
  const safeDueDay = Number.isFinite(dueDay)
    ? Math.max(1, Math.min(28, Math.trunc(dueDay)))
    : 1;

  return now.getDate() > safeDueDay
    ? new Date(now.getFullYear(), now.getMonth() + 1, safeDueDay)
    : new Date(now.getFullYear(), now.getMonth(), safeDueDay);
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

    const ledger = await getUnitLedgerSummary(unit.id);

    const balanceCents = Math.max(0, ledger.balanceCents);
    const processingFeeCents = getProcessingFeeCents(balanceCents);
    const totalDueCents = balanceCents + processingFeeCents;

    const paymentEnabled = canMakePayments({
      status: property.status,
      settings: property.settings,
      units: property.units,
      paymentConnectionStatus: property.paymentStatus,
    });

    const today = new Date();
    const billingCycle = getCurrentBillingCycle(today);

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
      balanceCents <= 0
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
        voidedAt: null,
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        entryType: true,
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

    const dueDay = property.settings?.rentDueDay ?? 1;
    const graceDays = property.settings?.gracePeriodDays ?? 0;

    const dueDate = buildDueDate(today, dueDay);

    const graceEndsOn = new Date(dueDate);
    graceEndsOn.setDate(graceEndsOn.getDate() + Math.max(0, graceDays));

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

      balance: formatCentsToDollars(balanceCents),
      processingFee: formatCentsToDollars(processingFeeCents),
      totalDue: formatCentsToDollars(totalDueCents),

      totalPaidCents: ledger.totalPaidCents,
      totalPaid: formatCentsToDollars(ledger.totalPaidCents),

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

      dueDate: dueDate.toISOString(),
      graceEndsOn: graceEndsOn.toISOString(),

      ledger: filteredLedgerEntries.map(
        (entry: (typeof filteredLedgerEntries)[number]) => ({
          id: entry.id,
          type: entry.entryType,
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