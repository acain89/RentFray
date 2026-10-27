import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { stage2Load, stage2Secret, representativeRequest } from "./representative-stage2-fixture";
import type * as Session from "../lib/representativeSession";
import type * as Auth from "../lib/representativeAuth";
import type * as Reports from "../lib/representativeReports";

const hashed = bcrypt.hashSync("isolated-password", 12);
function sessionFixture() {
  const row = { id: "rep-a", displayName: "Representative A", passwordHash: hashed as string | null, loginEnabled: true, sessionVersion: 3 };
  const cookieValues = new Map<string, string>();
  const written: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const db = { representative: { findUnique: async () => row } };
  const mocks = { "@/lib/prisma": { prisma: db }, "next/headers": { cookies: async () => ({
    get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => written.push({ name, value, options }),
  }) } };
  const session = stage2Load<typeof Session>("lib/representativeSession.ts", mocks);
  return { session, row, db, mocks, cookieValues, written };
}

test("dedicated signed session validates exact expiry, tampering, audience and shape", () => {
  const { session } = sessionFixture(); const now = new Date();
  const token = session.createRepresentativeSessionToken("rep-a", 3, now);
  assert.equal(session.readRepresentativeSessionToken(token, now)?.representativeId, "rep-a");
  assert.equal(session.readRepresentativeSessionToken(token, new Date(Math.floor(now.getTime() / 1000) * 1000 + 8 * 3600000)), null);
  assert.equal(session.readRepresentativeSessionToken(token + "x"), null);
  assert.equal(session.readRepresentativeSessionToken(token, new Date(now.getTime() - 2000)), null);
  assert.equal(session.readRepresentativeSessionToken("x".repeat(2049)), null);
  const payload = token.split(".")[0];
  const managementSignature = createHmac("sha256", stage2Secret).update(payload).digest("base64url");
  assert.equal(session.readRepresentativeSessionToken(payload + "." + managementSignature), null);
  for (const patch of [{ aud: "ADMIN" }, { role: "ADMIN" }, { version: -1 }, { representativeId: "" }]) {
    const encoded = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), ...patch })).toString("base64url");
    const signature = createHmac("sha256", stage2Secret).update("rentfray:representative-session:v1:" + encoded).digest("base64url");
    assert.equal(session.readRepresentativeSessionToken(encoded + "." + signature), null);
  }
});
test("session configuration fails closed", () => {
  const f = sessionFixture();
  const broken = stage2Load<typeof Session>("lib/representativeSession.ts", f.mocks, {});
  assert.throws(() => broken.createRepresentativeSessionToken("rep-a", 1));
  assert.equal(broken.readRepresentativeSessionToken(f.session.createRepresentativeSessionToken("rep-a", 3)), null);
});
test("revalidation revokes disabled, version-changed or unset credentials; agreement expiration is irrelevant", async () => {
  const f = sessionFixture(); const token = f.session.createRepresentativeSessionToken("rep-a", 3);
  assert.equal((await f.session.validateRepresentativeSession(token))?.id, "rep-a");
  f.row.loginEnabled = false; assert.equal(await f.session.validateRepresentativeSession(token), null);
  f.row.loginEnabled = true; f.row.sessionVersion++; assert.equal(await f.session.validateRepresentativeSession(token), null);
  f.row.sessionVersion = 3; f.row.passwordHash = null; assert.equal(await f.session.validateRepresentativeSession(token), null);
});
test("representative cookie is host-only, secure, HttpOnly and isolated from rf_session", async () => {
  const f = sessionFixture(); f.cookieValues.set("rf_session", f.session.createRepresentativeSessionToken("rep-a", 3));
  assert.equal(await f.session.getRepresentativeSession(), null);
  await f.session.setRepresentativeSession("token"); await f.session.clearRepresentativeSession();
  assert.deepEqual(f.written.map(row => row.name), ["rf_representative_session", "rf_representative_session"]);
  assert.equal(f.written[0].options.httpOnly, true); assert.equal(f.written[0].options.secure, true);
  assert.equal(f.written[0].options.sameSite, "lax"); assert.equal(f.written[0].options.domain, undefined);
  assert.equal(f.written[0].options.maxAge, 8 * 3600); assert.equal(f.written[1].options.maxAge, 0);
});
test("existing management/admin token verifier rejects representative tokens", () => {
  const f = sessionFixture();
  const existing = stage2Load<typeof import("../lib/session")>("lib/session.ts", { ...f.mocks, crypto });
  assert.equal(existing.verifySessionToken(f.session.createRepresentativeSessionToken("rep-a", 3)), null);
});
test("bcrypt-only login succeeds without agreement lookup and rejects bad, disabled and plain credentials", async () => {
  const f = sessionFixture();
  const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { "@/lib/prisma": { prisma: f.db }, "@/lib/representativeSession": f.session });
  assert.equal((await auth.authenticateRepresentative("a@example.invalid", "isolated-password"))?.id, "rep-a");
  assert.equal(await auth.authenticateRepresentative("a@example.invalid", "wrong-password"), null);
  f.row.loginEnabled = false; assert.equal(await auth.authenticateRepresentative("a@example.invalid", "isolated-password"), null);
  f.row.loginEnabled = true; f.row.passwordHash = "plain:isolated-password";
  assert.equal(await auth.authenticateRepresentative("a@example.invalid", "isolated-password"), null);
});
test("bounded JSON and exact same-origin checks reject cross-site requests", async () => {
  const { session } = sessionFixture();
  assert.equal(session.representativeSameOrigin(representativeRequest("/", {}, "https://evil.invalid")), false);
  assert.equal(session.representativeSameOrigin(representativeRequest("/", {})), true);
  assert.equal(await session.readRepresentativeBody(new Request("https://www.rentfray.com", { method: "POST", body: "[]", headers: { "Content-Type": "application/json" } })), null);
  assert.equal(await session.readRepresentativeBody(representativeRequest("/", { huge: "x".repeat(5000) })), null);
  assert.equal(await session.readRepresentativeBody(new Request("https://www.rentfray.com", { method: "POST", body: "{}" })), null);
});

