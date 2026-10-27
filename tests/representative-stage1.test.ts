import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as calendar from "../lib/representativeCalendar";
import type * as ReferralModule from "../lib/representativeReferrals";
import type { Prisma } from "@prisma/client";
import { loadRepresentativeModule, referrals, signingSecret } from "./representative-fixture";
const start = new Date("2026-01-01T06:00:00.123Z");
const representative = { id: "rep-a", createdAt: new Date("2025-01-01"), loginEnabled: false };
const touch = () => referrals.readRepresentativeReferral(referrals.signRepresentativeReferral(representative.id, start), start)!;

test("90-day cookie uses exact boundaries and rejects malformed, tampered and future touches", () => {
  const token = referrals.signRepresentativeReferral(representative.id, start);
  const expiration = start.getTime() + 90 * 86400000;
  assert.equal(referrals.readRepresentativeReferral(token, new Date(expiration - 1))?.expiresAt, expiration);
  assert.equal(referrals.readRepresentativeReferral(token, new Date(expiration)), null);
  assert.equal(referrals.readRepresentativeReferral(token, new Date(start.getTime() - 1)), null);
  for (const value of [undefined, "", "x".repeat(2049), "bad", token + "x", token.replace(/^./, "!")]) {
    assert.equal(referrals.readRepresentativeReferral(value, start), null);
  }
  const bad = loadRepresentativeModule<typeof ReferralModule>("lib/representativeReferrals.ts", {}, {});
  assert.equal(bad.readRepresentativeReferral(token, start), null);
  assert.throws(() => bad.signRepresentativeReferral("a", start));
});

test("separate namespace rejects creator/session signatures and malformed signed payloads", () => {
  for (const payload of [ { ...touch(), version: 2 }, { ...touch(), expiresAt: 1 }, { ...touch(), representativeId: 1 },
    { ...touch(), capturedAt: -1 }, null ]) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", signingSecret).update("rentfray:representative-referral:v1:" + encoded).digest("base64url");
    assert.equal(referrals.readRepresentativeReferral(encoded + "." + signature, start), null);
  }
  const encoded = Buffer.from(JSON.stringify(touch())).toString("base64url");
  for (const prefix of ["", "rentfray:creator-referral:v1:"]) {
    const signature = createHmac("sha256", signingSecret).update(prefix + encoded).digest("base64url");
    assert.equal(referrals.readRepresentativeReferral(encoded + "." + signature, start), null);
  }
});

for (const [input, expected] of [
  ["2024-02-29T18:20:30.123Z", "2027-02-28T18:20:30.123Z"],
  ["2024-03-14T07:30:00.000Z", "2027-03-14T08:30:00.000Z"], // target 02:30 gap -> 03:30
  ["2024-11-07T07:30:00.000Z", "2027-11-07T06:30:00.000Z"], // target 01:30 overlap -> earlier
  ["2026-06-01T12:00:00.000Z", "2029-06-01T12:00:00.000Z"],
]) test("Chicago 36-month clock " + input, () => {
  assert.equal(calendar.representativeExpiration(new Date(input)).toISOString(), expected);
  assert.equal(calendar.representativeAgreementDates(new Date(input)).expiresAt.toISOString(), expected);
});
test("calendar rejects invalid dates without changing caller date", () => {
  assert.throws(() => calendar.representativeExpiration(new Date("invalid")));
  const date = new Date(start); calendar.representativeExpiration(date); assert.equal(date.getTime(), start.getTime());
});

function dbFixture(agreements: Array<{ id: string; effectiveAt: Date; expiresAt: Date }> = []) {
  const rows: Record<string, unknown>[] = [];
  let calls = 0;
  const db = {
    representative: { findUnique: async () => representative },
    representativeAgreement: { findMany: async () => { calls++; return agreements; } },
    representativeReferral: { create: async ({ data }: { data: Record<string, unknown> }) => { rows.push(data); } },
  };
  return { db: db as unknown as Prisma.TransactionClient, rows, agreementCalls: () => calls };
}
test("UNKNOWN is tracking-only; Lite and absent touch perform no attribution", async () => {
  const f = dbFixture(); const property = { id: "p", name: "Business", createdAt: start };
  assert.equal(await referrals.attributeRepresentative(f.db, touch(), property), true);
  assert.equal(f.rows[0].productScope, "UNKNOWN"); assert.equal(f.rows[0].authorizingAgreementId, null);
  assert.equal(f.agreementCalls(), 0);
  assert.equal(await referrals.attributeRepresentative(f.db, touch(), property, "LITE"), false);
  assert.equal(await referrals.attributeRepresentative(f.db, null, property), false);
  assert.equal(f.rows.length, 1);
});
test("approved standard RentFray attribution stores independent fixed business clock", async () => {
  const effectiveAt = new Date("2023-01-02T06:00:00Z");
  const f = dbFixture([{ id: "agreement", ...calendar.representativeAgreementDates(effectiveAt) }]);
  await referrals.attributeRepresentative(f.db, touch(), { id: "p", name: "Business", createdAt: start }, "RENTFRAY");
  assert.equal(f.rows[0].authorizingAgreementId, "agreement");
  assert.equal((f.rows[0].businessExpiresAt as Date).getTime(), calendar.representativeExpiration(start).getTime());
  assert.ok((f.rows[0].businessExpiresAt as Date) > calendar.representativeExpiration(effectiveAt));
});
test("expired, ambiguous or malformed agreements remain tracking-only", async () => {
  const agreement = { id: "a", ...calendar.representativeAgreementDates(start) };
  for (const agreements of [[], [agreement, { ...agreement, id: "b" }], [{ ...agreement, expiresAt: new Date("2026-02-01") }]]) {
    const f = dbFixture(agreements);
    await referrals.attributeRepresentative(f.db, touch(), { id: "p", name: "Business", createdAt: start }, "RENTFRAY");
    assert.equal(f.rows[0].authorizingAgreementId, null);
  }
});

