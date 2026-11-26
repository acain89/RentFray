import assert from "node:assert/strict";

/** Reverse only the two reviewed error-redaction spans from 8fd17bb. */
export function restoreCheckoutErrorRedaction(source: string): string {
  const deltas: ReadonlyArray<readonly [string, string]> = [
    ['      error', '      error instanceof CheckoutConflict ? "CHECKOUT_CONFLICT" :\n      error instanceof CheckoutBlocked ? "CHECKOUT_BLOCKED" :\n      error instanceof Stripe.errors.StripeError ? "STRIPE_ERROR" : "UNEXPECTED_ERROR"'],
    ['            error.message ||\n            "Stripe error.",', '            "Unable to start secure payment. Please try again later.",'],
  ];
  let restored = source;
  for (const [previous, reviewed] of deltas) {
    assert.equal(restored.split(reviewed).length, 2, "Exactly one reviewed redaction span");
    restored = restored.replace(reviewed, previous);
  }
  return restored;
}
