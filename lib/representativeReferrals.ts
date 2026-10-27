import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { representativeExpiration } from "./representativeCalendar";

export const REPRESENTATIVE_COOKIE = "rf_representative_referral";
export const REPRESENTATIVE_TTL_SECONDS = 90 * 24 * 60 * 60;
export const REPRESENTATIVE_ORIGIN = "https://www.rentfray.com";
const namespace = "rentfray:representative-referral:v1:";
export type RepresentativeTouch = { version: 1; representativeId: string; capturedAt: number; expiresAt: number };
export type RepresentativeProductScope = "UNKNOWN" | "RENTFRAY" | "LITE";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || !value.trim() || Buffer.byteLength(value, "utf8") < 32 || value === "rentfray-dev-session-secret-change-me") {
    throw new Error("Representative referral signing is not configured.");
  }
  return value;
}

export function normalizeRepresentativeSlug(value: string): string { return value.trim().toLowerCase(); }
export function isRepresentativeSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]{1,47}$/.test(value) && !value.endsWith("-") && value !== "portal";
}

export function signRepresentativeReferral(representativeId: string, now = new Date()): string {
  if (!representativeId || representativeId.length > 128 || !Number.isSafeInteger(now.getTime()) || now.getTime() < 0) {
    throw new Error("Invalid representative touch.");
  }
  const capturedAt = now.getTime();
  const payload = Buffer.from(JSON.stringify({ version: 1, representativeId, capturedAt,
    expiresAt: capturedAt + REPRESENTATIVE_TTL_SECONDS * 1000 })).toString("base64url");
  return payload + "." + createHmac("sha256", secret()).update(namespace + payload).digest("base64url");
}

export function readRepresentativeReferral(value: string | undefined, now = new Date()): RepresentativeTouch | null {
  if (!value || value.length > 2048 || !Number.isFinite(now.getTime())) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
    const expected = createHmac("sha256", secret()).update(namespace + parts[0]).digest();
    const supplied = Buffer.from(parts[1], "base64url");
    if (supplied.toString("base64url") !== parts[1] || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const touch = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!touch || touch.version !== 1 || typeof touch.representativeId !== "string" ||
        !touch.representativeId || touch.representativeId.length > 128 ||
        !Number.isSafeInteger(touch.capturedAt) || touch.capturedAt < 0 || touch.capturedAt > now.getTime() ||
        touch.expiresAt !== touch.capturedAt + REPRESENTATIVE_TTL_SECONDS * 1000 || now.getTime() >= touch.expiresAt) return null;
    return { version: 1, representativeId: touch.representativeId, capturedAt: touch.capturedAt, expiresAt: touch.expiresAt };
  } catch { return null; }
}

export const representativeCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/",
};

export async function validRepresentativeFirstTouch(db: Pick<Prisma.TransactionClient, "representative">,
  touch: RepresentativeTouch | null) {
  if (!touch) return null;
  const representative = await db.representative.findUnique({ where: { id: touch.representativeId }, select: { id: true, createdAt: true } });
  return representative && representative.createdAt.getTime() <= touch.capturedAt ? representative : null;
}

/** Caller owns account-creation transaction. Product scope is trusted server input,
 * never registration JSON. Unknown products are tracking-only; Lite is not attributed.
 * Database failures intentionally propagate so the entire registration rolls back.
 */
export async function attributeRepresentative(db: Prisma.TransactionClient, touch: RepresentativeTouch | null,
  property: { id: string; name: string; createdAt: Date }, productScope: RepresentativeProductScope = "UNKNOWN") {
  if (!touch || productScope === "LITE") return false;
  const createdAt = property.createdAt;
  if (!Number.isFinite(createdAt.getTime()) || touch.capturedAt > createdAt.getTime() || createdAt.getTime() >= touch.expiresAt) return false;
  const representative = await validRepresentativeFirstTouch(db, touch);
  if (!representative) return false;
  const agreements = productScope === "RENTFRAY" ? await db.representativeAgreement.findMany({
    where: { representativeId: representative.id, effectiveAt: { lte: createdAt }, expiresAt: { gt: createdAt }, approvedAt: { lte: createdAt } },
    orderBy: { effectiveAt: "desc" }, take: 2,
    select: { id: true, effectiveAt: true, expiresAt: true },
  }) : [];
  // Ambiguous/incorrect agreement rows cannot silently authorize commissions.
  const agreement = agreements.length === 1 &&
    representativeExpiration(agreements[0].effectiveAt).getTime() === agreements[0].expiresAt.getTime() ? agreements[0] : null;
  await db.representativeReferral.create({ data: {
    representativeId: representative.id, propertyId: property.id, businessNameSnapshot: property.name,
    businessCreatedAt: createdAt, capturedAt: new Date(touch.capturedAt), attributedAt: createdAt,
    businessExpiresAt: representativeExpiration(createdAt), authorizingAgreementId: agreement?.id ?? null, productScope,
  } });
  return true;
}
