import { Prisma, type PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { issueRepresentativeRecovery, representativeEmailInput } from "@/lib/representativeAuth";
import { readRepresentativeBody, representativePrivateHeaders, representativeSameOrigin } from "@/lib/representativeSession";
import { representativeAgreementDates } from "@/lib/representativeCalendar";
import { getRepresentativeDashboard, representativeQualifyingPayments, RepresentativeReportInputError, type RepresentativeReportOptions } from "@/lib/representativeReports";

const db = prisma as PrismaClient;
export class RepresentativeAdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type RepresentativeAdminActor = { adminAccessId: string };
const fail = (status: number, message: string): never => { throw new RepresentativeAdminError(status, message); };
const profileSelect = { id: true, displayName: true, email: true, slug: true, loginEnabled: true, createdAt: true } as const;
const payoutSelect = { id: true, representativeId: true, amountCents: true, paidAt: true, recordedAt: true, reportingMonth: true, externalPayoutReference: true, note: true } as const;
type Profile = Prisma.RepresentativeGetPayload<{ select: typeof profileSelect }>;
type Payout = Prisma.RepresentativePayoutGetPayload<{ select: typeof payoutSelect }>;
const profileDto = (row: Profile) => ({ id: row.id, displayName: row.displayName, email: row.email, slug: row.slug, loginEnabled: row.loginEnabled,
  createdAt: row.createdAt.toISOString(), referralUrl: `https://www.rentfray.com/r/${row.slug}` });
const payoutDto = (row: Payout) => ({ id: row.id, amountCents: row.amountCents, paidAt: row.paidAt.toISOString(), recordedAt: row.recordedAt.toISOString(),
  reportingMonth: row.reportingMonth, externalPayoutReference: row.externalPayoutReference, note: row.note });

export function representativeAdminId(value: string): string {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : fail(400, "Invalid record identifier.");
}
export function representativeAdminFields(body: Record<string, unknown> | null, allowed: string[]): Record<string, unknown> {
  if (!body || Object.keys(body).some(key => !allowed.includes(key))) fail(400, "Invalid request fields.");
  return body!;
}
function text(value: unknown, max: number, required = true): string {
  if (typeof value !== "string") { if (!required && (value === undefined || value === null)) return ""; fail(400, "Invalid text field."); }
  const result = (value as string).trim();
  return result.length <= max && (!required || result.length > 0) ? result : fail(400, "Invalid text field.");
}
export function representativeAdminDate(value: unknown): Date {
  if (typeof value !== "string") return fail(400, "Enter a valid date.");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const target = Date.parse(value + "T00:00:00.000Z");
    if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== value) return fail(400, "Enter a valid date.");
    const format = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const wall = (instant: number) => { const p = Object.fromEntries(format.formatToParts(new Date(instant)).map(part => [part.type, part.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); };
    const offsets = new Set<number>();
    for (let h = -36; h <= 36; h += 6) { const instant = target + h * 3600000; offsets.add(wall(instant) - instant); }
    const matches = [...offsets].map(offset => target - offset).filter(instant => wall(instant) === target).sort((a, b) => a - b);
    if (!matches.length) return fail(400, "Enter a valid Chicago calendar date.");
    return new Date(matches[0]);
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : fail(400, "Enter a valid date.");
}
export function representativeUsdCents(value: unknown): number {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value)) return fail(400, "Enter a positive USD amount with at most two decimal places.");
  const [dollars, fraction = ""] = value.split(".");
  const cents = BigInt(dollars) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return cents > BigInt(0) && cents <= BigInt(2147483647) ? Number(cents) : fail(400, "Payout amount is outside the supported range.");
}
async function clock(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  if (!row || !Number.isFinite(row.now.getTime())) throw new Error("Administrative clock unavailable.");
  return row.now;
}
async function lockRepresentative(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Representative" WHERE "id" = ${id} FOR UPDATE`;
  const row = await tx.representative.findUnique({ where: { id }, select: profileSelect });
  return row ?? fail(404, "Representative not found.");
}
async function audit(tx: Prisma.TransactionClient, actor: RepresentativeAdminActor, action: string, targetType: string, targetId: string,
  metadata: Record<string, unknown>, at?: Date) {
  await tx.auditLog.create({ data: { actorType: "ADMIN", actorAdminId: actor.adminAccessId, action, targetType, targetId,
    metadataJson: JSON.stringify(metadata), ...(at ? { createdAt: at } : {}) } });
}

