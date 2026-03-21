// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { canMakePayments } from "@/lib/liveGating";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) throw new Error("Missing STRIPE_SECRET_KEY");
if (!stripeWebhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
});

function parseCents(value: string | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const metadata = intent.metadata || {};

        const propertyId = safeString(metadata.propertyId);
        const unitId = safeString(metadata.unitId);
        const tenantId = safeString(metadata.tenantId) || null;

        const baseAmountCents = parseCents(metadata.baseAmountCents);
        const convenienceFeeCents = parseCents(metadata.convenienceFeeCents);
        const totalAmountCents = parseCents(metadata.totalAmountCents);

        if (!propertyId || !unitId) {
          console.warn("Webhook skipped: missing IDs", { intentId: intent.id });
          break;
        }

        // ✅ VERIFY PROPERTY + STATUS
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
          include: {
            units: true,
            paymentConnectionStatus: true,
          },
        });

        if (!property || !property.isActive || !canMakePayments(property)) {
          console.warn("Webhook blocked: property not valid/live", {
            propertyId,
          });
          break;
        }

        // ✅ VERIFY UNIT BELONGS TO PROPERTY
        const unit = await prisma.unit.findFirst({
          where: {
            id: unitId,
            propertyId,
          },
          select: { id: true },
        });

        if (!unit) {
          console.warn("Webhook blocked: invalid unit", { unitId, propertyId });
          break;
        }

        const expectedTotalCents = baseAmountCents + convenienceFeeCents;
        const metadataSettledCents =
          totalAmountCents > 0 ? totalAmountCents : expectedTotalCents;

        const actualSettledCents =
          intent.amount_received || intent.amount || metadataSettledCents;

        if (!actualSettledCents || actualSettledCents <= 0) {
          console.warn("Webhook skipped: invalid amount", {
            intentId: intent.id,
          });
          break;
        }

        // ⚠️ OPTIONAL STRICT CHECK (recommended)
        if (actualSettledCents < expectedTotalCents) {
          console.warn("Webhook mismatch: amount less than expected", {
            intentId: intent.id,
            actualSettledCents,
            expectedTotalCents,
          });
        }

        await prisma.$transaction(async (tx) => {
          const existing = await tx.ledgerEntry.findFirst({
            where: {
              source: "STRIPE",
              sourceRef: intent.id,
            },
            select: { id: true },
          });

          if (existing) return;

          await tx.ledgerEntry.create({
            data: {
              propertyId,
              unitId,
              tenantId,
              type: "PAYMENT",
              amount: -(actualSettledCents / 100),
              source: "STRIPE",
              sourceRef: intent.id,
              description:
                convenienceFeeCents > 0
                  ? "Tenant payment (Stripe ACH + convenience fee)"
                  : "Tenant payment (Stripe ACH)",
              effectiveDate: new Date(),
            },
          });
        });

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
  }

  return NextResponse.json({ received: true });
}