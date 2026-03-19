// app/api/stripe/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed.", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const propertyId = String(session.metadata?.propertyId || "");
      const unitId = String(session.metadata?.unitId || "");

      const amountTotal = (session.amount_total || 0) / 100;

      if (!propertyId || !unitId || !amountTotal) {
        console.error("Missing metadata in Stripe session");
        return NextResponse.json({ received: true });
      }

      // Prevent duplicate entries using Stripe session ID
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
            type: "PAYMENT",
            amount: -Math.abs(amountTotal),
            method: "ACH",
            reference: session.id,
            note: "Stripe ACH Payment",
            effectiveDate: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook error", error);
    return NextResponse.json(
      { error: "Webhook error" },
      { status: 500 }
    );
  }
}