async function admitAdmin(actor: RepresentativeAdminActor, mutation: boolean) {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const kind = mutation ? "write" : "read";
    for (const [key, limit] of [[`representative-admin:${kind}:global`, mutation ? 300 : 1200], [`representative-admin:${kind}:${actor.adminAccessId}`, mutation ? 60 : 300]] as const) {
      await tx.$executeRaw`INSERT INTO "AuthThrottleBucket" ("key", "attemptCount", "windowExpiresAt") VALUES (${key}, 0, TIMESTAMPTZ 'epoch') ON CONFLICT ("key") DO NOTHING`;
      const [row] = await tx.$queryRaw<{ attemptCount: number; windowExpiresAt: Date }[]>`SELECT "attemptCount", "windowExpiresAt" FROM "AuthThrottleBucket" WHERE "key" = ${key} FOR UPDATE`;
      const now = await clock(tx);
      if (row.windowExpiresAt > now && row.attemptCount >= limit) fail(429, "Too many administrative requests. Please try again later.");
      const expired = row.windowExpiresAt <= now;
      await tx.authThrottleBucket.update({ where: { key }, data: { attemptCount: expired ? 1 : row.attemptCount + 1, windowExpiresAt: expired ? new Date(now.getTime() + 300000) : row.windowExpiresAt } });
    }
  });
}
export async function runRepresentativeAdmin(request: Request, mutation: boolean,
  work: (actor: RepresentativeAdminActor, body: Record<string, unknown> | null) => Promise<unknown>) {
  const headers = representativePrivateHeaders;
  try {
    const session = await getSession({ strictAuthority: true });
    if (!session) return NextResponse.json({ error: "Please sign in as an administrator." }, { status: 401, headers });
    if (session.role !== "ADMIN" || !session.adminAccessId) return NextResponse.json({ error: "Administrator access required." }, { status: 403, headers });
    if (mutation && !representativeSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const actor = { adminAccessId: session.adminAccessId };
    await admitAdmin(actor, mutation);
    const body = mutation ? await readRepresentativeBody(request) : null;
    if (mutation && !body) fail(400, "Enter a valid JSON request.");
    return NextResponse.json(await work(actor, body), { headers });
  } catch (error) {
    if (error instanceof RepresentativeAdminError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof RepresentativeReportInputError) return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400, headers });
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "A record with this email, slug, operation key, or external reference already exists." }, { status: 409, headers });
    console.error("REPRESENTATIVE_ADMIN_OPERATION_FAILED");
    return NextResponse.json({ error: "Representative administration is temporarily unavailable." }, { status: 503, headers });
  }
}
export function representativeAdminQuery(request: Request, allowed: string[]) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => !allowed.includes(key))) fail(400, "Invalid request parameters.");
  return query;
}
function decodeCursor(value?: string) {
  if (!value) return null;
  try {
    if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const date = representativeAdminDate(parsed.date); representativeAdminId(parsed.id);
    return { date, id: parsed.id as string };
  } catch { return fail(400, "Invalid pagination cursor."); }
}
const encodeCursor = (date: Date, id: string) => Buffer.from(JSON.stringify({ date: date.toISOString(), id })).toString("base64url");

