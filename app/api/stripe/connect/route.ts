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
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    let accountId = property.stripeAccountId;

    if (accountId) {
      await stripe.accounts.update(accountId, {
        business_profile: {
          name: property.name,
          product_description: `Property management and rent collection for ${property.name}`,
        },
      });
    } else {
      const account = await stripe.accounts.create({
        type: "express",
        business_type: "company",
        business_profile: {
          name: property.name,
          product_description: `Property management and rent collection for ${property.name}`,
        },
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      await prisma.property.update({
        where: { id: property.id },
        data: { stripeAccountId: accountId },
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:10000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/manager/dashboard`,
      return_url: `${baseUrl}/manager/dashboard`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
    });
  } catch (err: unknown) {
    console.error("STRIPE CONNECT ERROR:", err);

    const message =
      err instanceof Error && err.message ? err.message : "Stripe error";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}