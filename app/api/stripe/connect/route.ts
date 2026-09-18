import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiError = {
  error: string;
};

type ApiSuccess = {
  ok: true;
  url: string;
};

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const requestOrigin = new URL(request.url).origin;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() || requestOrigin;

    if (!secretKey) {
      return NextResponse.json<ApiError>(
        { error: "Stripe is not configured." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const session = await getSession();

    if (!session || session.role !== "OWNER" || !session.propertyId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized" },
        { status: 401 }
      );
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
      return NextResponse.json<ApiError>(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    let accountId = property.stripeAccountId;

    if (accountId) {
      // Existing RentFray property:
      // Always reuse its stored Stripe Connect account.
      await stripe.accounts.update(accountId, {
        business_profile: {
          name: property.name,
          product_description:
            `Property management and rent collection for ${property.name}`,
        },
      });
    } else {
      /*
       * IMPORTANT:
       *
       * Stripe account creation is idempotent per RentFray property.
       *
       * If the browser double-submits, the user double-clicks, or two
       * requests reach this route simultaneously, Stripe will return the
       * same Connect account instead of creating duplicate accounts.
       */
      const account = await stripe.accounts.create(
        {
          type: "express",
          business_type: "individual",
          business_profile: {
            name: property.name,
            product_description:
              `Property management and rent collection for ${property.name}`,
          },
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
            us_bank_account_ach_payments: { requested: true },
          },
        },
        {
          idempotencyKey: `rentfray-connect-account-${property.id}`,
        }
      );

      accountId = account.id;

      /*
       * Only write the Stripe account ID if the property still does not
       * have one.
       *
       * This provides an additional database-side guard against a
       * concurrent request overwriting an already-established mapping.
       */
      await prisma.property.updateMany({
        where: {
          id: property.id,
          stripeAccountId: null,
        },
        data: {
          stripeAccountId: accountId,
        },
      });

      /*
       * Re-read the authoritative mapping.
       *
       * Under normal operation this will equal account.id. If another
       * request established the mapping first, RentFray uses the account
       * stored on the Property rather than overwriting it.
       */
      const updatedProperty = await prisma.property.findUnique({
        where: { id: property.id },
        select: {
          stripeAccountId: true,
        },
      });

      if (!updatedProperty?.stripeAccountId) {
        throw new Error(
          "Stripe account was created but could not be associated with the property."
        );
      }

      accountId = updatedProperty.stripeAccountId;
    }

    const stripeAccount = await stripe.accounts.retrieve(accountId);

    const paymentStatusData = {
      processorConnected: true,
      bankConnected: true,
      chargesEnabled: Boolean(stripeAccount.charges_enabled),
      payoutsEnabled: Boolean(stripeAccount.payouts_enabled),
      onboardingComplete: Boolean(stripeAccount.details_submitted),
      requirementsDue: Boolean(
        stripeAccount.requirements?.currently_due?.length
      ),
      requirementsSummary:
        stripeAccount.requirements?.disabled_reason ?? null,
      lastSyncedAt: new Date(),
      readyForLive:
        Boolean(stripeAccount.charges_enabled) &&
        Boolean(stripeAccount.payouts_enabled),
    };

    await prisma.property.update({
      where: { id: property.id },
      data: {
        paymentStatus: {
          upsert: {
            create: paymentStatusData,
            update: paymentStatusData,
          },
        },
      },
    });

    const stripeReturnUrl =
      `${baseUrl}/manager/dashboard?panel=bank&returnTo=setup&stripeReturn=1`;

    const stripeRefreshUrl =
      `${baseUrl}/manager/dashboard?panel=bank&returnTo=setup&stripeRefresh=1`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: stripeRefreshUrl,
      return_url: stripeReturnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json<ApiSuccess>({
      ok: true,
      url: accountLink.url,
    });
  } catch (error: unknown) {
    console.error("POST /api/stripe/connect error:", error);

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Stripe error";

    return NextResponse.json<ApiError>(
      { error: message },
      { status: 500 }
    );
  }
}