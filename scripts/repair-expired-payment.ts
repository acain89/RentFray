import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

const prisma = new PrismaClient();

const PAYMENT_ID = "cmu2b7yos001t7vd58x537h0q";
const PROPERTY_ID = "cmu27xkso00097vd5skhot678";
const SESSION_ID =
  "cs_live_b1FLKs4Tde4lv2IYAXsu9sdvi1yxB43t93ctFiMBsynuA2VKJwEAWJZGV3";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });

  const payment = await prisma.payment.findUnique({
    where: { id: PAYMENT_ID },
    select: {
      id: true,
      propertyId: true,
      unitId: true,
      status: true,
      amountCents: true,
      stripeSessionId: true,
      stripePaymentIntentId: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found. Nothing changed.");
  }

  console.log("RentFray payment:", payment);

  if (payment.propertyId !== PROPERTY_ID) {
    throw new Error("Property mismatch. Nothing changed.");
  }

  if (payment.status !== "PENDING") {
    throw new Error(
      `Expected PENDING, found ${payment.status}. Nothing changed.`
    );
  }

  if (payment.stripeSessionId !== SESSION_ID) {
    throw new Error("Stripe Session ID mismatch. Nothing changed.");
  }

  if (payment.stripePaymentIntentId !== null) {
    throw new Error(
      "Payment already has a PaymentIntent. Nothing changed."
    );
  }

  const session =
    await stripe.checkout.sessions.retrieve(SESSION_ID);

  console.log("Stripe session:", {
    id: session.id,
    status: session.status,
    payment_status: session.payment_status,
    payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
  });

  if (session.status !== "expired") {
    throw new Error(
      `Stripe Session is ${session.status}, not expired. Nothing changed.`
    );
  }

  if (session.payment_status !== "unpaid") {
    throw new Error(
      `Stripe payment status is ${session.payment_status}, not unpaid. Nothing changed.`
    );
  }

  if (session.payment_intent) {
    throw new Error(
      "Stripe Session has a PaymentIntent. Nothing changed."
    );
  }

  const result = await prisma.payment.updateMany({
    where: {
      id: PAYMENT_ID,
      propertyId: PROPERTY_ID,
      status: "PENDING",
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: null,
    },
    data: {
      status: "UNPAID",
    },
  });

  if (result.count !== 1) {
    throw new Error(
      `Expected to update exactly 1 payment; updated ${result.count}.`
    );
  }

  console.log("");
  console.log("SUCCESS");
  console.log(
    `Payment ${PAYMENT_ID} changed from PENDING -> UNPAID.`
  );
  console.log("No ledger entries were changed.");
}

main()
  .catch((error) => {
    console.error("");
    console.error("REPAIR ABORTED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });