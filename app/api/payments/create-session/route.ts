import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession, refreshSessionCookie } from "@/lib/session";
import { canMakePayments } from "@/lib/liveGating";
import { checkRateLimit } from "@/lib/rateLimit";
import { getUnitFinancialState } from "@/lib/unitFinancialState";
import { assertValidTransition } from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

class CheckoutBlocked extends Error {}

type CheckoutPayment = {
  id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
  billingCycle: string | null; amountCents: number; processingFeeCents: number | null;
  stripeSessionId: string | null; stripePaymentIntentId: string | null;
  status: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED"; createdAt: Date;
};

async function lockCheckout(tx: Prisma.TransactionClient, payment: {
  propertyId: string; unitId: string; tenantAssignmentId: string; billingCycle?: string | null;
}) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${payment.propertyId}:${payment.unitId}:${payment.tenantAssignmentId}`}))`;
  if (payment.billingCycle) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${payment.propertyId}:${payment.unitId}:${payment.tenantAssignmentId}:${payment.billingCycle}`}))`;
  }
}

function checkoutParameters(payment: CheckoutPayment, property: { name: string; stripeAccountId: string | null }, unitNumber: string) {
  const origin = process.env.NODE_ENV === "production" ? "https://rentfray.com" : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:10000";
  const fee = payment.processingFeeCents ?? 0;
  const metadata = {
    paymentId: payment.id, propertyId: payment.propertyId, unitId: payment.unitId,
    tenantAssignmentId: payment.tenantAssignmentId!, stripeAccountId: property.stripeAccountId!,
    ledgerBalanceCents: String(payment.amountCents), processingFeeCents: String(fee),
    totalAmountCents: String(payment.amountCents + fee), billingCycle: payment.billingCycle!,
    paymentStartedAt: payment.createdAt.toISOString(),
  };
  return {
    mode: "payment", payment_method_types: ["us_bank_account"], customer_creation: "if_required",
    payment_method_options: { us_bank_account: { verification_method: "instant", financial_connections: { permissions: ["payment_method"] } } },
    payment_intent_data: { application_fee_amount: fee, on_behalf_of: property.stripeAccountId!,
      transfer_data: { destination: property.stripeAccountId! }, metadata },
    metadata,
    line_items: [
      { price_data: { currency: "usd", product_data: { name: `${property.name} Unit ${unitNumber}` }, unit_amount: payment.amountCents }, quantity: 1 },
      ...(fee > 0 ? [{ price_data: { currency: "usd", product_data: { name: "Processing Fee" }, unit_amount: fee }, quantity: 1 }] : []),
    ],
    success_url: `${origin}/tenant/dashboard`, cancel_url: `${origin}/tenant/pay?checkout=cancelled`,
  } as Stripe.Checkout.SessionCreateParams;
}

async function inspectCheckout(stripe: Stripe, payment: CheckoutPayment): Promise<Stripe.Checkout.Session | null> {
  if (!payment.stripeSessionId) {
    if (payment.stripePaymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (intent.status === "canceled") return null;
      throw new CheckoutBlocked("An existing payment requires reconciliation before another attempt.");
    }
    // No Stripe ID can mean a timed-out create. It remains a recoverable reservation, not proof of failure.
    return { id: "", status: "open", url: null } as Stripe.Checkout.Session;
  }
  const checkout = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
  const metadata = checkout.metadata ?? {};
  if (metadata.paymentId !== payment.id || metadata.propertyId !== payment.propertyId ||
    metadata.unitId !== payment.unitId || metadata.tenantAssignmentId !== payment.tenantAssignmentId ||
    metadata.billingCycle !== payment.billingCycle ||
    checkout.amount_total !== payment.amountCents + (payment.processingFeeCents ?? 0)) {
    throw new CheckoutBlocked("Existing Checkout identity/quote mismatch.");
  }
  if (checkout.status === "expired") return null;
  if (checkout.status === "open" && checkout.url) return checkout;
  if (checkout.status === "complete" && checkout.payment_intent) {
    const intentId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent.id;
    if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== intentId) throw new CheckoutBlocked("Intent identity mismatch.");
    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (intent.status === "canceled") return null;
  }
  throw new CheckoutBlocked("A payment is processing or awaiting authoritative reconciliation.");
}

