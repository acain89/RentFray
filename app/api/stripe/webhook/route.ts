// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  return secret;
}

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const body = await req.text();
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed.", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const propertyId = String(session.metadata?.propertyId || "");
      const unitId = String(session.metadata?.unitId || "");
      const tenantId = String(session.metadata?.tenantId || "");
      const amountTotal = Number(session.amount_total || 0) / 100;

      if (!propertyId || !unitId || amountTotal <= 0) {
        console.error("Missing metadata in Stripe session");
        return NextResponse.json({ received: true });
      }

      const existing = await prisma.ledgerEntry.findFirst({
        where: {
          reference: session.id,
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.ledgerEntry.create({
          data: {
            propertyId,
            unitId,
            tenantId: tenantId || null,
            type: "PAYMENT",
            amount: -Math.abs(amountTotal),
            effectiveDate: new Date(),
            memo: "Stripe ACH Payment",
            source: "STRIPE",
            reference: session.id,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook error", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}