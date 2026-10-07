import type { Prisma } from "@prisma/client";
import Stripe from "stripe";

export type CheckoutIdentity = Readonly<{ propertyId: string; unitId: string; tenantAssignmentId: string }>;
export type CheckoutPayment = {
  id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
  billingCycle: string | null; amountCents: number; processingFeeCents: number | null;
  stripeSessionId: string | null; stripePaymentIntentId: string | null;
  status: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REVERSED"; createdAt: Date;
};
export type CollectibilityState = "NO_ATTEMPT" | "COLLECTIBLE" | "PROVEN_NONCOLLECTIBLE" | "UNRESOLVED";
export type CheckoutEvidence = Readonly<{
  state: CollectibilityState; checkout?: Stripe.Checkout.Session; recoverable?: boolean; dependencyFailure?: boolean;
}>;
export class CheckoutConflict extends Error {
  constructor(message = "A tenant payment is open or in progress. This operation cannot be completed until that payment attempt is no longer collectible.", readonly status = 409) { super(message); }
}
type AttemptReader = Pick<Prisma.TransactionClient, "payment">;
export async function lockCheckout(tx: Prisma.TransactionClient, identity: CheckoutIdentity & { billingCycle?: string | null }) {
  const key = `${identity.propertyId}:${identity.unitId}:${identity.tenantAssignmentId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  if (identity.billingCycle) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${key}:${identity.billingCycle}`}))`;
}
export async function findCheckoutAttempts(db: AttemptReader, identity: CheckoutIdentity): Promise<CheckoutPayment[]> {
  return db.payment.findMany({ where: { ...identity, paymentMethod: "ACH", status: { in: ["UNPAID", "PENDING", "FAILED"] } }, orderBy: { id: "asc" } });
}
function validMetadata(metadata: Stripe.Metadata | null, payment: CheckoutPayment) {
  const m = metadata ?? {};
  return m.paymentId === payment.id && m.propertyId === payment.propertyId && m.unitId === payment.unitId &&
    m.tenantAssignmentId === payment.tenantAssignmentId && m.billingCycle === payment.billingCycle &&
    m.ledgerBalanceCents === String(payment.amountCents) && m.processingFeeCents === String(payment.processingFeeCents ?? 0) &&
    m.totalAmountCents === String(payment.amountCents + (payment.processingFeeCents ?? 0));
}
function validIntent(intent: Stripe.PaymentIntent, payment: CheckoutPayment, account?: string) {
  const destination = typeof intent.transfer_data?.destination === "string" ? intent.transfer_data.destination : intent.transfer_data?.destination?.id;
  const onBehalf = typeof intent.on_behalf_of === "string" ? intent.on_behalf_of : intent.on_behalf_of?.id;
  const expectedAccount = account ?? intent.metadata.stripeAccountId;
  return validMetadata(intent.metadata, payment) && intent.currency === "usd" &&
    intent.amount === payment.amountCents + (payment.processingFeeCents ?? 0) &&
    intent.payment_method_types.includes("us_bank_account") && !!expectedAccount &&
    destination === expectedAccount && onBehalf === expectedAccount;
}
// Retrieval only: callers retain creation, retirement, settlement and financial authority.
export async function inspectCheckout(stripe: Stripe, payment: CheckoutPayment): Promise<CheckoutEvidence> {
  try {
    if (!payment.stripeSessionId) {
      if (!payment.stripePaymentIntentId) return { state: "UNRESOLVED", recoverable: true };
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (intent.id !== payment.stripePaymentIntentId || !validIntent(intent, payment)) return { state: "UNRESOLVED" };
      return { state: intent.status === "canceled" ? "PROVEN_NONCOLLECTIBLE" : intent.status === "processing" ? "COLLECTIBLE" : "UNRESOLVED" };
    }
    const checkout = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
    if (checkout.id !== payment.stripeSessionId || !validMetadata(checkout.metadata, payment) ||
        checkout.amount_total !== payment.amountCents + (payment.processingFeeCents ?? 0)) return { state: "UNRESOLVED" };
    const intentId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id;
    if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== intentId) return { state: "UNRESOLVED" };
    if (checkout.status === "open" && checkout.url) return { state: "COLLECTIBLE", checkout };
    if (checkout.status === "expired" || checkout.status === "complete") {
      if (!intentId) return { state: checkout.status === "expired" && checkout.payment_status !== "paid" ? "PROVEN_NONCOLLECTIBLE" : "UNRESOLVED" };
      const intent = await stripe.paymentIntents.retrieve(intentId);
      if (intent.id !== intentId || !validIntent(intent, payment, checkout.metadata?.stripeAccountId)) return { state: "UNRESOLVED" };
      if (intent.status === "canceled") return { state: "PROVEN_NONCOLLECTIBLE" };
      if (intent.status === "processing") return { state: "COLLECTIBLE" };
    }
    return { state: "UNRESOLVED" };
  } catch (error) {
    // A missing object is ambiguity; transport/authentication failures are dependency failures.
    return { state: "UNRESOLVED", dependencyFailure: (error as { code?: string })?.code !== "resource_missing" };
  }
}
function fingerprint(attempts: CheckoutPayment[]): string {
  return JSON.stringify(attempts.map(p => ({ id: p.id, propertyId: p.propertyId, unitId: p.unitId,
    tenantAssignmentId: p.tenantAssignmentId, billingCycle: p.billingCycle, amountCents: p.amountCents,
    processingFeeCents: p.processingFeeCents, stripeSessionId: p.stripeSessionId,
    stripePaymentIntentId: p.stripePaymentIntentId, status: p.status, createdAt: p.createdAt.toISOString() })).sort((a, b) => a.id.localeCompare(b.id)));
}
export type CheckoutInspection = Readonly<{ identity: CheckoutIdentity; inventory: string; state: CollectibilityState; evidence: readonly CheckoutEvidence[] }>;
export async function inspectTenantCheckoutAttempts(db: AttemptReader, identity: CheckoutIdentity): Promise<CheckoutInspection> {
  const attempts = await findCheckoutAttempts(db, identity);
  const inventory = fingerprint(attempts);
  const key = process.env.STRIPE_SECRET_KEY;
  const stripe = attempts.length && key ? new Stripe(key, { apiVersion: "2026-02-25.clover", timeout: 10_000, maxNetworkRetries: 0 }) : null;
  const evidence: CheckoutEvidence[] = [];
  for (const attempt of attempts) evidence.push(!attempt.stripeSessionId && !attempt.stripePaymentIntentId ? { state: "UNRESOLVED", recoverable: true } : stripe ? await inspectCheckout(stripe, attempt) : { state: "UNRESOLVED", dependencyFailure: true });
  const state: CollectibilityState = !attempts.length ? "NO_ATTEMPT" : evidence.some(e => e.state === "UNRESOLVED") ? "UNRESOLVED" : evidence.some(e => e.state === "COLLECTIBLE") ? "COLLECTIBLE" : "PROVEN_NONCOLLECTIBLE";
  return Object.freeze({ identity: Object.freeze({ ...identity }), inventory, state, evidence: Object.freeze(evidence.map(e => Object.freeze(e))) });
}
// Caller must hold the established assignment advisory lock until its mutation commits.
export async function assertCheckoutReductionAllowed(tx: Prisma.TransactionClient, inspection: CheckoutInspection): Promise<void> {
  if (fingerprint(await findCheckoutAttempts(tx, inspection.identity)) !== inspection.inventory) {
    throw new CheckoutConflict("Tenant payment state changed. Retry the same operation.");
  }
  if (inspection.evidence.some(e => e.dependencyFailure)) throw new CheckoutConflict("Tenant payment status is temporarily unavailable. Please retry.", 503);
  if (inspection.evidence.some(e => e.state !== "PROVEN_NONCOLLECTIBLE" && e.state !== "NO_ATTEMPT")) throw new CheckoutConflict();
}