async function recoverCheckout(stripe: Stripe, reservation: CheckoutPayment) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockCheckout(tx, { ...reservation, tenantAssignmentId: reservation.tenantAssignmentId! });
    const payment = await tx.payment.findUnique({ where: { id: reservation.id } }) as CheckoutPayment | null;
    if (!payment || payment.status === "PAID" || payment.status === "REVERSED") throw new CheckoutBlocked("Payment already settled.");
    const existing = await inspectCheckout(stripe, payment);
    if (!existing) throw new CheckoutBlocked("Checkout is no longer collectible; retry to obtain a current quote.");
    if (existing.id && existing.url) return existing.url;
    const quote = await tx.auditLog.findFirst({ where: {
      targetType: "PAYMENT", targetId: payment.id, action: "PAYMENT_CHECKOUT_RESERVED",
    }, orderBy: { createdAt: "desc" } });
    if (!quote?.metadataJson || Date.now() - payment.createdAt.getTime() >= 23 * 60 * 60 * 1000) {
      throw new CheckoutBlocked("Unresolved Checkout reservation cannot safely be recreated.");
    }
    const params = JSON.parse(quote.metadataJson) as Stripe.Checkout.SessionCreateParams;
    if (params.metadata?.paymentId !== payment.id || Number(params.metadata?.ledgerBalanceCents) !== payment.amountCents ||
      Number(params.metadata?.processingFeeCents) !== (payment.processingFeeCents ?? 0)) throw new CheckoutBlocked("Reserved quote mismatch.");
    // Reservation and exact parameters were committed BEFORE Stripe creation. A failed transaction preserves them.
    const checkout = await stripe.checkout.sessions.create(params, { idempotencyKey: `rentfray-checkout-${payment.id}` });
    await tx.payment.update({ where: { id: payment.id }, data: {
      stripeSessionId: checkout.id,
      ...(typeof checkout.payment_intent === "string" ? { stripePaymentIntentId: checkout.payment_intent } : {}),
    } });
    if (checkout.status !== "open" || !checkout.url) throw new CheckoutBlocked("Existing Checkout is processing or no longer open.");
    return checkout.url;
  }, { timeout: 60_000 });
}