export async function listRepresentatives(cursor?: string) {
  const after = decodeCursor(cursor);
  const rows = await db.representative.findMany({ where: after ? { OR: [{ createdAt: { lt: after.date } }, { createdAt: after.date, id: { lt: after.id } }] } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 26, select: profileSelect });
  return { items: rows.slice(0, 25).map(profileDto), nextCursor: rows.length > 25 ? encodeCursor(rows[24].createdAt, rows[24].id) : null };
}
const reservedReferralSlugs = new Set(["portal", "admin", "api", "login", "logout", "setup", "forgot-password", "reset-password"]);
export function representativeNameSlug(name: string): string {
  const base = name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(base)) fail(400, "The name must produce a valid referral URL using at least two ASCII characters, starting with a letter.");
  return base;
}
async function lockReferralSlugs(tx: Prisma.TransactionClient) {
  // Canonical names and aliases share one namespace. Every allocation/rename
  // takes this transaction lock before checking either table.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('representative-referral-slug-namespace'), 0)`;
}
async function allocateReferralSlug(tx: Prisma.TransactionClient, name: string, representativeId?: string) {
  const base = representativeNameSlug(name);
  for (let number = 1; number <= 10000; number++) {
    const suffix = number === 1 ? "" : `-${number}`;
    const slug = base.slice(0, 48 - suffix.length).replace(/-+$/g, "") + suffix;
    if (reservedReferralSlugs.has(slug)) continue;
    const canonical = await tx.representative.findFirst({ where: { slug: { equals: slug, mode: "insensitive" } }, select: { id: true } });
    const alias = await tx.representativeReferralAlias.findFirst({ where: { slug: { equals: slug, mode: "insensitive" } }, select: { representativeId: true } });
    if ((!canonical || canonical.id === representativeId) && (!alias || alias.representativeId === representativeId)) return slug;
  }
  return fail(409, "Could not allocate a unique referral URL. Please try again.");
}
export async function createRepresentative(actor: RepresentativeAdminActor, input: Record<string, unknown>) {
  const body = representativeAdminFields(input, ["displayName", "email"]);
  const displayName = text(body.displayName, 120), email = representativeEmailInput(body.email);
  if (!email) fail(400, "Enter a valid representative email.");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await lockReferralSlugs(tx);
        const slug = await allocateReferralSlug(tx, displayName);
        const row = await tx.representative.create({ data: { displayName, email: email!, slug, loginEnabled: true }, select: profileSelect });
        await audit(tx, actor, "REPRESENTATIVE_CREATED", "REPRESENTATIVE", row.id, { representativeId: row.id, loginEnabled: true });
        return profileDto(row);
      });
    } catch (error) {
      const e = error as { code?: string; meta?: { target?: string[] } };
      if (e.code === "P2002" && e.meta?.target?.includes("slug") && attempt < 4) continue;
      if (e.code === "P2002") fail(409, "A representative with this email or slug already exists.");
      throw error;
    }
  }
  return fail(409, "Could not generate a unique referral slug. Please try again.");
}
/** Explicit maintenance operation only; no automatic backfill or public/admin UI.
 * Invoke only after all serving instances support alias resolution. */
