import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

type Authority = typeof import("../lib/session");
type Role = import("../lib/session").SessionRole;
type Handler = (request: Request) => Promise<Response>;
const secret = "synthetic-aud06-response-test-secret-never-production";
const root = resolve(__dirname, "..");
function load<T>(file: string, imports: Record<string, unknown>): T {
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { module: holder, exports: holder.exports, Date, Error, Buffer, URL, Set, Map,
    process: { env: { SESSION_SECRET: secret, STRIPE_SECRET_KEY: "synthetic-unused-stripe-key", NODE_ENV: "test" } },
    console: { error() {}, log() {} }, require(name: string) {
      assert.ok(name in imports, "Unexpected isolated dependency: " + name); return imports[name];
    } });
  return holder.exports as T;
}
const tenantRoutes = ["tenant/balance", "tenant/payment-history", "tenant/maintenance/create",
  "tenant/maintenance/list", "tenant/dashboard", "tenant/ledger", "tenant/me", "payments/create-session"];
const routes = [...tenantRoutes, "manual-payments"];
function fixture(path: string, role: Role = "TENANT") {
  let token: string | undefined;
  const state = { current: true, active: true, authorityFailure: false, refreshRevoked: false,
    refreshFailure: false, authReads: 0, protectedReads: 0, cookieWrites: 0, bodyReads: 0,
    protectedFailure: "synthetic Prisma diagnostics: SQL detail must never reach clients" };
  const authorityRead = async (model: string, id: string) => {
    state.authReads++;
    if (state.authorityFailure || (state.refreshFailure && state.authReads > 1)) throw new Error(state.protectedFailure);
    if (!state.active || (state.refreshRevoked && state.authReads > 1)) return null;
    if (model === "tenantAssignment") return id === "a" ? { propertyId: "p", unitId: "u",
      isCurrent: state.current, moveOutDate: null, unit: { id: "u", propertyId: "p" } } : null;
    if (model === "managementUser") return id === "m" ? { id: "m", propertyId: "p", role,
      isActive: true, passwordHash: "synthetic-credential" } : null;
    if (model === "maintenanceUser") return id === "w" ? { id: "w", propertyId: "p", isActive: true } : null;
    return id === "admin" ? { id: "admin", isActive: true } : null;
  };
  const authDb = Object.fromEntries(["tenantAssignment", "managementUser", "maintenanceUser", "adminAccess"]
    .map(model => [model, { findUnique: ({ where }: { where: { id: string } }) => authorityRead(model, where.id) }]));
  const authority = load<Authority>("lib/session.ts", { crypto, "next/headers": {
    cookies: async () => ({ get: () => token ? { value: token } : undefined,
      set: () => { state.cookieWrites++; } }) }, "@/lib/prisma": { prisma: authDb } });
  const claims = role === "TENANT" ? { role, propertyId: "p", unitId: "u", tenantAssignmentId: "a" } :
    role === "ADMIN" ? { role, adminAccessId: "admin" } :
    role === "MAINTENANCE" ? { role, propertyId: "p", maintenanceUserId: "w" } :
      { role, propertyId: "p", managementUserId: "m",
        managementCredentialBinding: authority.createManagementCredentialBinding("m", "synthetic-credential") };
  token = authority.createSessionToken(claims);
  const resources = new Proxy({}, { get() { state.protectedReads++; throw new Error(state.protectedFailure); } });
  class StripeStub { static errors = { StripeError: class extends Error {} }; }
  class Conflict extends Error {}
  const imports = { "next/server": { NextResponse }, "@/lib/session": authority,
    "@/lib/prisma": { prisma: resources }, "@prisma/client": { Prisma: {}, PaymentStatus: { PAID: "PAID", PENDING: "PENDING" } },
    "@/lib/ledger": {}, "@/lib/billingConfig": {}, "@/lib/liveGating": {}, "@/lib/unitFinancialState": {},
    "@/lib/propertyStatus": {}, "@/lib/rentDates": {}, stripe: StripeStub,
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) }, "@/lib/checkoutCollectibility": { CheckoutConflict: Conflict },
    "@/lib/paymentStatus": {}, "@/lib/permissions": { canManageFinancials: (r: Role) => r === "OWNER" || r === "MANAGER" },
    "@/lib/realtime": {}, "@/lib/manualFinancialOperations": { ManualOperationError: class extends Error {},
      normalizeOperationId: (id: unknown) => id, isManualLockContention: () => false, isManualRetryable: () => false },
    "@/lib/billingCalendar": {},
  };
  const route = load<{ GET?: Handler; POST?: Handler }>("app/api/" + path + "/route.ts", imports);
  const handler = path === "manual-payments" || path === "tenant/dashboard" || path === "payments/create-session" ||
    path.endsWith("/create") ? route.POST : route.GET;
  assert.ok(handler);
  const request = new Request("http://localhost/api/" + path, { method: "POST" });
  Object.defineProperty(request, "json", { value: async () => { state.bodyReads++;
    return { category: "GENERAL", urgency: "NORMAL", description: "A valid maintenance description" }; } });
  const signed = (change: Record<string, unknown>) => {
    const payload = JSON.parse(Buffer.from(token!.split(".")[0], "base64url").toString("utf8")) as Record<string, unknown>;
    const encoded = Buffer.from(JSON.stringify({ ...payload, ...change })).toString("base64url");
    token = encoded + "." + crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  };
  return { state, authority, run: () => handler(request), signed, setToken: (value?: string) => { token = value; },
    corrupt: () => { token += "tampered"; } };
}
async function denied(f: ReturnType<typeof fixture>, expected: number) {
  const response = await f.run(); assert.equal(response.status, expected);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(f.state.protectedReads, 0); assert.equal(f.state.cookieWrites, 0); assert.equal(f.state.bodyReads, 0);
  assert.ok(!("data" in body) && !("payments" in body) && !("request" in body) && !("unit" in body));
  assert.ok(!JSON.stringify(body).includes("SQL detail"));
}
for (const route of routes) for (const kind of ["missing", "malformed", "bad-signature", "expired",
  "revoked", "vacated", "replaced", "property", "unit", "assignment", "assignmentless"]) {
  test(route + " rejects " + kind + " with 401 before protected operations", async () => {
    const f = fixture(route);
    if (kind === "missing") f.setToken();
    if (kind === "malformed") f.setToken("malformed");
    if (kind === "bad-signature") f.corrupt();
    if (kind === "expired") f.signed({ exp: 0 });
    if (kind === "revoked") f.state.active = false;
    if (kind === "vacated" || kind === "replaced") f.state.current = false;
    if (kind === "property") f.signed({ propertyId: "foreign" });
    if (kind === "unit") f.signed({ unitId: "foreign" });
    if (kind === "assignment") f.signed({ tenantAssignmentId: "foreign" });
    if (kind === "assignmentless") f.signed({ tenantAssignmentId: undefined });
    await denied(f, 401);
  });
}
for (const route of tenantRoutes) for (const role of ["OWNER", "MANAGER", "STAFF", "MAINTENANCE", "ADMIN"] as const)
  test(route + " denies valid " + role + " with 403", async () => { await denied(fixture(route, role), 403); });
