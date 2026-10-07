import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

type Snapshot = { stripeAccountId: string | null; propertyVersion: string; statusVersion: string | null };

export function mapStripeAccountStatus(account: Stripe.Account | null) {
  const requirements = account?.requirements;
  const requirementsDue = Boolean(requirements?.currently_due?.length || requirements?.past_due?.length || requirements?.disabled_reason);
  const parts: string[] = [];
  if (requirements?.disabled_reason) parts.push(`Disabled reason: ${requirements.disabled_reason}`);
  if (requirements?.currently_due?.length) parts.push(`Currently due: ${requirements.currently_due.join(", ")}`);
  if (requirements?.past_due?.length) parts.push(`Past due: ${requirements.past_due.join(", ")}`);
  if (requirements?.eventually_due?.length) parts.push(`Eventually due: ${requirements.eventually_due.join(", ")}`);
  const details = account?.details_submitted === true;
  const charges = account?.charges_enabled === true;
  const payouts = account?.payouts_enabled === true;
  return {
    processorConnected: account !== null, bankConnected: details,
    chargesEnabled: charges, payoutsEnabled: payouts, onboardingComplete: details,
    requirementsDue, requirementsSummary: account ? (parts.length ? parts.join(" | ") : null) : "No Stripe account is connected.",
    readyForLive: details && charges && payouts && !requirementsDue,
  };
}

async function snapshot(db: Prisma.TransactionClient, propertyId: string): Promise<Snapshot> {
  // MVCC tuple versions change on every competing write, including identical values.
  // Both versions and the mapping are read in one PostgreSQL statement/snapshot.
  const rows = await db.$queryRaw<Snapshot[]>`
    SELECT p."stripeAccountId", p.xmin::text AS "propertyVersion", s.xmin::text AS "statusVersion"
    FROM "Property" p LEFT JOIN "PaymentConnectionStatus" s ON s."propertyId" = p."id"
    WHERE p."id" = ${propertyId}`;
  if (!rows[0]) throw new Error("Property not found.");
  return rows[0];
}

export async function reconcileStripeAccountStatus(propertyId: string, options: {
  stripe?: Stripe;
  expectedAccountId?: string | null;
  audit?: (tx: Prisma.TransactionClient, data: ReturnType<typeof mapStripeAccountStatus>, accountId: string) => Promise<void>;
} = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const observed = await snapshot(prisma, propertyId);
    if (options.expectedAccountId !== undefined && observed.stripeAccountId !== options.expectedAccountId) throw new Error("Stripe account mapping changed.");
    const account = observed.stripeAccountId
      ? await (options.stripe ?? getStripeClient()).accounts.retrieve(observed.stripeAccountId, {}, { timeout: 10000, maxNetworkRetries: 0 })
      : null;
    if (account && account.id !== observed.stripeAccountId) throw new Error("Stripe account mapping mismatch.");
    const data = mapStripeAccountStatus(account);
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Same-property writers serialize before rechecking versions; other properties remain independent.
      // Property first matches the established Property -> child row lock order.
      await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${propertyId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "PaymentConnectionStatus" WHERE "propertyId" = ${propertyId} FOR UPDATE`;
      const current = await snapshot(tx, propertyId);
      if (current.stripeAccountId !== observed.stripeAccountId || current.propertyVersion !== observed.propertyVersion || current.statusVersion !== observed.statusVersion) return null;
      const paymentStatus = await tx.paymentConnectionStatus.upsert({
        where: { propertyId }, update: { ...data, lastSyncedAt: new Date() },
        create: { propertyId, ...data, lastSyncedAt: new Date() },
      });
      if (account && options.audit) await options.audit(tx, data, account.id);
      return { paymentStatus, account, data };
    }, { maxWait: 5000, timeout: 10000 });
    if (result) return result;
    // Superseded retrieval is discarded; next retrieve occurs after transaction/locks end.
  }
  throw new Error("Stripe account reconciliation changed concurrently. Retry later.");
}
