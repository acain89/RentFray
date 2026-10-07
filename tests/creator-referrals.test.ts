import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import type { Prisma } from "@prisma/client";
import { normalizeCreatorSlug, requireCreatorSlug, RESERVED_CREATOR_SLUGS } from "../lib/creatorSlugRules";
import * as referrals from "../lib/creatorReferrals";
import * as slugRules from "../lib/creatorSlugRules";
import { signReferral, readReferral, creatorAnniversary, creatorStatus, qualifyingPayment, creatorReports,
  attributeCreator, REFERRAL_TTL_SECONDS } from "../lib/creatorReferrals";

const root = resolve(__dirname, "..");
const originalSecret = process.env.CREATOR_REFERRAL_SECRET;
process.env.CREATOR_REFERRAL_SECRET = "isolated-referral-test-secret-not-used-outside-tests";
after(() => { if (originalSecret === undefined) delete process.env.CREATOR_REFERRAL_SECRET; else process.env.CREATOR_REFERRAL_SECRET = originalSecret; });
const start = new Date("2026-01-01T06:00:00Z");
const creator = { id: "creator-a", name: "Creator A", slug: "creator-a", startsAt: start,
  expiresAt: creatorAnniversary(start), createdAt: start };

function load<T>(path: string, mocks: Record<string, unknown>, extra: Record<string, unknown> = {}): T {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, path), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const actualRequire = createRequire(__filename);
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, Buffer, Request, URL, process,
    console: { error() {} }, ...extra, require(name: string) { return name in mocks ? mocks[name] : actualRequire(name); } });
  return fixtureModule.exports as T;
}

