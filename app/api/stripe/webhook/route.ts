// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMakePayments } from "@/lib/liveGating";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function parseCents(value: string | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  if (!stripeSecretKey) {
    console.error("Missing STRIPE_SECRET_KEY");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  if (!stripeWebhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook not configured" },
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
  } catch (error: unknown) {
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
        const tenantAssignmentIdFromMetadata =
          safeString(metadata.tenantAssignmentId) || null;

        const balanceDueCents = parseCents(metadata.baseAmountCents);
        const processingFeeCents = parseCents(metadata.processingFeeCents);
        const totalAmountCents = parseCents(metadata.totalAmountCents);

        if (!propertyId || !unitId) {
          console.warn("Webhook skipped: missing IDs", { intentId: intent.id });
          break;
        }

        const property = await prisma.property.findUnique({
          where: { id: propertyId },
          include: {
            settings: true,
            units: true,
            paymentStatus: true,
          },
        });

        if (!property || !property.isActive || !canMakePayments(property)) {
          console.warn("Webhook blocked: property not valid/live", {
            propertyId,
          });
          break;
        }

        const unit = await prisma.unit.findFirst({
          where: {
            id: unitId,
            propertyId,
          },
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
          console.warn("Webhook blocked: invalid unit", { unitId, propertyId });
          break;
        }

        const tenantAssignmentId =
          tenantAssignmentIdFromMetadata || unit.tenantAssignments[0]?.id || null;

        const expectedTotalCents = balanceDueCents + processingFeeCents;
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

        if (expectedTotalCents > 0 && actualSettledCents < expectedTotalCents) {
          console.warn("Webhook mismatch: amount less than expected", {
            intentId: intent.id,
            actualSettledCents,
            expectedTotalCents,
          });
        }

        const paymentAmount = actualSettledCents / 100;
        const processingFeeAmount = processingFeeCents / 100;
        const effectiveDate = new Date();

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existingPayment = await tx.ledgerEntry.findFirst({
            where: {
              referenceNumber: intent.id,
              entryType: "PAYMENT",
              paymentMethod: "ACH",
              unitId,
            },
            select: { id: true },
          });

          if (existingPayment) {
            return;
          }

          if (processingFeeCents > 0) {
            const existingFee = await tx.ledgerEntry.findFirst({
              where: {
                referenceNumber: `${intent.id}:fee`,
                entryType: "CHARGE",
                chargeType: "PROCESSING_FEE",
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
                  amount: processingFeeAmount,
                  effectiveDate,
                  referenceNumber: `${intent.id}:fee`,
                  memo: "ACH processing fee",
                  createdByAdminId: null,
                  createdByManagementUserId: null,
                  paymentMethod: null,
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
              memo:
                processingFeeCents > 0
                  ? "Tenant payment (Stripe ACH + processing fee)"
                  : "Tenant payment (Stripe ACH)",
              createdByAdminId: null,
              createdByManagementUserId: null,
            },
          });
        });

        break;
      }

      default:
        break;
    }
  } catch (error: unknown) {
    console.error("Stripe webhook handler error:", error);
  }

  return NextResponse.json({ received: true });
}