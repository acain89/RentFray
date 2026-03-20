// app/api/payments/create-session/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: session.unitId },
      include: {
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeAssignment = unit.assignments[0] ?? null;
    const tenant = activeAssignment?.tenant ?? null;

    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant found" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const stripe = getStripe();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      customer_email: tenant.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Rent payment - Unit ${unit.unitNumber}`,
            },
            unit_amount: Math.round(amount * 100),
          },
        },
      ],
      success_url: `${origin}/tenant?payment=success`,
      cancel_url: `${origin}/tenant?payment=cancelled`,
      metadata: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: tenant.id,
        amount: String(amount),
      },
    });

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}