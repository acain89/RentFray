import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getSession, refreshSessionCookie } from "@/lib/session";
import { canMakePayments } from "@/lib/liveGating";
import { checkRateLimit } from "@/lib/rateLimit";
import { getUnitFinancialState } from "@/lib/unitFinancialState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

function toSafeInteger(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(
      `create-session:${ip}`,
      10,
      60_000
    );

    if (!rateLimit.ok) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            "Too many payment attempts. Please wait a minute and try again.",
        },
        { status: 429 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Stripe not configured.",
        },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const session = await getSession();

    if (
      !session ||
      session.role !== "TENANT" ||
      !session.unitId ||
      !session.propertyId
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await refreshSessionCookie(session);

    const unit = await prisma.unit.findFirst({
      where: {
        id: session.unitId,
        propertyId: session.propertyId,
      },
      include: {
        tier: true,
        property: {
          include: {
            settings: true,
            paymentStatus: true,
            units: true,
          },
        },
        tenantAssignments: {
          where: {
            isCurrent: true,
          },
          orderBy: [
            { moveInDate: "desc" },
            { createdAt: "desc" },
          ],
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unit not found.",
        },
        { status: 404 }
      );
    }

    const property = unit.property;

    if (
      !canMakePayments({
        status: property.status,
        settings: property.settings,
        units: property.units,
        paymentStatus: property.paymentStatus,
        isActive: property.isActive,
      })
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Payments unavailable.",
        },
        { status: 400 }
      );
    }

    if (!property.stripeAccountId) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Bank account not connected.",
        },
        { status: 400 }
      );
    }

    const assignment = unit.tenantAssignments[0] ?? null;
    const tenantAssignmentId = assignment?.id ?? null;

    const financialState = await getUnitFinancialState({
      propertyId: property.id,
      unitId: unit.id,
      tenantAssignmentId,
      tier: unit.tier,
      propertySettings: property.settings,
      rentFrayStartDate: property.rentFrayStartDate,
    });

    const balanceCents = Math.max(
      0,
      toSafeInteger(
        financialState.ledgerBalanceCents
      )
    );

    if (balanceCents <= 0) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "No balance due.",
        },
        { status: 400 }
      );
    }

    if (financialState.hasPendingPayment) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            "A payment is already processing for this billing cycle.",
        },
        { status: 400 }
      );
    }

    const processingFeeCents =
      financialState.processingFeeCents;

    const totalCents =
      financialState.tenantTotalDueCents;

    const billingCycle =
      financialState.billingCycle;

    /*
     * Create a payment ATTEMPT, not a processing payment.
     *
     * UNPAID means Stripe Checkout has been started but the tenant
     * has not yet submitted an ACH payment.
     *
     * Stripe webhooks are the authority that move this record to:
     *
     *   PENDING -> ACH actually submitted / processing
     *   PAID    -> ACH succeeded
     *   FAILED  -> ACH failed
     *
     * This prevents an abandoned Checkout Session from appearing
     * as a payment that is processing.
     */
    const createdPayment =
      await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(
                ${`${property.id}:${unit.id}:${tenantAssignmentId ?? "none"}:${billingCycle}`}
              )
            )
          `;

          /*
           * A real processing or completed payment blocks another
           * payment for this billing cycle.
           *
           * UNPAID attempts intentionally do NOT block a new attempt.
           * They represent Checkout Sessions that may have been
           * cancelled, abandoned, expired, or otherwise never
           * submitted to Stripe.
           */
          const existing =
            await tx.payment.findFirst({
              where: {
                propertyId: property.id,
                unitId: unit.id,
                ...(tenantAssignmentId
                  ? { tenantAssignmentId }
                  : {}),
                billingCycle,
                status: {
                  in: ["PENDING", "PAID"],
                },
              },
              select: {
                id: true,
              },
            });

          if (existing) {
            return null;
          }

          return tx.payment.create({
            data: {
              propertyId: property.id,
              unitId: unit.id,
              tenantAssignmentId:
                tenantAssignmentId ?? undefined,
              billingCycle,
              amountCents: balanceCents,
              processingFeeCents,
              status: "UNPAID",
              paymentMethod: "ACH",
            },
          });
        }
      );

    if (!createdPayment) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            "A payment is already processing or has already been paid for this billing cycle.",
        },
        { status: 400 }
      );
    }

    const origin =
      process.env.NODE_ENV === "production"
        ? "https://rentfray.com"
        : process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:10000";

    const paymentMetadata = {
      paymentId: createdPayment.id,
      propertyId: property.id,
      unitId: unit.id,

      tenantAssignmentId:
        tenantAssignmentId || "__NONE__",

      stripeAccountId:
        property.stripeAccountId,

      ledgerBalanceCents:
        String(balanceCents),

      processingFeeCents:
        String(processingFeeCents),

      totalAmountCents:
        String(totalCents),

      billingCycle,

      paymentStartedAt:
        new Date().toISOString(),
    };

    let checkoutSession: Stripe.Checkout.Session;

    try {
      checkoutSession =
        await stripe.checkout.sessions.create(
          {
            mode: "payment",

            payment_method_types: [
              "us_bank_account",
            ],

            customer_creation:
              "if_required",

            payment_method_options: {
              us_bank_account: {
                verification_method:
                  "instant",
                financial_connections: {
                  permissions: [
                    "payment_method",
                  ],
                },
              },
            },

            payment_intent_data: {
              application_fee_amount:
                processingFeeCents,

              on_behalf_of:
                property.stripeAccountId,

              transfer_data: {
                destination:
                  property.stripeAccountId,
              },

              metadata:
                paymentMetadata,
            },

            metadata:
              paymentMetadata,

            line_items: [
              {
                price_data: {
                  currency: "usd",

                  product_data: {
                    name:
                      `${property.name} Unit ${unit.unitNumber}`,
                  },

                  unit_amount:
                    balanceCents,
                },

                quantity: 1,
              },

              ...(processingFeeCents > 0
                ? [
                    {
                      price_data: {
                        currency:
                          "usd",

                        product_data: {
                          name:
                            "Processing Fee",
                        },

                        unit_amount:
                          processingFeeCents,
                      },

                      quantity: 1,
                    },
                  ]
                : []),
            ],

            success_url:
            `${origin}/tenant/dashboard`,

            cancel_url:
              `${origin}/tenant/pay?checkout=cancelled`,
          },
          {
            /*
             * If this exact server request is retried while Stripe is
             * processing it, Stripe must return the same Checkout
             * Session rather than creating another one.
             */
            idempotencyKey:
              `rentfray-checkout-${createdPayment.id}`,
          }
        );
    } catch (error) {
      /*
       * The database record represents only an unpaid attempt.
       * If Stripe Session creation fails, preserve it as UNPAID.
       *
       * It will not suppress the tenant's balance or prevent a retry.
       */
      console.error(
        "Stripe Checkout Session creation failed:",
        {
          paymentId:
            createdPayment.id,
          error,
        }
      );

      throw error;
    }

    await prisma.payment.update({
      where: {
        id: createdPayment.id,
      },
      data: {
        stripeSessionId:
          checkoutSession.id,

        /*
         * Checkout commonly has no PaymentIntent yet.
         * The completed/processing webhook will attach the actual
         * PaymentIntent once Stripe creates it.
         */
        stripePaymentIntentId:
          typeof checkoutSession.payment_intent ===
          "string"
            ? checkoutSession.payment_intent
            : null,
      },
    });

    return NextResponse.json<
      ApiSuccess<{ url: string }>
    >({
      ok: true,
      data: {
        url:
          checkoutSession.url!,
      },
    });
  } catch (error) {
    console.error(
      "create-session error:",
      error
    );

    if (
      error instanceof
      Stripe.errors.StripeError
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error:
            error.message ||
            "Stripe error.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiError>(
      {
        ok: false,
        error:
          "Failed to create payment session.",
      },
      { status: 500 }
    );
  }
}
