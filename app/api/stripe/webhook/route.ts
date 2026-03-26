import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMakePayments } from "@/lib/liveGating";
import { emitEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type PaymentLifecycleStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

function parseCents(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

async function updatePaymentStatusByIntent(
  intentId: string,
  status: PaymentLifecycleStatus
): Promise<void> {
  if (!intentId) return;

  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: intentId },
    data: { status },
  });
}

async function linkSessionPaymentToIntent(
  sessionId: string,
  intentId: string
): Promise<void> {
  if (!sessionId || !intentId) return;

  await prisma.payment.updateMany({
    where: {
      stripeSessionId: sessionId,
      OR: [
        { stripePaymentIntentId: "" },
        { stripePaymentIntentId: null as never },
      ],
    },
    data: {
      stripePaymentIntentId: intentId,
    },
  });
}

async function upsertPaymentLifecycleFromIntent(
  intent: Stripe.PaymentIntent,
  status: PaymentLifecycleStatus
): Promise<void> {
  const metadata = intent.metadata || {};

  const propertyId = safeString(metadata.propertyId);
  const unitId = safeString(metadata.unitId);
  const tenantAssignmentId = safeString(metadata.tenantAssignmentId) || null;

  if (!propertyId || !unitId || !intent.id) return;

  const amountCents = parseCents(metadata.ledgerBalanceCents);
  const processingFeeCents = parseCents(metadata.processingFeeCents);

  const existing = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.payment.update({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status,
        paymentMethod: "ACH",
      },
    });
    return;
  }

  await prisma.payment.create({
    data: {
      propertyId,
      unitId,
      tenantAssignmentId,
      stripePaymentIntentId: intent.id,
      stripeSessionId: null,
      amountCents,
      processingFeeCents,
      status,
      paymentMethod: "ACH",
    },
  });
}

export async function POST(req: Request) {
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });

  let event: Stripe.Event;

  try {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = safeString(session.id);
      const intentId =
        typeof session.payment_intent === "string"
          ? safeString(session.payment_intent)
          : "";

      if (sessionId && intentId) {
        await linkSessionPaymentToIntent(sessionId, intentId);
      }
    }

    if (event.type === "payment_intent.created") {
      const intent = event.data.object as Stripe.PaymentIntent;
      await upsertPaymentLifecycleFromIntent(intent, "PROCESSING");
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      await upsertPaymentLifecycleFromIntent(intent, "FAILED");
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : "";

      if (paymentIntentId) {
        await updatePaymentStatusByIntent(paymentIntentId, "REFUNDED");
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const metadata = intent.metadata || {};

      const propertyId = safeString(metadata.propertyId);
      const unitId = safeString(metadata.unitId);
      const tenantAssignmentIdMeta =
        safeString(metadata.tenantAssignmentId) || null;

      const ledgerCents = parseCents(metadata.ledgerBalanceCents);
      const feeCents = parseCents(metadata.processingFeeCents);
      const totalMetaCents = parseCents(metadata.totalAmountCents);

      if (!propertyId || !unitId) {
        return NextResponse.json({ received: true });
      }

      await upsertPaymentLifecycleFromIntent(intent, "PROCESSING");

      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          settings: true,
          units: true,
          paymentStatus: true,
        },
      });

      if (!property || !property.isActive || !canMakePayments(property)) {
        return NextResponse.json({ received: true });
      }

      const unit = await prisma.unit.findFirst({
        where: { id: unitId, propertyId },
        select: {
          id: true,
          tenantAssignments: {
            where: { isCurrent: true },
            orderBy: { createdAt: "desc" },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!unit) {
        return NextResponse.json({ received: true });
      }

      const tenantAssignmentId =
        tenantAssignmentIdMeta || unit.tenantAssignments[0]?.id || null;

      const stripeCents =
        intent.amount_received ??
        intent.amount ??
        totalMetaCents ??
        ledgerCents + feeCents;

      if (!stripeCents || stripeCents <= 0) {
        return NextResponse.json({ received: true });
      }

      const expectedCents = ledgerCents + feeCents;

      if (expectedCents > 0 && stripeCents !== expectedCents) {
        console.error("Stripe mismatch", {
          expectedCents,
          stripeCents,
          intentId: intent.id,
        });
      }

      const paymentAmount = centsToDollars(stripeCents);
      const feeAmount = centsToDollars(feeCents);
      const effectiveDate = new Date();

      let didCreatePayment = false;

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingPayment = await tx.ledgerEntry.findFirst({
          where: {
            referenceNumber: intent.id,
            entryType: "PAYMENT",
            unitId,
          },
          select: { id: true },
        });

        if (existingPayment) {
          return;
        }

        if (feeCents > 0) {
          const feeRef = `${intent.id}:fee`;

          const existingFee = await tx.ledgerEntry.findFirst({
            where: {
              referenceNumber: feeRef,
              entryType: "CHARGE",
              unitId,
            },
            select: { id: true },
          });

          if (!existingFee) {
            await tx.ledgerEntry.create({
              data: {
                propertyId,
                unitId,
                tenantAssignmentId,
                entryType: "CHARGE",
                chargeType: "PROCESSING_FEE",
                amount: feeAmount,
                effectiveDate,
                referenceNumber: feeRef,
                memo: "Processing fee",
              },
            });
          }
        }

        await tx.ledgerEntry.create({
          data: {
            propertyId,
            unitId,
            tenantAssignmentId,
            entryType: "PAYMENT",
            paymentMethod: "ACH",
            amount: -paymentAmount,
            effectiveDate,
            referenceNumber: intent.id,
            memo: "Tenant payment",
          },
        });

        didCreatePayment = true;

        await tx.auditLog.create({
          data: {
            propertyId,
            actorType: "SYSTEM",
            action: "STRIPE_PAYMENT_RECEIVED",
            targetType: "LEDGER_ENTRY",
            targetId: intent.id,
            summary: "Stripe payment recorded",
            metadataJson: JSON.stringify({
              intentId: intent.id,
              stripeCents,
              expectedCents,
              feeCents,
              unitId,
            }),
          },
        });
      });

      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: {
          status: "PAID",
          paymentMethod: "ACH",
        },
      });

      if (didCreatePayment) {
        emitEvent("payment:update", {
          propertyId,
          unitId,
          source: "STRIPE",
        });

        emitEvent("ledger:update", {
          propertyId,
          unitId,
          source: "STRIPE",
        });
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}