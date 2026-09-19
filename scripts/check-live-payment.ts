import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-02-25.clover",
});

const sessionId =
  "cs_live_b1FLKs4Tde4lv2IYAXsu9sdvi1yxB43t93ctFiMBsynuA2VKJwEAWJZGV3";

async function main() {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  console.log("========================================");
  console.log(" STRIPE LIVE PAYMENT CHECK — READ ONLY");
  console.log("========================================");
  console.log("Session ID:        ", session.id);
  console.log("Session status:    ", session.status);
  console.log("Payment status:    ", session.payment_status);
  console.log("Amount total:      ", session.amount_total);
  console.log("Currency:          ", session.currency);

  const paymentIntent = session.payment_intent;

  if (paymentIntent && typeof paymentIntent !== "string") {
    console.log("----------------------------------------");
    console.log("PaymentIntent ID:  ", paymentIntent.id);
    console.log("Intent status:     ", paymentIntent.status);
    console.log("Amount:            ", paymentIntent.amount);
    console.log("Latest charge:     ", paymentIntent.latest_charge);
  } else {
    console.log("----------------------------------------");
    console.log("PaymentIntent:     ", paymentIntent ?? "NONE");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
