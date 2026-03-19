// app/api/payments/create-session/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "TENANT" || !session.unitId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const amount = Number(body.amount || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        property: true,
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      );
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Rent Payment - Unit ${unit.unitNumber}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        propertyId: session.propertyId,
        unitId: session.unitId,
      },
      success_url: `${process.env.APP_URL}/tenant/payment-history`,
      cancel_url: `${process.env.APP_URL}/tenant/dashboard`,
    });

    return NextResponse.json({
      ok: true,
      url: checkout.url,
    });
  } catch (error) {
    console.error("create-session error", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}