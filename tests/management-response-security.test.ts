import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";
import { NextResponse } from "next/server";

function connect(role: string | null, failure?: string) {
  const source = readFileSync(resolve(__dirname, "../app/api/stripe/connect/route.ts"), "utf8");
  const loadedModule = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  let reads = 0;
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse },
    stripe: class {},
    "@/lib/session": { getSession: async () => role ? { role, propertyId: "p" } : null },
    "@/lib/prisma": { prisma: { property: { findUnique: async () => {
      reads++; throw Object.assign(new Error(failure ?? "isolated DB failure"), { code: "P2010" });
    } } } },
    "@/lib/stripeAccountStatus": { reconcileStripeAccountStatus: async () => { throw Error("Unexpected sync"); } },
  };
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: loadedModule, exports: loadedModule.exports, URL,
    process: { env: { STRIPE_SECRET_KEY: "fixture-only", NEXT_PUBLIC_BASE_URL: "https://isolated.invalid" } },
    console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked dependency " + name); return imports[name];
    },
  });
  return { invoke: () => loadedModule.exports.POST(new Request("https://isolated.invalid/api/stripe/connect", { method: "POST" })), reads: () => reads };
}
test("Connect missing authentication retains 401 without database access", async () => {
  const f = connect(null); assert.equal((await f.invoke()).status, 401); assert.equal(f.reads(), 0);
});
for (const role of ["MANAGER", "STAFF", "TENANT", "MAINTENANCE"]) test("Connect remains OWNER-only: " + role, async () => {
  const f = connect(role); assert.equal((await f.invoke()).status, 403); assert.equal(f.reads(), 0);
});
for (const diagnostic of ["Prisma SQL credentials internal", "PostgreSQL deadlock detected", "Stripe secret customer diagnostic"]) test("Connect hides internal errors: " + diagnostic.split(" ")[0], async () => {
  const f = connect("OWNER", diagnostic); const response = await f.invoke();
  assert.equal(f.reads(), 1); assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Stripe error" });
});
test("dashboard toggle callers retain generic non-success handling", () => {
  const source = readFileSync(resolve(__dirname, "../app/manager/dashboard/ManagerDashboardClient.tsx"), "utf8");
  assert.match(source, /if \(!res\.ok \|\| !json\?\.ok\)/);
  assert.match(source, /alert\(json\?\.error \|\| "Failed to update unit status\."\)/);
});

function tierFailure(message: string, business = false) {
  const loadedModule = { exports: {} as { POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse }, "@prisma/client": { Prisma: {} },
    "@/lib/prisma": { prisma: {} }, "@/lib/billingCalendar": { getLockedMonthlyDueDay: () => null },
    "@/lib/session": { getSession: async () => { throw business ? (loadedModule.exports as typeof loadedModule.exports & { businessError: (message: string) => Error }).businessError(message) : new Error(message); } },
  };
  const source = readFileSync(resolve(__dirname, "../app/api/admin/properties/[id]/tiers/route.ts"), "utf8") + "\nexports.businessError = (message) => new TierBusinessError(message);";
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module: loadedModule, exports: loadedModule.exports, Error, console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked dependency " + name); return imports[name];
    } });
  return loadedModule.exports.POST(new Request("https://isolated.invalid", { method: "POST" }), { params: Promise.resolve({ id: "p" }) });
}
for (const message of ["Prisma SQL internal credential", "PostgreSQL deadlock detected", "Unexpected internal failure"]) test("tier unexpected errors are generic: " + message, async () => {
  const response = await tierFailure(message); assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to save tiers." });
});
for (const message of ["Property not found.", "The property's billing calendar is invalid.", 'Tier "A" has an invalid rent amount.', 'Tier "A" must have a grace period from 0 to 31 days.', 'Tier "A" has invalid late-fee settings.', 'Tier "A" was not found.', 'Tier "A" cannot be lower than 3 active units.', 'Cannot delete tier "A" because units are still assigned.', 'Billing calendar verification failed for tier t.']) test("tier controlled rejection preserved: " + message, async () => {
  const response = await tierFailure(message, true); assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: message });
});

