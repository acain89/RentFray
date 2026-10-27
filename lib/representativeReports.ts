import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REPRESENTATIVE_ORIGIN } from "@/lib/representativeReferrals";

export type RepresentativeReportOptions = { businessCursor?: string; payoutCursor?: string; monthBefore?: string };
export type RepresentativeDashboard = {
  asOf: string; displayName: string; referralUrl: string; reportingMonth: string;
  agreement: { effectiveAt: string; expiresAt: string; status: "ACTIVE" | "EXPIRED" | "UPCOMING"; daysRemaining: number } | null;
  summary: { acquiredBusinesses: number; currentMonthPayments: number; currentMonthCents: number; lifetimeCents: number; paidCents: number; outstandingCents: number };
  businesses: { items: { id: string; name: string; createdAt: string; activeUnits: number; currentMonthPayments: number; currentMonthCents: number;
    expiresAt: string; daysRemaining: number; status: "ELIGIBLE" | "TRACKING_ONLY" | "WINDOW_ENDED"; archived: boolean }[]; nextCursor: string | null };
  history: { items: { month: string; payments: number; commissionCents: number }[]; nextMonthBefore: string | null };
  payouts: { items: { id: string; amountCents: number; paidAt: string; reportingMonth: string }[]; nextCursor: string | null };
};
export class RepresentativeReportInputError extends Error {}
const monthFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" });
export function representativeMonth(now: Date): string {
  const parts = Object.fromEntries(monthFormat.formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}
function validMonth(value: string): boolean { return /^(?:[2-9][0-9]{3})-(?:0[1-9]|1[0-2])$/.test(value); }
export function shiftRepresentativeMonth(month: string, amount: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Resolve Chicago midnight using offsets on both sides of a possible DST change.
 * In particular, November 1 can switch offsets later that same morning. */
export function representativeMonthStart(month: string): Date {
  if (!validMonth(month)) throw new RepresentativeReportInputError("Invalid reporting month.");
  const [year, index] = month.split("-").map(Number);
  const target = Date.UTC(year, index - 1, 1);
  const format = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const wall = (instant: number) => {
    const p = Object.fromEntries(format.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  };
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) { const instant = target + hours * 3600000; offsets.add(wall(instant) - instant); }
  const exact = [...offsets].map(offset => target - offset).filter(instant => wall(instant) === target).sort((a, b) => a - b);
  if (!exact.length) throw new Error("Representative reporting clock unavailable.");
  return new Date(exact[0]);
}
type Cursor = { date: Date; id: string };
function cursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const date = new Date(decoded.date);
    if (typeof decoded.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded.id) || date.toISOString() !== decoded.date) throw new Error();
    return { date, id: decoded.id };
  } catch { throw new RepresentativeReportInputError("Invalid pagination cursor."); }
}
function encodeCursor(date: Date, id: string): string { return Buffer.from(JSON.stringify({ date: date.toISOString(), id })).toString("base64url"); }
function safeCount(value: bigint | number): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || !Number.isSafeInteger(number * 250)) throw new Error("Representative report exceeds supported range.");
  return number;
}
const remaining = (expiration: Date, now: Date) => Math.max(0, Math.ceil((expiration.getTime() - now.getTime()) / 86400000));

export function representativeQualifyingPayments(representativeId: string, now: Date): Prisma.Sql {
  return Prisma.sql`FROM "Payment" p
      JOIN "RepresentativeReferral" r ON r."propertyId" = p."propertyId"
      JOIN "RepresentativeAgreement" a ON a."id" = r."authorizingAgreementId" AND a."representativeId" = r."representativeId"
      WHERE r."representativeId" = ${representativeId} AND r."productScope" = 'RENTFRAY'
        AND (r."commissionEligibleFrom" IS NULL OR (r."businessCreatedAt" <= r."commissionEligibleFrom" AND r."commissionEligibleFrom" < r."businessExpiresAt"))
        AND a."effectiveAt" <= COALESCE(r."commissionEligibleFrom", r."businessCreatedAt") AND COALESCE(r."commissionEligibleFrom", r."businessCreatedAt") < a."expiresAt" AND a."approvedAt" <= COALESCE(r."commissionEligibleFrom", r."businessCreatedAt")
        AND p."status" = 'PAID' AND p."paymentMethod" = 'ACH' AND p."amountCents" > 0
        AND COALESCE(p."processingFeeCents", 0) >= 0 AND p."paidAt" IS NOT NULL AND isfinite(p."paidAt")
        AND p."paidAt" >= (COALESCE(r."commissionEligibleFrom", r."businessCreatedAt") AT TIME ZONE 'UTC') AND p."paidAt" < (r."businessExpiresAt" AT TIME ZONE 'UTC')
        AND p."paidAt" <= (${now}::timestamptz AT TIME ZONE 'UTC') AND p."stripePaymentIntentId" ~ '^pi_[A-Za-z0-9]+$'
        AND EXISTS (SELECT 1 FROM "TenantAssignment" t WHERE t."id" = p."tenantAssignmentId" AND t."propertyId" = p."propertyId" AND t."unitId" = p."unitId")
        AND EXISTS (SELECT 1 FROM "LedgerEntry" l WHERE l."paymentId" = p."id" AND l."entryType" = 'PAYMENT'
          AND l."referenceNumber" = p."stripePaymentIntentId" AND l."voidedAt" IS NULL
          AND l."propertyId" = p."propertyId" AND l."unitId" = p."unitId" AND l."tenantAssignmentId" = p."tenantAssignmentId"
          AND l."amountCents"::bigint = -(p."amountCents"::bigint + COALESCE(p."processingFeeCents", 0)::bigint))
        AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" l WHERE l."paymentId" = p."id" AND l."voidedAt" IS NULL AND l."amountCents" > 0
          AND l."referenceNumber" IN (p."stripePaymentIntentId" || ':returned-principal', p."stripePaymentIntentId" || ':reversal'))`;
}