export async function shortenRepresentativeReferralSlug(actor: RepresentativeAdminActor, id: string) {
  representativeAdminId(id);
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockReferralSlugs(tx);
    const previous = await lockRepresentative(tx, id);
    const slug = await allocateReferralSlug(tx, previous.displayName, id);
    if (slug === previous.slug) return profileDto(previous);
    const oldSlug = previous.slug.toLowerCase();
    const existingAlias = await tx.representativeReferralAlias.findUnique({ where: { slug: oldSlug }, select: { representativeId: true } });
    if (existingAlias && existingAlias.representativeId !== id) fail(409, "The historical referral URL belongs to another representative.");
    if (!existingAlias) await tx.representativeReferralAlias.create({ data: { slug: oldSlug, representativeId: id } });
    const row = await tx.representative.update({ where: { id }, data: { slug }, select: profileSelect });
    await audit(tx, actor, "REPRESENTATIVE_REFERRAL_SLUG_SHORTENED", "REPRESENTATIVE", id, { representativeId: id, previousSlug: previous.slug, slug });
    return profileDto(row);
  });
}
export async function setRepresentativeLogin(actor: RepresentativeAdminActor, id: string, input: Record<string, unknown>) {
  const body = representativeAdminFields(input, ["loginEnabled"]);
  if (typeof body.loginEnabled !== "boolean") fail(400, "Choose whether login is enabled.");
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await lockRepresentative(tx, representativeAdminId(id));
    if (row.loginEnabled === body.loginEnabled) return profileDto(row);
    const updated = await tx.representative.update({ where: { id }, data: { loginEnabled: body.loginEnabled as boolean, sessionVersion: { increment: 1 },
      resetTokenHash: null, resetTokenExpiresAt: null, resetTokenSessionVersion: null }, select: profileSelect });
    await audit(tx, actor, "REPRESENTATIVE_LOGIN_CHANGED", "REPRESENTATIVE", id, { representativeId: id, loginEnabled: updated.loginEnabled });
    return profileDto(updated);
  });
}
export async function sendRepresentativeSetup(actor: RepresentativeAdminActor, id: string): Promise<boolean> {
  const row = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await lockRepresentative(tx, representativeAdminId(id));
    if (!row.loginEnabled) fail(409, "Enable representative login before sending an account-setup link.");
    await audit(tx, actor, "REPRESENTATIVE_SETUP_EMAIL_REQUESTED", "REPRESENTATIVE", id, { representativeId: id });
    return row;
  });
  const issued = await issueRepresentativeRecovery(row.email);
  if (!issued) return false;
  try {
    const { sendRepresentativeRecoveryEmail } = await import("@/lib/representativeEmail");
    await sendRepresentativeRecoveryEmail(issued);
    return true;
  } catch { console.error("REPRESENTATIVE_SETUP_DELIVERY_FAILED"); return false; }
}
export async function createRepresentativeAgreement(actor: RepresentativeAdminActor, id: string, input: Record<string, unknown>) {
  const body = representativeAdminFields(input, ["effectiveAt", "agreementReference", "agreementVersion"]);
  const effectiveAt = representativeAdminDate(body.effectiveAt), dates = representativeAgreementDates(effectiveAt);
  const agreementReference = text(body.agreementReference, 120, false) || null, agreementVersion = text(body.agreementVersion, 80, false) || null;
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockRepresentative(tx, representativeAdminId(id));
    const overlap = await tx.representativeAgreement.findFirst({ where: { representativeId: id, effectiveAt: { lt: dates.expiresAt }, expiresAt: { gt: effectiveAt } }, select: { id: true } });
    if (overlap) fail(409, "This agreement overlaps an existing agreement.");
    const approvedAt = await clock(tx);
    const row = await tx.representativeAgreement.create({ data: { representativeId: id, ...dates, approvedAt, approvedByAdminId: actor.adminAccessId, agreementReference, agreementVersion } });
    await audit(tx, actor, "REPRESENTATIVE_AGREEMENT_APPROVED", "REPRESENTATIVE_AGREEMENT", row.id,
      { representativeId: id, agreementId: row.id, effectiveAt: effectiveAt.toISOString(), expiresAt: dates.expiresAt.toISOString() }, approvedAt);
    return { id: row.id, effectiveAt: row.effectiveAt.toISOString(), expiresAt: row.expiresAt.toISOString(), approvedAt: row.approvedAt.toISOString(), agreementReference, agreementVersion };
  });
}
export async function listRepresentativeAgreements(id: string, cursor?: string) {
  const after = decodeCursor(cursor);
  const rows = await db.representativeAgreement.findMany({ where: { representativeId: representativeAdminId(id),
    ...(after ? { OR: [{ effectiveAt: { lt: after.date } }, { effectiveAt: after.date, id: { lt: after.id } }] } : {}) },
    orderBy: [{ effectiveAt: "desc" }, { id: "desc" }], take: 26,
    select: { id: true, effectiveAt: true, expiresAt: true, approvedAt: true, agreementReference: true, agreementVersion: true } });
  return { items: rows.slice(0, 25).map(row => ({ ...row, effectiveAt: row.effectiveAt.toISOString(), expiresAt: row.expiresAt.toISOString(), approvedAt: row.approvedAt.toISOString() })),
    nextCursor: rows.length > 25 ? encodeCursor(rows[24].effectiveAt, rows[24].id) : null };
}
export async function authorizeRepresentativeBusiness(actor: RepresentativeAdminActor, id: string, referralId: string, input: Record<string, unknown>) {
  const body = representativeAdminFields(input, ["agreementId"]), agreementId = representativeAdminId(text(body.agreementId, 128));
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockRepresentative(tx, representativeAdminId(id));
    await tx.$queryRaw`SELECT "id" FROM "RepresentativeReferral" WHERE "id" = ${representativeAdminId(referralId)} AND "representativeId" = ${id} FOR UPDATE`;
    const row = await tx.representativeReferral.findFirst({ where: { id: referralId, representativeId: id } });
    if (!row) return fail(404, "Referred business not found.");
    if (row.authorizingAgreementId) {
      if (row.authorizingAgreementId === agreementId && row.commissionEligibleFrom) return { id: row.id, agreementId, commissionEligibleFrom: row.commissionEligibleFrom.toISOString() };
      return fail(409, "This business already has an authorization; its historical terms cannot be replaced.");
    }
    const now = await clock(tx);
    if (row.productScope !== "RENTFRAY") fail(409, "Only verified RentFray businesses can be authorized.");
    if (row.businessCreatedAt > now || now >= row.businessExpiresAt) fail(409, "This business is outside its original commission window.");
    const agreement = await tx.representativeAgreement.findFirst({ where: { id: agreementId, representativeId: id, effectiveAt: { lte: now }, expiresAt: { gt: now }, approvedAt: { lte: now } } });
    if (!agreement) fail(409, "Select an approved agreement active at the authorization time.");
    await tx.representativeReferral.update({ where: { id: row.id }, data: { authorizingAgreementId: agreementId, commissionEligibleFrom: now } });
    await audit(tx, actor, "REPRESENTATIVE_BUSINESS_AUTHORIZED", "REPRESENTATIVE_REFERRAL", row.id, {
      representativeId: id, propertyId: row.propertyId, agreementId, commissionEligibleFrom: now.toISOString(),
      businessCreatedAt: row.businessCreatedAt.toISOString(), businessExpiresAt: row.businessExpiresAt.toISOString(),
    }, now);
    return { id: row.id, agreementId, commissionEligibleFrom: now.toISOString() };
  });
}
export async function recordRepresentativePayout(actor: RepresentativeAdminActor, id: string, input: Record<string, unknown>) {
  const body = representativeAdminFields(input, ["amountUsd", "paidAt", "reportingMonth", "externalPayoutReference", "operationKey", "note"]);
  const amountCents = representativeUsdCents(body.amountUsd), paidAt = representativeAdminDate(body.paidAt), reportingMonth = text(body.reportingMonth, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportingMonth)) fail(400, "Enter a valid reporting month.");
  const operationKey = text(body.operationKey, 36), externalPayoutReference = text(body.externalPayoutReference, 200), note = text(body.note, 1000, false) || null;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(operationKey)) fail(400, "A stable payout operation key is required.");
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await lockRepresentative(tx, representativeAdminId(id));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'representative-payout:' + operationKey}))`;
    const existing = await tx.representativePayout.findUnique({ where: { operationKey }, select: payoutSelect });
    if (existing) {
      if (existing.representativeId !== id || existing.amountCents !== amountCents || existing.paidAt.getTime() !== paidAt.getTime() ||
        existing.reportingMonth !== reportingMonth || existing.externalPayoutReference !== externalPayoutReference || existing.note !== note) fail(409, "This payout operation key was already used with different details.");
      return payoutDto(existing);
    }
    const now = await clock(tx);
    if (paidAt > now) fail(400, "Only completed payments can be recorded; the paid date cannot be in the future.");
    const row = await tx.representativePayout.create({ data: { representativeId: id, amountCents, paidAt, recordedAt: now, recordedByAdminId: actor.adminAccessId,
      reportingMonth, operationKey, externalPayoutReference, note }, select: payoutSelect });
    await audit(tx, actor, "REPRESENTATIVE_PAYOUT_RECORDED", "REPRESENTATIVE_PAYOUT", row.id,
      { representativeId: id, payoutId: row.id, amountCents, paidAt: paidAt.toISOString(), reportingMonth }, now);
    return payoutDto(row);
  });
}
export async function getRepresentativeAdminDetail(id: string, options: RepresentativeReportOptions & { agreementCursor?: string } = {}) {
  const row = await db.representative.findUnique({ where: { id: representativeAdminId(id) }, select: profileSelect });
  if (!row) return fail(404, "Representative not found.");
  const now = new Date(), report = await getRepresentativeDashboard(id, options, now);
  const ids = report.businesses.items.map(item => item.id);
  const extra = ids.length ? await db.representativeReferral.findMany({ where: { representativeId: id, id: { in: ids } }, select: {
    id: true, productScope: true, authorizingAgreementId: true, commissionEligibleFrom: true,
    authorizingAgreement: { select: { effectiveAt: true, expiresAt: true } },
  } }) : [];
  const lifetime = ids.length ? await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<{ id: string; count: bigint }[]>`SELECT r."id", COUNT(DISTINCT p."id") AS count ${representativeQualifyingPayments(id, now)}
      AND r."id" IN (${Prisma.join(ids)}) GROUP BY r."id"`;
  }) : [];
  const lifetimeMap = new Map(lifetime.map(item => [item.id, Number(item.count) * 250]));
  if ([...lifetimeMap.values()].some(value => !Number.isSafeInteger(value))) throw new Error("Report range exceeded.");
  const extraMap = new Map(extra.map(item => [item.id, item]));
  const payoutIds = report.payouts.items.map(item => item.id);
  const payoutRows = payoutIds.length ? await db.representativePayout.findMany({ where: { representativeId: id, id: { in: payoutIds } }, select: payoutSelect }) : [];
  const payoutMap = new Map(payoutRows.map(item => [item.id, payoutDto(item)]));
  const active = await db.representativeAgreement.findFirst({ where: { representativeId: id, effectiveAt: { lte: now }, expiresAt: { gt: now }, approvedAt: { lte: now } },
    orderBy: { effectiveAt: "desc" }, select: { id: true, effectiveAt: true, expiresAt: true } });
  return { representative: profileDto(row), report, agreements: await listRepresentativeAgreements(id, options.agreementCursor),
    activeAgreement: active ? { id: active.id, effectiveAt: active.effectiveAt.toISOString(), expiresAt: active.expiresAt.toISOString() } : null,
    businesses: report.businesses.items.map(item => { const meta = extraMap.get(item.id)!; return { ...item, lifetimeCents: lifetimeMap.get(item.id) ?? 0,
      productScope: meta.productScope, authorizingAgreementId: meta.authorizingAgreementId, commissionEligibleFrom: meta.commissionEligibleFrom?.toISOString() ?? null,
      authorizingAgreement: meta.authorizingAgreement ? { effectiveAt: meta.authorizingAgreement.effectiveAt.toISOString(), expiresAt: meta.authorizingAgreement.expiresAt.toISOString() } : null }; }),
    payouts: report.payouts.items.map(item => payoutMap.get(item.id)!),
  };
}
export type RepresentativeAdminDetail = Awaited<ReturnType<typeof getRepresentativeAdminDetail>>;
export type RepresentativeAdminList = Awaited<ReturnType<typeof listRepresentatives>>;