test("attribution rejects unknown identities, pre-creation and expired touches", async () => {
  const f = dbFixture();
  for (const createdAt of [new Date(start.getTime() - 1), new Date(touch().expiresAt)]) {
    assert.equal(await referrals.attributeRepresentative(f.db, touch(), { id: "p", name: "Business", createdAt }), false);
  }
  const missing = { ...f.db, representative: { findUnique: async () => null } } as unknown as Prisma.TransactionClient;
  assert.equal(await referrals.attributeRepresentative(missing, touch(), { id: "p", name: "Business", createdAt: start }), false);
  assert.equal(f.rows.length, 0);
});

for (const scenario of ["missing", "first", "invalid", "expired", "unknown", "secret-missing"]) test("permanent redirect and first touch: " + scenario, async () => {
  const now = new Date();
  const initial = scenario === "first" ? referrals.signRepresentativeReferral("rep-a", now) :
    scenario === "unknown" ? referrals.signRepresentativeReferral("gone", now) :
    scenario === "expired" ? referrals.signRepresentativeReferral("rep-a", new Date(now.getTime() - 90 * 86400000)) : "invalid";
  const writes: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  class Response {
    headers = new Map<string, string>(); status = 303; destination = "";
    cookies = { set: (name: string, value: string, options: Record<string, unknown>) => writes.push({ name, value, options }) };
    static redirect(url: URL) { const response = new Response(); response.destination = url.href; return response; }
  }
  const helper = scenario === "secret-missing" ? loadRepresentativeModule<typeof ReferralModule>("lib/representativeReferrals.ts", {}, {}) : referrals;
  const route = loadRepresentativeModule<{ GET(req: unknown, ctx: unknown): Promise<Response> }>("app/r/[slug]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/representativeReferrals": helper,
    "@/lib/prisma": { prisma: { representative: { findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
      where.slug ? { id: "rep-b", loginEnabled: false } : where.id === "rep-a" ? representative : null } } },
  });
  const result = await route.GET({ cookies: { get: () => scenario === "missing" ? undefined : { value: initial } } }, { params: Promise.resolve({ slug: "REP-B" }) });
  assert.equal(result.destination, "https://www.rentfray.com/");
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(writes.length, scenario === "first" || scenario === "secret-missing" ? 0 : 1);
  if (writes.length) {
    assert.equal(writes[0].name, "rf_representative_referral");
    assert.equal(writes[0].options.maxAge, 90 * 86400); assert.equal(writes[0].options.httpOnly, true);
    assert.equal(writes[0].options.secure, true); assert.equal(writes[0].options.sameSite, "lax");
    assert.equal(writes[0].options.path, "/"); assert.equal(writes[0].options.domain, undefined);
    assert.equal(referrals.readRepresentativeReferral(writes[0].value)?.representativeId, "rep-b");
  }
});

test("slugs reserve portal and reject route traversal", () => {
  for (const value of ["portal", "a", "../admin", "admin/private", "bad-", "a".repeat(49)]) assert.equal(referrals.isRepresentativeSlug(value), false);
  assert.equal(referrals.isRepresentativeSlug("valid-rep"), true);
});

test("redirect rejects invalid and unknown slugs without exposing account fields", async () => {
  let reads = 0;
  class Response {
    constructor(public body: unknown, public options: { status: number; headers: Record<string, string> }) {}
  }
  const route = loadRepresentativeModule<{ GET(req: unknown, ctx: unknown): Promise<Response> }>("app/r/[slug]/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/representativeReferrals": referrals,
    "@/lib/prisma": { prisma: { representative: { findUnique: async (query: unknown) => {
      reads++; assert.deepEqual(JSON.parse(JSON.stringify(query)), { where: { slug: "unknown" }, select: { id: true } }); return null;
    } } } },
  });
  for (const slug of ["portal", "../admin", "unknown"]) {
    const result = await route.GET({}, { params: Promise.resolve({ slug }) });
    assert.equal(result.options.status, 404); assert.equal(result.body, null);
    assert.equal(result.options.headers["Cache-Control"], "private, no-store");
  }
  assert.equal(reads, 1);
});

test("proxy admits representative redirects and portal while keeping nested/management paths protected", async () => {
  const proxy = loadRepresentativeModule<{ proxy(req: unknown): Promise<{ allowed?: boolean; destination?: string }> }>("proxy.ts", {
    "next/server": { NextResponse: { next: () => ({ allowed: true, headers: new Map<string, string>() }), redirect: (url: URL) => ({ destination: url.pathname }) } },
    "@/lib/prisma": { prisma: { creator: { findUnique: async () => null } } },
    "@/lib/creatorSlugRules": { isCreatorSlug: () => false, normalizeCreatorSlug: (value: string) => value },
  });
  const navigate = (pathname: string) => proxy.proxy({ nextUrl: { pathname, clone: () => new URL(pathname, "https://www.rentfray.com") }, cookies: { get: () => undefined } });
  assert.equal((await navigate("/r/valid-rep")).allowed, true);
  assert.equal((await navigate("/r/portal")).allowed, true);
  for (const path of ["/r/portal/private", "/r/valid-rep/private", "/r", "/admin", "/manager"]) {
    assert.equal((await navigate(path)).destination, "/property-code");
  }
});
