import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-02-25.clover",
});

export async function POST() {
  try {
    const session = await getSession();

    if (!session || session.role !== "OWNER" || !session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      select: { stripeAccountId: true },
    });

    if (!property?.stripeAccountId) {
      return NextResponse.json(
        { error: "No Stripe account found" },
        { status: 400 }
      );
    }

    const link = await stripe.accountLinks.create({
      account: property.stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/manager/bank`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/manager/bank`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}