test("normalization, reserved routes, invalid input and root-route inventory", () => {
  assert.equal(normalizeCreatorSlug(" SeanPan "), "seanpan");
  assert.equal(requireCreatorSlug(" SeanPan "), "seanpan");
  for (const slug of ["admin", "setup", "api", "login", "tenant", "terms", "pricing", "../admin", "a", "a-", "_next", "foo/bar", "a".repeat(49)]) {
    assert.throws(() => requireCreatorSlug(slug));
  }
  for (const entry of readdirSync(resolve(root, "app"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("[")) continue;
    const names = entry.name.startsWith("(") ? readdirSync(resolve(root, "app", entry.name), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [entry.name];
    for (const name of names) assert.ok(RESERVED_CREATOR_SLUGS.has(name), `Missing reserved route: ${name}`);
  }
  for (const name of readdirSync(resolve(root, "public"))) assert.ok(RESERVED_CREATOR_SLUGS.has(name));
});

test("signed first touch rejects tampering, future capture, expiry and secret failure", () => {
  const token = signReferral(creator.id, start);
  assert.equal(readReferral(token, start)?.creatorId, creator.id);
  assert.equal(readReferral(token, new Date(start.getTime() + REFERRAL_TTL_SECONDS * 1000 - 1))?.creatorId, creator.id);
  assert.equal(readReferral(token, new Date(start.getTime() + REFERRAL_TTL_SECONDS * 1000)), null);
  assert.equal(readReferral(token, new Date(start.getTime() - 1)), null);
  assert.equal(readReferral(token + "x", start), null);
  assert.equal(readReferral("malformed", start), null);
  assert.equal(readReferral(token.replace(token[0], token[0] === "a" ? "b" : "a"), start), null);
  const configured = process.env.CREATOR_REFERRAL_SECRET;
  const session = process.env.SESSION_SECRET;
  delete process.env.CREATOR_REFERRAL_SECRET; delete process.env.SESSION_SECRET;
  assert.throws(() => signReferral(creator.id, start));
  assert.equal(readReferral(token, start), null);
  process.env.CREATOR_REFERRAL_SECRET = configured;
  if (session !== undefined) process.env.SESSION_SECRET = session;
});

for (const [input, expected] of [
  ["2024-02-29T18:23:45.123Z", "2025-02-28T18:23:45.123Z"],
  ["2025-03-08T08:30:00.000Z", "2026-03-08T08:30:00.000Z"],
  ["2025-11-01T06:30:00.000Z", "2026-11-01T06:30:00.000Z"],
  ["2025-07-01T17:00:00.111Z", "2026-07-01T17:00:00.111Z"],
  ["2023-03-10T08:30:00.000Z", "2024-03-10T08:30:00.000Z"],
]) test(`Chicago calendar anniversary ${input}`, () => assert.equal(creatorAnniversary(new Date(input)).toISOString(), expected));

test("ACTIVE automatically becomes EXPIRED at the exact boundary", () => {
  assert.equal(creatorStatus(creator.expiresAt, new Date(creator.expiresAt.getTime() - 1)), "ACTIVE");
  assert.equal(creatorStatus(creator.expiresAt, creator.expiresAt), "EXPIRED");
});

type Payment = Parameters<typeof qualifyingPayment>[0];
function payment(overrides: Partial<Payment> = {}): Payment {
  return { id: "payment-a", propertyId: "p", unitId: "u", tenantAssignmentId: "a", stripePaymentIntentId: "pi_real",
    stripeSessionId: "cs_real", billingCycle: "2026-01", amountCents: 10000, processingFeeCents: 500,
    status: "PAID", paymentMethod: "ACH", paidAt: start, failedAt: null, reversedAt: null, createdAt: start, updatedAt: start,
    ledgerEntries: [{ id: "l", propertyId: "p", unitId: "u", tenantAssignmentId: "a", paymentId: "payment-a", entryType: "PAYMENT",
      chargeType: null, paymentMethod: "ACH", amountCents: -10500, billingCycle: "2026-01", effectiveDate: start,
      memo: null, referenceNumber: "pi_real", idempotencyKey: "stripe:pi_real:payment", createdByManagementUserId: null,
      createdByAdminId: null, createdAt: start, updatedAt: start, voidedAt: null, voidedByManagementUserId: null, voidReason: null }], ...overrides };
}

test("commission interval and paidAt authority", () => {
  assert.equal(qualifyingPayment(payment(), creator, start), true);
  assert.equal(qualifyingPayment(payment({ paidAt: new Date(start.getTime() - 1) }), creator, start), false);
  assert.equal(qualifyingPayment(payment({ paidAt: new Date(creator.expiresAt.getTime() - 1) }), creator, start), true);
  assert.equal(qualifyingPayment(payment({ paidAt: creator.expiresAt }), creator, start), false);
  assert.equal(qualifyingPayment(payment({ paidAt: null }), creator, start), false);
  assert.equal(qualifyingPayment(payment(), creator, new Date(start.getTime() + 1)), false);
});
for (const status of ["UNPAID", "PENDING", "FAILED", "REVERSED"] as const) {
  test(`${status} payments never qualify`, () => assert.equal(qualifyingPayment(payment({ status }), creator, start), false));
}
test("manual, synthetic, identity-mismatched, uncollected and zero payments excluded", () => {
  for (const overrides of [{ paymentMethod: "MANUAL" }, { stripePaymentIntentId: "manual_123" }, { ledgerEntries: [] },
    { tenantAssignmentId: null }, { amountCents: 0 }]) assert.equal(qualifyingPayment(payment(overrides), creator, start), false);
  const wrong = payment(); wrong.ledgerEntries[0].tenantAssignmentId = "replacement";
  assert.equal(qualifyingPayment(wrong, creator, start), false);
});
test("partial return qualifies; full return excludes; reinstatement restores eligibility", () => {
  const partial = payment();
  partial.ledgerEntries.push({ ...partial.ledgerEntries[0], id: "return", entryType: "ADJUSTMENT", amountCents: 4000,
    referenceNumber: "pi_real:returned-principal", idempotencyKey: "stripe:pi_real:returned-principal" });
  assert.equal(qualifyingPayment(partial, creator, start), true);
  partial.ledgerEntries[1].amountCents = 10000;
  assert.equal(qualifyingPayment(partial, creator, start), false);
  partial.ledgerEntries[1].voidedAt = start;
  assert.equal(qualifyingPayment(partial, creator, start), true);
});

test("report retains expired/inactive/deleted businesses, counts active units and deduplicates intents", async () => {
  const db = { creator: { findMany: async () => [{ ...creator, referrals: [
    { attributedAt: start, retainedPropertyId: "p", businessNameSnapshot: "Old name", property: { name: "Inactive business", isActive: false,
      _count: { units: 3 }, payments: [payment(), payment({ id: "duplicate" })] } },
    { attributedAt: start, retainedPropertyId: "deleted-p", businessNameSnapshot: "Deleted business", property: null },
  ] }] } };
  const reports = await creatorReports(db as unknown as Prisma.TransactionClient, undefined, new Date("2030-01-01"));
  assert.equal(reports[0].status, "EXPIRED");
  assert.equal(reports[0].businesses[0].payments, 1);
  assert.equal(reports[0].businesses[0].commissionCents, 250);
  assert.equal(reports[0].businesses[0].units, 3);
  assert.equal(reports[0].businesses[1].propertyId, "deleted-p");
  assert.equal(reports[0].businesses[1].name, "Deleted business");
});

test("public signup captures attribution atomically, clears only success, and preserves unattributed signup", async () => {
  for (const scenario of ["attributed", "missing", "invalid", "creator-missing", "owner-fails"] as const) {
    const cookie = scenario === "missing" ? undefined : scenario === "invalid" ? "bad" : signReferral(creator.id);
    let committed: unknown[] = [];
    let cleared = false;
    const tx = {
      property: { findUnique: async () => null, create: async () => ({ id: "new-p", name: "My Property", propertyCode: "1234" }) },
      creator: { findUnique: async () => scenario === "creator-missing" ? null : creator },
      creatorReferral: { create: async ({ data }: { data: unknown }) => { committed.push(data); } },
      managementUser: { create: async () => { if (scenario === "owner-fails") throw Error("owner failed"); return { id: "owner" }; } },
      propertySettings: { create: async () => ({}) }, paymentConnectionStatus: { create: async () => ({}) },
    };
    const db = { managementUser: { findFirst: async () => null }, $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => {
      try { return await fn(tx); } catch (error) { committed = []; throw error; }
    } };
    const route = load<{ POST(req: Request): Promise<{ status: number }> }>("app/api/setup/create-account/route.ts", {
      "next/server": { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200,
        cookies: { set() { cleared = true; } } }) } }, "next/headers": { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) },
      "@prisma/client": { Prisma: {} }, bcryptjs: { default: { hash: async () => "hash" } },
      "@/lib/prisma": { prisma: db }, "@/lib/email": { sendVerificationEmail: async () => {} },
      "@/lib/creatorReferrals": { attributeCreator, REFERRAL_COOKIE: "rf_creator_referral", referralCookieOptions: {} },
    });
    const result = await route.POST(new Request("https://rentfray.com/api/setup/create-account", { method: "POST", body: JSON.stringify({
      firstName: "Test", lastName: "Owner", email: "test@example.com", password: "password-test", creatorId: "forged" }) }));
    assert.equal(result.status, scenario === "owner-fails" ? 500 : 200);
    assert.equal(committed.length, scenario === "attributed" ? 1 : 0);
    assert.equal(cleared, scenario === "attributed");
  }
});

