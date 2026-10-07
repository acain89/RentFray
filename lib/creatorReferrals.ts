import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const REFERRAL_COOKIE = "rf_creator_referral";
export const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60;
export const COMMISSION_CENTS = 250;
export const CREATOR_ORIGIN = "https://rentfray.com";

function signingSecret(): string {
  const secret = process.env.CREATOR_REFERRAL_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret === "rentfray-dev-session-secret-change-me") {
    throw new Error("Configure CREATOR_REFERRAL_SECRET or SESSION_SECRET with at least 32 characters.");
  }
  return secret;
}

type ReferralTouch = { creatorId: string; capturedAt: number; expiresAt: number };
export function signReferral(creatorId: string, now = new Date()): string {
  const capturedAt = now.getTime();
  const payload = Buffer.from(JSON.stringify({ creatorId, capturedAt,
    expiresAt: capturedAt + REFERRAL_TTL_SECONDS * 1000 })).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update("rentfray:creator-referral:v1:" + payload).digest("base64url");
  return payload + "." + signature;
}
export function readReferral(value: string | undefined, now = new Date()): ReferralTouch | null {
  if (!value || value.length > 2048) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
    const expected = createHmac("sha256", signingSecret()).update("rentfray:creator-referral:v1:" + parts[0]).digest();
    const signature = Buffer.from(parts[1], "base64url");
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
    const touch: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!touch || typeof touch !== "object" || !("creatorId" in touch) || !("capturedAt" in touch) || !("expiresAt" in touch)) return null;
    const { creatorId, capturedAt, expiresAt } = touch;
    if (typeof creatorId !== "string" || !creatorId || creatorId.length > 128 ||
      typeof capturedAt !== "number" || !Number.isSafeInteger(capturedAt) || capturedAt < 0 || capturedAt > now.getTime() ||
      typeof expiresAt !== "number" || expiresAt !== capturedAt + REFERRAL_TTL_SECONDS * 1000 || now.getTime() >= expiresAt) return null;
    return { creatorId, capturedAt, expiresAt };
  } catch { return null; }
}
export const referralCookieOptions = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/",
};
export async function validFirstTouch(db: Pick<Prisma.TransactionClient, "creator">, cookie: string | undefined, now = new Date()) {
  const touch = readReferral(cookie, now);
  if (!touch) return null;
  const creator = await db.creator.findUnique({ where: { id: touch.creatorId } });
  return creator && creator.startsAt.getTime() <= touch.capturedAt ? creator : null;
}
export async function attributeCreator(db: Prisma.TransactionClient, cookie: string | undefined,
  property: { id: string; name: string }, now = new Date()): Promise<boolean> {
  const creator = await validFirstTouch(db, cookie, now);
  if (!creator) return false;
  await db.creatorReferral.create({ data: { creatorId: creator.id, propertyId: property.id,
    retainedPropertyId: property.id, businessNameSnapshot: property.name, attributedAt: now } });
  return true;
}

const chicagoFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function chicagoWall(instant: Date): number {
  const parts = Object.fromEntries(chicagoFormatter.formatToParts(instant).map(p => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour),
    Number(parts.minute), Number(parts.second), instant.getUTCMilliseconds());
}
// Preserve Chicago wall time. Feb 29 clamps to Feb 28; DST gaps shift forward,
// and repeated wall times choose the earlier instant.
export function creatorAnniversary(startsAt: Date): Date {
  if (!Number.isFinite(startsAt.getTime())) throw new Error("Invalid creator start date.");
  const wall = new Date(chicagoWall(startsAt));
  const year = wall.getUTCFullYear() + 1;
  const month = wall.getUTCMonth();
  const day = Math.min(wall.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const target = Date.UTC(year, month, day, wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds());
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = target + hours * 3600000;
    offsets.add(chicagoWall(new Date(instant)) - instant);
  }
  const candidates = [...offsets].map(offset => target - offset);
  const exact = candidates.filter(instant => chicagoWall(new Date(instant)) === target).sort((a, b) => a - b);
  if (exact.length) return new Date(exact[0]);
  const forward = candidates.filter(instant => chicagoWall(new Date(instant)) > target)
    .sort((a, b) => chicagoWall(new Date(a)) - chicagoWall(new Date(b)) || a - b);
  if (!forward.length) throw new Error("Cannot resolve Chicago anniversary.");
  return new Date(forward[0]);
}
export function creatorStatus(expiresAt: Date, now = new Date()): "ACTIVE" | "EXPIRED" {
  return now < expiresAt ? "ACTIVE" : "EXPIRED";
}

type ReportingPayment = Prisma.PaymentGetPayload<{ include: { ledgerEntries: true } }>;
export function qualifyingPayment(payment: ReportingPayment, creator: { startsAt: Date; expiresAt: Date }, attributedAt: Date): boolean {
  if (payment.status !== "PAID" || payment.paymentMethod !== "ACH" || !payment.tenantAssignmentId ||
    !payment.paidAt || !Number.isFinite(payment.paidAt.getTime()) || payment.paidAt < creator.startsAt || payment.paidAt >= creator.expiresAt || payment.paidAt < attributedAt ||
    !/^pi_[A-Za-z0-9]+$/.test(payment.stripePaymentIntentId ?? "") || !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0 || !Number.isSafeInteger(payment.processingFeeCents ?? 0) || (payment.processingFeeCents ?? 0) < 0) return false;
  const intent = payment.stripePaymentIntentId;
  const collection = payment.ledgerEntries.find(entry => entry.entryType === "PAYMENT" && entry.referenceNumber === intent &&
    !entry.voidedAt && entry.paymentId === payment.id && entry.propertyId === payment.propertyId && entry.unitId === payment.unitId &&
    entry.tenantAssignmentId === payment.tenantAssignmentId && entry.amountCents === -(payment.amountCents + (payment.processingFeeCents ?? 0)));
  if (!collection) return false;
  const returned = payment.ledgerEntries.filter(entry => !entry.voidedAt && entry.referenceNumber === `${intent}:returned-principal`);
  return returned.every(entry => entry.entryType === "ADJUSTMENT" && Number.isSafeInteger(entry.amountCents) &&
    entry.amountCents >= 0 && entry.propertyId === payment.propertyId && entry.unitId === payment.unitId && entry.tenantAssignmentId === payment.tenantAssignmentId) &&
    returned.reduce((sum, entry) => sum + entry.amountCents, 0) < payment.amountCents;
}
export async function creatorReports(db: Prisma.TransactionClient, slug?: string, now = new Date()) {
  const creators = await db.creator.findMany({ where: slug ? { slug } : undefined, orderBy: { slug: "asc" },
    include: { referrals: { orderBy: { attributedAt: "asc" }, include: { property: { include: {
      _count: { select: { units: { where: { isActive: true } } } },
      payments: { where: { status: "PAID", paymentMethod: "ACH", paidAt: { not: null } }, include: { ledgerEntries: true } },
    } } } } } });
  return creators.map(creator => {
    const seen = new Set<string>();
    const businesses = creator.referrals.map(referral => {
      const count = (referral.property?.payments ?? []).filter(payment => {
        if (!qualifyingPayment(payment, creator, referral.attributedAt)) return false;
        const key = payment.stripePaymentIntentId;
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      }).length;
      return { name: referral.property?.name ?? referral.businessNameSnapshot, propertyId: referral.retainedPropertyId,
        deleted: !referral.property, units: referral.property?._count.units ?? 0, payments: count, commissionCents: count * COMMISSION_CENTS };
    });
    return { creator, status: creatorStatus(creator.expiresAt, now), businesses };
  });
}