for (const role of ["STAFF", "TENANT", "MAINTENANCE", "ADMIN"] as const)
  test("manual payments deny valid " + role + " with 403", async () => { await denied(fixture("manual-payments", role), 403); });
for (const route of routes) for (const role of ["TENANT", "OWNER", "MANAGER", "STAFF", "MAINTENANCE", "ADMIN"] as const)
  test(route + " does not disguise " + role + " authority outage as authentication", async () => {
    const f = fixture(route, role); f.state.authorityFailure = true; await denied(f, 500);
  });
for (const route of tenantRoutes) test(route + " unexpected protected database error remains generic 500", async () => {
  const f = fixture(route); const response = await f.run(); assert.equal(response.status, 500);
  assert.ok(f.state.protectedReads > 0); const body = await response.text();
  assert.ok(!body.includes("SQL detail") && !body.includes("Prisma diagnostics"));
});
for (const route of ["tenant/dashboard", "payments/create-session"]) {
  test(route + " refresh revocation is 401 without writes", async () => {
    const f = fixture(route); f.state.refreshRevoked = true; await denied(f, 401); assert.equal(f.state.authReads, 2);
  });
  test(route + " refresh database outage is generic 500", async () => {
    const f = fixture(route); f.state.refreshFailure = true; await denied(f, 500); assert.equal(f.state.authReads, 2);
  });
}
for (const route of tenantRoutes) test(route + " does not classify arbitrary Unauthorized exception text", async () => {
  const f = fixture(route); f.state.protectedFailure = "Unauthorized";
  const response = await f.run(); assert.equal(response.status, 500);
});
for (const role of ["OWNER", "MANAGER"] as const) test(role + " manual payment admission preserves field validation", async () => {
  const f = fixture("manual-payments", role); assert.equal((await f.run()).status, 400); assert.equal(f.state.bodyReads, 1);
});