const deniedRoutes: [string, string][] = [
  ["manager/units/vacate", "POST"], ["manager/units/move-tier", "POST"],
  ["manager/units/delete", "POST"], ["manager/property/unit-count", "PATCH"],
  ["manager/maintenance/pin", "POST"], ["manager/maintenance/update", "POST"],
  ["manager/setup-complete", "POST"], ["manager/account/change-login", "POST"],
  ["manager/dashboard", "GET"], ["manager/units/inactive", "GET"],
  ["manager/proration", "POST"], ["manager/audit-log", "GET"],
  ["manager/property/qr", "GET"], ["manager/property/payment-status", "GET"],
  ["manager/property/set-payment-status", "POST"], ["manager/maintenance", "GET"],
  ["manager/onboarding/property", "GET"], ["manager/onboarding/property", "PATCH"],
  ["admin/properties/[id]/gplf", "POST"], ["admin/properties/[id]/management-users", "GET"],
  ["admin/properties/[id]/management-users", "POST"], ["admin/properties/[id]/management-users", "PATCH"],
];
for (const [route, method] of deniedRoutes) for (const role of [null, "TENANT"]) test(`${method} ${route}: ${role ?? "missing session"} is ${role ? 403 : 401}`, async () => {
  const loadedModule = { exports: {} as Record<string, (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>> };
  const session = role ? { role, propertyId: "p", managementUserId: "caller" } : null;
  const dependency = { getSession: async () => session,
    refreshSessionCookie: async () => {},
    isManagementRole: (value: string) => ["OWNER", "MANAGER", "STAFF"].includes(value),
    canManageFinancials: (value: string) => ["OWNER", "MANAGER"].includes(value),
    Prisma: {}, prisma: new Proxy({}, { get() { throw Error("Rejected request accessed database"); } }),
  };
  const source = readFileSync(resolve(__dirname, `../app/api/${route}/route.ts`), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText,
    { module: loadedModule, exports: loadedModule.exports, Error, Date, URL, Set, console: { error() {} },
      process: { env: {} }, require(name: string) {
        if (name === "next/server") return { NextResponse };
        return dependency;
      } });
  const response = await loadedModule.exports[method](new Request("https://isolated.invalid", { method: method === "GET" ? "GET" : "POST", ...(method === "GET" ? {} : { body: "{}" }) }), { params: Promise.resolve({ id: "p" }) });
  assert.equal(response.status, role ? 403 : 401);
});

for (const kind of ["missing", "malformed", "bad-signature", "expired", "revoked", "STAFF"]) test("toggle uses actual session authority: " + kind, async () => {
  let token: string | undefined;
  const secret = "isolated-response-security-secret";
  const user = { id: "m", role: kind === "STAFF" ? "STAFF" : "MANAGER", propertyId: "p", passwordHash: "fixture-credential", isActive: kind !== "revoked" };
  const db = { managementUser: { findUnique: async () => user }, $transaction: async () => { throw Error("Rejected session reached mutation"); } };
  const authorityHolder = { exports: {} as {
    createSessionToken(input: Record<string, unknown>): string;
    createManagementCredentialBinding(id: string, hash: string): string;
  } };
  const imports: Record<string, unknown> = { crypto, "@/lib/prisma": { prisma: db },
    "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) } };
  const transpile = (file: string) => ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  runInNewContext(transpile("lib/session.ts"), { module: authorityHolder, exports: authorityHolder.exports, Error, Buffer, Date,
    process: { env: { SESSION_SECRET: secret } }, console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked dependency " + name); return imports[name];
    } });
  const claims = { role: user.role, propertyId: "p", managementUserId: "m", managementCredentialBinding: authorityHolder.exports.createManagementCredentialBinding("m", user.passwordHash) };
  if (kind !== "missing") token = authorityHolder.exports.createSessionToken(claims);
  if (kind === "malformed") token = "malformed";
  if (kind === "bad-signature") token += "tampered";
  if (kind === "expired") {
    const data = Buffer.from(JSON.stringify({ ...claims, iat: 1, exp: 2 })).toString("base64url");
    token = data + "." + crypto.createHmac("sha256", secret).update(data).digest("base64url");
  }
  const routeHolder = { exports: {} as { POST(request: Request): Promise<Response> } };
  runInNewContext(transpile("app/api/manager/units/toggle-active/route.ts"), { module: routeHolder, exports: routeHolder.exports, Error,
    console: { error() {} }, require(name: string) {
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/session") return authorityHolder.exports;
      if (name === "@/lib/prisma") return { prisma: db };
      if (name === "@prisma/client") return { Prisma: {} };
      throw Error("Unmocked dependency " + name);
    } });
  const response = await routeHolder.exports.POST(new Request("https://isolated.invalid", { method: "POST", body: "{}" }));
  assert.equal(response.status, kind === "STAFF" ? 403 : 401);
});