test("migration preserves history, uniqueness and expiry; reporting has no financial writers", () => {
  const sql = readFileSync(resolve(root, "prisma/migrations/20261007010000_add_creator_referrals/migration.sql"), "utf8");
  assert.match(sql, /ON DELETE SET NULL/); assert.match(sql, /ON DELETE RESTRICT/);
  assert.match(sql, /UNIQUE INDEX "Creator_slug_key"/); assert.match(sql, /UNIQUE INDEX "CreatorReferral_retainedPropertyId_key"/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|UPDATE "Payment"/);
  const report = readFileSync(resolve(root, "scripts/check-creator-referrals.ts"), "utf8");
  assert.match(report, /RepeatableRead/); assert.doesNotMatch(report, /\.create\(|\.update\(|\.delete\(|stripe\./);
});
test("creator route preserves first touch, replaces expired/unknown touches, and never alters rf_session", async () => {
  const now = new Date();
  const other = { ...creator, id: "creator-b", slug: "creator-b" };
  for (const scenario of ["missing", "first", "expired", "unknown-cookie", "unknown-slug", "reserved"] as const) {
    const cookie = scenario === "first" ? signReferral(creator.id, now) : scenario === "expired" ? signReferral(creator.id, new Date(now.getTime() - REFERRAL_TTL_SECONDS * 1000)) : scenario === "unknown-cookie" ? signReferral("unknown", now) : undefined;
    const writes: { name: string; value: string; options: { httpOnly: boolean; sameSite: string; path: string; maxAge: number } }[] = [];
    class FakeResponse {
      status: number;
      headers = { set() {} };
      cookies = { set(name: string, value: string, options: typeof writes[number]["options"]) { writes.push({ name, value, options }); } };
      constructor(_body: unknown, options: { status: number }) { this.status = options.status; }
    static redirect(url: URL, status: number) { assert.equal(url.pathname, "/"); return new FakeResponse(null, { status }); }
    }
    const route = load<{ GET(req: unknown, ctx: unknown): Promise<FakeResponse> }>("app/[creatorSlug]/route.ts", {
      "next/server": { NextResponse: FakeResponse }, "@/lib/prisma": { prisma: { creator: { findUnique: async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id) return where.id === creator.id ? creator : null;
        return where.slug === other.slug ? other : null;
      } } } }, "@/lib/creatorSlugRules": { isCreatorSlug: (value: string) => { try { return requireCreatorSlug(value) === value; } catch { return false; } }, normalizeCreatorSlug },
      "@/lib/creatorReferrals": referrals,
    });
    const slug = scenario === "reserved" ? "admin" : scenario === "unknown-slug" ? "unknown" : other.slug;
    const result = await route.GET({ url: `https://rentfray.com/${slug}`, cookies: { get: () => cookie ? { value: cookie } : undefined } }, { params: Promise.resolve({ creatorSlug: slug }) });
    const is404 = scenario === "reserved" || scenario === "unknown-slug";
    assert.equal(result.status, is404 ? 404 : 303);
    assert.equal(writes.length, is404 || scenario === "first" ? 0 : 1);
    if (writes.length) {
      assert.equal(writes[0].name, "rf_creator_referral");
      assert.equal(readReferral(writes[0].value)?.creatorId, other.id);
      assert.equal(writes[0].options.httpOnly, true); assert.equal(writes[0].options.sameSite, "lax");
      assert.equal(writes[0].options.path, "/"); assert.equal(writes[0].options.maxAge, REFERRAL_TTL_SECONDS);
    }
  }
});

test("proxy only admits known creators; protected paths, unknown slugs and DB failure retain auth routing", async () => {
  let calls = 0;
  let unavailable = false;
  const proxyExports = load<{ proxy(req: unknown): Promise<{ status: number }> }>("proxy.ts", {
    "next/server": { NextResponse: { next: () => ({ status: 200 }), redirect: (url: URL) => { assert.equal(url.pathname, "/property-code"); return { status: 307 }; } } },
    "@/lib/prisma": { prisma: { creator: { findUnique: async ({ where }: { where: { slug: string } }) => {
      calls++; if (unavailable) throw Error("offline"); return where.slug === "creator-a" ? { id: creator.id } : null;
    } } } }, "@/lib/creatorSlugRules": slugRules,
  });
  async function request(path: string, session = false) {
    const url = new URL("https://rentfray.com" + path);
    return proxyExports.proxy({ nextUrl: { pathname: url.pathname, clone: () => new URL(url) }, cookies: { get: () => session ? { value: "opaque" } : undefined } });
  }
  assert.equal((await request("/creator-a")).status, 200);
  assert.equal((await request("/unknown")).status, 307);
  const before = calls;
  for (const path of ["/admin", "/manager", "/tenant", "/creator-a/private"]) assert.equal((await request(path)).status, 307);
  assert.equal(calls, before);
  assert.equal((await request("/setup")).status, 200);
  assert.equal((await request("/api/manual-payments")).status, 200);
  assert.equal((await request("/manager", true)).status, 200);
  unavailable = true;
  assert.equal((await request("/creator-a")).status, 307);
});
test("creator script normalizes, creates one exact-window record and rejects duplicate slugs", async () => {
  for (const duplicate of [false, true]) {
    const records: { slug: string; startsAt: Date; expiresAt: Date; createdAt: Date }[] = [];
    const output: string[] = [];
    let complete!: () => void;
    const done = new Promise<void>(resolve => { complete = resolve; });
    class KnownError extends Error { code = "P2002"; }
    class InitializationError extends Error {}
    class Client {
      creator = { create: async ({ data }: { data: typeof records[number] }) => {
        if (duplicate) throw new KnownError(); records.push(data); return { ...data, id: "new-creator", name: "Sean Pan" };
      } };
      async $disconnect() { complete(); }
    }
    const fakeProcess = { argv: ["node", "create-creator", "--name", "Sean Pan", "--slug", " SEANPAN "], exitCode: 0 };
    load("scripts/create-creator.ts", {
      "@prisma/client": { PrismaClient: Client, Prisma: { PrismaClientKnownRequestError: KnownError, PrismaClientInitializationError: InitializationError } },
      "../lib/creatorSlugRules": slugRules, "../lib/creatorReferrals": referrals,
    }, { process: fakeProcess, console: { log(value: string) { output.push(value); }, error(value: string) { output.push(value); } } });
    await done;
    assert.equal(records.length, duplicate ? 0 : 1);
    assert.equal(fakeProcess.exitCode, duplicate ? 1 : 0);
    if (!duplicate) {
      assert.equal(records[0].slug, "seanpan");
      assert.equal(records[0].startsAt.getTime(), records[0].createdAt.getTime());
      assert.equal(records[0].expiresAt.getTime(), creatorAnniversary(records[0].startsAt).getTime());
      assert.match(output.join("\n"), /Creator commission: \$0\.00/);
    } else assert.match(output.join("\n"), /already exists/);
  }
});
for (const [environment, requestUrl, destination] of [
    ["production", "http://srv-example:10000/andrew", "https://www.rentfray.com/"],
    ["production", "https://attacker.example/andrew", "https://www.rentfray.com/"],
    ["development", "http://localhost:3001/andrew", "http://localhost:3001/"],
    ["development", "http://127.0.0.1:4000/andrew", "http://127.0.0.1:4000/"],
    ["development", "http://[::1]:4000/andrew", "http://[::1]:4000/"],
    ["development", "http://srv-example:10000/andrew", "http://localhost:3000/"],
    ["development", "https://localhost.attacker.example/andrew", "http://localhost:3000/"],
]) test(`trusted referral redirect: ${environment} ${requestUrl}`, async () => {
  let location = "";
  const writes: { name: string; value: string; options: typeof referrals.referralCookieOptions & { maxAge: number } }[] = [];
  const response = { status: 303, headers: { set() {} }, cookies: {
    set(name: string, value: string, options: typeof writes[number]["options"]) { writes.push({ name, value, options }); },
  } };
  const route = load<{ GET(req: unknown, context: unknown): Promise<typeof response> }>("app/[creatorSlug]/route.ts", {
    "next/server": { NextResponse: { redirect(url: URL, status: number) { location = url.href; assert.equal(status, 303); return response; } } },
    "@/lib/prisma": { prisma: { creator: { findUnique: async () => creator } } },
    "@/lib/creatorSlugRules": slugRules, "@/lib/creatorReferrals": referrals,
  }, { process: { env: { NODE_ENV: environment } } });
  const result = await route.GET({ url: requestUrl, cookies: { get: () => undefined },
    headers: { get() { throw Error("Host/forwarded headers must not be trusted"); } } },
  { params: Promise.resolve({ creatorSlug: "andrew" }) });
  assert.equal(location, destination);
  assert.equal(result.status, 303);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, referrals.REFERRAL_COOKIE);
  assert.equal(referrals.readReferral(writes[0].value)?.creatorId, creator.id);
  assert.equal(writes[0].options.maxAge, referrals.REFERRAL_TTL_SECONDS);
  assert.equal(writes[0].options.httpOnly, true);
  assert.equal(writes[0].options.sameSite, "lax");
  assert.equal(writes[0].options.secure, referrals.referralCookieOptions.secure);
  assert.equal(writes[0].options.path, "/");
});