type Route = { POST(request: Request): Promise<Response>; GET(request: Request): Promise<Response> };
const responseMock = { NextResponse: { json: (body: unknown, options?: ResponseInit) => Response.json(body, options) } };
test("login API normalizes email, ignores browser IDs/roles and returns only an opaque result", async () => {
  const f = sessionFixture(); let identity = "";
  const route = stage2Load<Route>("app/api/representative/session/route.ts", {
    "next/server": responseMock, "@/lib/representativeSession": { ...f.session, setRepresentativeSession: async () => {} },
    "@/lib/representativeThrottle": { admitRepresentativeAuth: async () => ({ admitted: true }) },
    "@/lib/representativeAuth": { representativeEmailInput: (value: string) => value.toLowerCase().trim(), representativePasswordInput: () => true,
      authenticateRepresentative: async (email: string) => { identity = email; return { id: "rep-a", displayName: "A", sessionVersion: 3 }; } },
  });
  const response = await route.POST(representativeRequest("/api/representative/session", { email: " A@EXAMPLE.INVALID ", password: "password", representativeId: "rep-b", role: "ADMIN" }));
  assert.equal(response.status, 200); assert.equal(identity, "a@example.invalid");
  assert.deepEqual(await response.json(), { ok: true }); assert.match(response.headers.get("cache-control")!, /private, no-store/);
  assert.equal((await route.POST(representativeRequest("/", {}, "https://evil.invalid"))).status, 403);
});
test("dashboard API derives scope exclusively from validated session and rejects browser identity selectors", async () => {
  const f = sessionFixture(); let requested = ""; let signedIn = true;
  const reports = { getRepresentativeDashboard: async (id: string) => { requested = id; return { safe: true }; }, RepresentativeReportInputError: class extends Error {} };
  const route = stage2Load<Route>("app/api/representative/dashboard/route.ts", { "next/server": responseMock,
    "@/lib/representativeSession": { ...f.session, getRepresentativeSession: async () => signedIn ? { id: "rep-a" } : null }, "@/lib/representativeReports": reports });
  assert.equal((await route.GET(representativeRequest("/api/representative/dashboard"))).status, 200); assert.equal(requested, "rep-a");
  assert.equal((await route.GET(representativeRequest("/api/representative/dashboard?representativeId=rep-b"))).status, 400);
  signedIn = false; assert.equal((await route.GET(representativeRequest("/api/representative/dashboard"))).status, 401);
});
test("server-rendered portal redirects before reading reports without a representative session", async () => {
  let reads = 0;
  const redirect = new Error("test redirect");
  const page = stage2Load<{ default(): Promise<unknown> }>("app/r/portal/page.tsx", {
    "next/navigation": { redirect: () => { throw redirect; } }, "react/jsx-runtime": {},
    "@/lib/representativeSession": { getRepresentativeSession: async () => null },
    "@/lib/representativeReports": { getRepresentativeDashboard: async () => { reads++; } },
    "./RepresentativeDashboard": { default: () => null },
  });
  await assert.rejects(page.default(), error => error === redirect); assert.equal(reads, 0);
});
test("portal proxy admission is private and does not admit nested management paths", async () => {
  const proxy = stage2Load<{ proxy(request: unknown): Promise<{ allowed?: boolean; headers?: Map<string, string>; destination?: string }> }>("proxy.ts", {
    "next/server": { NextResponse: { next: () => ({ allowed: true, headers: new Map<string, string>() }), redirect: (url: URL) => ({ destination: url.pathname }) } },
    "@/lib/prisma": { prisma: { creator: { findUnique: async () => null } } },
    "@/lib/creatorSlugRules": { isCreatorSlug: () => false, normalizeCreatorSlug: (value: string) => value },
  });
  const navigate = (pathname: string) => proxy.proxy({ nextUrl: { pathname, clone: () => new URL(pathname, "https://www.rentfray.com") }, cookies: { get: () => undefined } });
  const portal = await navigate("/r/portal");
  assert.equal(portal.headers?.get("Cache-Control"), "private, no-store");
  assert.equal(portal.headers?.get("Referrer-Policy"), "no-referrer");
  assert.equal((await navigate("/r/portal/admin")).destination, "/property-code");
});
test("forgot password conceals account eligibility, throttling and delivery failure", async () => {
  const f = sessionFixture();
  for (const scenario of ["unknown", "throttled", "delivery-failure"]) {
    const route = stage2Load<Route>("app/api/representative/password-recovery/request/route.ts", {
      "next/server": responseMock, "@/lib/representativeSession": f.session,
      "@/lib/representativeAuth": { representativeEmailInput: () => "a@example.invalid", REPRESENTATIVE_RECOVERY_MESSAGE: "Generic confirmation", issueRepresentativeRecovery: async () => scenario === "unknown" ? null : { email: "a@example.invalid", token: "private-token" } },
      "@/lib/representativeThrottle": { admitRepresentativeAuth: async () => ({ admitted: scenario !== "throttled" }) },
      "@/lib/representativeEmail": { sendRepresentativeRecoveryEmail: async () => { throw new Error("provider private-token"); } },
    });
    const response = await route.POST(representativeRequest("/", { email: "a@example.invalid" }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, message: "Generic confirmation" });
  }
});
test("recovery email uses canonical HTTPS fragment link and existing mocked transport", async () => {
  let delivered: Record<string, unknown> = {};
  const email = stage2Load<{ sendRepresentativeRecoveryEmail(input: { email: string; token: string }): Promise<void> }>("lib/representativeEmail.ts", {
    "@/lib/resend": { EMAIL_FROM: "test@example.invalid", resend: { emails: { send: async (value: Record<string, unknown>) => { delivered = value; return {}; } } } },
  }, { NEXT_PUBLIC_APP_URL: "https://evil.invalid" });
  await email.sendRepresentativeRecoveryEmail({ email: "recipient@example.invalid", token: "a".repeat(64) });
  assert.equal(delivered.to, "recipient@example.invalid"); assert.match(String(delivered.text), /https:\/\/www\.rentfray\.com\/login\/representative\/reset-password#token=/);
  assert.ok(!String(delivered.text).includes("evil.invalid"));
});
test("password and email validation preserve passwords and enforce bcrypt byte limits", () => {
  const f = sessionFixture();
  const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { "@/lib/prisma": {}, "@/lib/representativeSession": f.session });
  assert.equal(auth.representativeEmailInput(" A@EXAMPLE.INVALID "), "a@example.invalid");
  assert.equal(auth.representativeEmailInput("bad"), null);
  assert.equal(auth.representativePasswordInput("short"), false);
  assert.equal(auth.representativePasswordInput("é".repeat(36)), true);
  assert.equal(auth.representativePasswordInput("é".repeat(37)), false);
  assert.equal(auth.representativePasswordInput(" password with spaces "), true);
});
test("every representative mutation rejects cross-site requests before service calls", async () => {
  const f = sessionFixture();
  for (const file of ["session", "logout", "password-recovery/request", "password-recovery/reset"]) {
    const route = stage2Load<Route>(`app/api/representative/${file}/route.ts`, {
      "next/server": responseMock, "@/lib/representativeSession": f.session,
      "@/lib/representativeAuth": {}, "@/lib/representativeThrottle": {},
    });
    assert.equal((await route.POST(representativeRequest("/", {}, "https://evil.invalid"))).status, 403);
  }
});
test("Chicago reporting months handle DST boundaries without financial calendar imports", () => {
  const reports = stage2Load<typeof Reports>("lib/representativeReports.ts", { "@/lib/prisma": {}, "@/lib/representativeReferrals": { REPRESENTATIVE_ORIGIN: "https://www.rentfray.com" } });
  assert.equal(reports.representativeMonth(new Date("2026-03-01T05:59:59Z")), "2026-02");
  assert.equal(reports.representativeMonthStart("2026-03").toISOString(), "2026-03-01T06:00:00.000Z");
  assert.equal(reports.representativeMonthStart("2026-04").toISOString(), "2026-04-01T05:00:00.000Z");
  assert.equal(reports.representativeMonthStart("2026-11").toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(reports.shiftRepresentativeMonth("2026-01", -1), "2025-12");
});
test("reporting rejects malformed cursors before querying and UI has no token persistence or financial controls", async () => {
  const reports = stage2Load<typeof Reports>("lib/representativeReports.ts", { "@/lib/prisma": {}, "@/lib/representativeReferrals": { REPRESENTATIVE_ORIGIN: "https://www.rentfray.com" } });
  await assert.rejects(reports.getRepresentativeDashboard("rep-a", { businessCursor: "bad!" }));
  await assert.rejects(reports.getRepresentativeDashboard("rep-a", { monthBefore: "9999-12" }));
  const form = readFileSync("app/login/representative/RepresentativeForm.tsx", "utf8");
  assert.match(form, /useLayoutEffect/); assert.match(form, /history\.replaceState/); assert.doesNotMatch(form, /localStorage|sessionStorage/);
  const reporting = readFileSync("lib/representativeReports.ts", "utf8");
  assert.doesNotMatch(reporting, /\.payment\.(?:update|create|delete)|\.ledgerEntry\.(?:update|create|delete)|@\/lib\/(?:stripe|ledger|unitFinancialState|billing)/);
  assert.match(reporting, /SET TRANSACTION READ ONLY/); assert.match(reporting, /COUNT\(DISTINCT p\."id"\)/);
});