async function reserveCheckout(stripe: Stripe, unit: Prisma.UnitGetPayload<{
  include: { tier: true; property: { include: { settings: true; paymentStatus: true; units: true } } };
}>, tenantAssignmentId: string): Promise<CheckoutPayment> {
  const property = unit.property;
  const financialInput = {
    propertyId: property.id, unitId: unit.id, tenantAssignmentId, tier: unit.tier,
    propertySettings: property.settings, rentFrayStartDate: property.rentFrayStartDate,
  };
  for (let pass = 0; pass < 2; pass++) {
    const reservation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCheckout(tx, { propertyId: property.id, unitId: unit.id, tenantAssignmentId });
      const candidates = await tx.payment.findMany({ where: {
        propertyId: property.id, unitId: unit.id, tenantAssignmentId, paymentMethod: "ACH",
        status: { in: ["UNPAID", "PENDING", "FAILED"] },
      }, orderBy: { createdAt: "asc" } });
      const collectible: CheckoutPayment[] = [];
      let retired = false;
      for (const candidate of candidates) {
        const checkout = await inspectCheckout(stripe, candidate);
        if (checkout) collectible.push(candidate);
        else if (candidate.status !== "FAILED") {
          retired = true;
          assertValidTransition(candidate.status, "FAILED");
          await tx.payment.update({ where: { id: candidate.id }, data: { status: "FAILED", failedAt: new Date() } });
        }
      }
      if (collectible.length > 1) throw new CheckoutBlocked("Multiple existing payment attempts require reconciliation.");
      if (collectible.length === 1) return collectible[0];
      // The financial SSOT uses the shared client, so commit retired PENDING states first.
      // Reacquire the same tenancy lock and recheck every attempt before quoting.
      if (retired) return null;
      // Recompute via the financial SSOT only after competing attempts have proven noncollectible.
      const financial = await getUnitFinancialState(financialInput);
      await lockCheckout(tx, { propertyId: property.id, unitId: unit.id, tenantAssignmentId, billingCycle: financial.billingCycle });
      const principal = Math.max(0, toSafeInteger(financial.ledgerBalanceCents));
      if (principal <= 0) throw new CheckoutBlocked("No balance due.");
      if (financial.hasPendingPayment) throw new CheckoutBlocked("A payment is already processing.");
      const fee = toSafeInteger(financial.processingFeeCents);
      if (fee < 0 || financial.tenantTotalDueCents !== principal + fee) throw new CheckoutBlocked("Payment quote cannot be reconciled.");
      const payment = await tx.payment.create({ data: {
        propertyId: property.id, unitId: unit.id, tenantAssignmentId, billingCycle: financial.billingCycle,
        amountCents: principal, processingFeeCents: fee, status: "UNPAID", paymentMethod: "ACH",
      } });
      await tx.auditLog.create({ data: {
        propertyId: property.id, actorType: "SYSTEM", action: "PAYMENT_CHECKOUT_RESERVED",
        targetType: "PAYMENT", targetId: payment.id,
        metadataJson: JSON.stringify(checkoutParameters(payment, property, unit.unitNumber)),
      } });
      return payment;
    }, { timeout: 60_000 });
    if (reservation) return reservation;
  }
  throw new CheckoutBlocked("Payment attempts changed; retry to obtain a current quote.");
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(
      `create-session:${ip}`,
      10,
      60_000
    );

    if (!rateLimit.ok) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            "Too many payment attempts. Please wait a minute and try again.",
        },
        { status: 429 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Stripe not configured.",
        },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId ||
      !session.tenantAssignmentId
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await refreshSessionCookie(session);

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        tier: true,
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
        tenantAssignments: {
          where: {
            id: session.tenantAssignmentId,
            propertyId: session.propertyId,
            unitId: session.unitId,
            isCurrent: true,
            OR: [{ moveOutDate: null }, { moveOutDate: { gt: new Date() } }],
          },
          orderBy: [
            { moveInDate: "desc" },
            { createdAt: "desc" },
          ],
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unit not found.",
        },
        { status: 404 }
      );
    }

    const property = unit.property;

    if (
      !canMakePayments({
        status: property.status,
        settings: property.settings,
        units: property.units,
        paymentStatus: property.paymentStatus,
        isActive: property.isActive,
      })
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Payments unavailable.",
        },
        { status: 400 }
      );
    }

    if (!property.stripeAccountId) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Bank account not connected.",
        },
        { status: 400 }
      );
    }

    const assignment = unit.tenantAssignments.find((item: { id: string }) => item.id === session.tenantAssignmentId);
    if (!assignment) {
      return NextResponse.json<ApiError>({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const tenantAssignmentId = assignment.id;

    const reservation = await reserveCheckout(stripe, unit, tenantAssignmentId);
    const url = await recoverCheckout(stripe, reservation);
    return NextResponse.json<ApiSuccess<{ url: string }>>({ ok: true, data: { url } });
  } catch (error) {
    console.error(
      "create-session error:",
      error
    );

    if (error instanceof CheckoutBlocked) {
      return NextResponse.json<ApiError>({ ok: false, error: error.message }, { status: 400 });
    }

    if (
      error instanceof
      Stripe.errors.StripeError
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            error.message ||
            "Stripe error.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiError>(
      {
        ok: false,
        error:
          "Failed to create payment session.",
      },
      { status: 500 }
    );
  }
}