export async function getRepresentativeDashboard(representativeId: string, options: RepresentativeReportOptions = {}, now = new Date()): Promise<RepresentativeDashboard> {
  const businessCursor = cursor(options.businessCursor), payoutCursor = cursor(options.payoutCursor);
  const month = representativeMonth(now), currentStart = representativeMonthStart(month);
  const before = options.monthBefore ?? shiftRepresentativeMonth(month, 1);
  if (!validMonth(before) || before > shiftRepresentativeMonth(month, 1) || before < "2001-01") throw new RepresentativeReportInputError("Invalid reporting month.");
  const months = Array.from({ length: 12 }, (_, index) => shiftRepresentativeMonth(before, -index - 1));
  const historyStart = representativeMonthStart(months[11]), historyEnd = representativeMonthStart(before);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Enforced by PostgreSQL as well as the module's SELECT-only data access.
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const representative = await tx.representative.findUnique({ where: { id: representativeId }, select: { displayName: true, slug: true } });
    if (!representative) throw new Error("Representative no longer exists.");
    const agreementSelect = { effectiveAt: true, expiresAt: true } as const;
    const agreement = await tx.representativeAgreement.findFirst({ where: { representativeId, approvedAt: { lte: now }, effectiveAt: { lte: now } },
      orderBy: { effectiveAt: "desc" }, select: agreementSelect }) ?? await tx.representativeAgreement.findFirst({
      where: { representativeId, approvedAt: { lte: now }, effectiveAt: { gt: now } }, orderBy: { effectiveAt: "asc" }, select: agreementSelect });
    const referrals = await tx.representativeReferral.findMany({ where: { representativeId,
      ...(businessCursor ? { OR: [{ businessCreatedAt: { lt: businessCursor.date } }, { businessCreatedAt: businessCursor.date, id: { lt: businessCursor.id } }] } : {}) },
      orderBy: [{ businessCreatedAt: "desc" }, { id: "desc" }], take: 26,
      select: { id: true, propertyId: true, businessNameSnapshot: true, businessCreatedAt: true, businessExpiresAt: true, productScope: true, commissionEligibleFrom: true,
        authorizingAgreement: { select: { representativeId: true, effectiveAt: true, expiresAt: true, approvedAt: true } } } });
    const page = referrals.slice(0, 25), propertyIds = page.map(row => row.propertyId);
    const properties = propertyIds.length ? await tx.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true } }) : [];
    const units = propertyIds.length ? await tx.unit.groupBy({ by: ["propertyId"], where: { propertyId: { in: propertyIds }, isActive: true }, _count: { _all: true } }) : [];
    const qualifying = representativeQualifyingPayments(representativeId, now);
    const [totals] = await tx.$queryRaw<{ lifetime: bigint; current: bigint }[]>`SELECT COUNT(DISTINCT p."id") AS lifetime,
      COUNT(DISTINCT p."id") FILTER (WHERE p."paidAt" >= (${currentStart}::timestamptz AT TIME ZONE 'UTC')) AS current ${qualifying}`;
    const perBusiness = propertyIds.length ? await tx.$queryRaw<{ propertyId: string; count: bigint }[]>`
      SELECT p."propertyId", COUNT(DISTINCT p."id") AS count ${qualifying}
      AND p."propertyId" IN (${Prisma.join(propertyIds)}) AND p."paidAt" >= (${currentStart}::timestamptz AT TIME ZONE 'UTC') GROUP BY p."propertyId"` : [];
    const history = await tx.$queryRaw<{ month: string; count: bigint }[]>`SELECT
      to_char(timezone('America/Chicago', p."paidAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, COUNT(DISTINCT p."id") AS count ${qualifying}
      AND p."paidAt" >= (${historyStart}::timestamptz AT TIME ZONE 'UTC') AND p."paidAt" < (${historyEnd}::timestamptz AT TIME ZONE 'UTC') GROUP BY month`;
    const [payoutTotal] = await tx.$queryRaw<{ cents: bigint }[]>`SELECT COALESCE(SUM("amountCents"), 0)::bigint AS cents
      FROM "RepresentativePayout" WHERE "representativeId" = ${representativeId}`;
    const payouts = await tx.representativePayout.findMany({ where: { representativeId,
      ...(payoutCursor ? { OR: [{ paidAt: { lt: payoutCursor.date } }, { paidAt: payoutCursor.date, id: { lt: payoutCursor.id } }] } : {}) },
      orderBy: [{ paidAt: "desc" }, { id: "desc" }], take: 21, select: { id: true, paidAt: true, amountCents: true, reportingMonth: true } });
    const earliest = await tx.representativeReferral.findFirst({ where: { representativeId }, orderBy: { businessCreatedAt: "asc" }, select: { businessCreatedAt: true } });
    const acquired = await tx.representativeReferral.count({ where: { representativeId } });
    const lifetimeCents = safeCount(totals.lifetime) * 250, currentMonthPayments = safeCount(totals.current), paidCents = Number(payoutTotal.cents);
    if (!Number.isSafeInteger(paidCents) || paidCents < 0) throw new Error("Representative payouts exceed supported range.");
    const propertyMap = new Map(properties.map(row => [row.id, row.name]));
    const unitMap = new Map(units.map(row => [row.propertyId, row._count._all]));
    const counts = new Map(perBusiness.map(row => [row.propertyId, safeCount(row.count)]));
    const historyMap = new Map(history.map(row => [row.month, safeCount(row.count)]));
    return {
      asOf: now.toISOString(), displayName: representative.displayName, referralUrl: `${REPRESENTATIVE_ORIGIN}/r/${representative.slug}`, reportingMonth: month,
      agreement: agreement ? { effectiveAt: agreement.effectiveAt.toISOString(), expiresAt: agreement.expiresAt.toISOString(),
        status: now < agreement.effectiveAt ? "UPCOMING" : now < agreement.expiresAt ? "ACTIVE" : "EXPIRED", daysRemaining: remaining(agreement.expiresAt, now) } : null,
      summary: { acquiredBusinesses: acquired, currentMonthPayments, currentMonthCents: currentMonthPayments * 250, lifetimeCents, paidCents, outstandingCents: lifetimeCents - paidCents },
      businesses: { items: page.map(row => {
        const a = row.authorizingAgreement;
        const from = row.commissionEligibleFrom ?? row.businessCreatedAt;
        const eligible = row.productScope === "RENTFRAY" && a && a.representativeId === representativeId && row.businessCreatedAt <= from && from < row.businessExpiresAt && a.effectiveAt <= from &&
          from < a.expiresAt && a.approvedAt <= from;
        return { id: row.id, name: propertyMap.get(row.propertyId) ?? row.businessNameSnapshot, createdAt: row.businessCreatedAt.toISOString(),
          activeUnits: unitMap.get(row.propertyId) ?? 0, currentMonthPayments: counts.get(row.propertyId) ?? 0,
          currentMonthCents: (counts.get(row.propertyId) ?? 0) * 250, expiresAt: row.businessExpiresAt.toISOString(), daysRemaining: remaining(row.businessExpiresAt, now),
          status: !eligible ? "TRACKING_ONLY" as const : now >= row.businessExpiresAt ? "WINDOW_ENDED" as const : "ELIGIBLE" as const, archived: !propertyMap.has(row.propertyId) };
      }), nextCursor: referrals.length > 25 ? encodeCursor(page[24].businessCreatedAt, page[24].id) : null },
      history: { items: months.map(month => ({ month, payments: historyMap.get(month) ?? 0, commissionCents: (historyMap.get(month) ?? 0) * 250 })),
        nextMonthBefore: earliest && representativeMonth(earliest.businessCreatedAt) < months[11] && months[11] > "2001-01" ? months[11] : null },
      payouts: { items: payouts.slice(0, 20).map(row => ({ id: row.id, amountCents: row.amountCents, paidAt: row.paidAt.toISOString(), reportingMonth: row.reportingMonth })),
        nextCursor: payouts.length > 20 ? encodeCursor(payouts[19].paidAt, payouts[19].id) : null },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
}
