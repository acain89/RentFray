import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export function source(file: string, imports: Record<string, any>, append = "", extras: any = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, URL, Buffer,
    process: { env: { NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; }, ...extras });
  return module.exports;
}
export const response = { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } };
export const context = { params: Promise.resolve({ id: "p" }) };
export const request = (body: any) => ({ json: async () => body });

const cases = [
  ["password", "app/api/admin/properties/[id]/management-users/reset-password/route.ts", "MANAGEMENT_USER_PASSWORD_RESET"],
  ["pin-create", "app/api/manager/maintenance/pin/route.ts", "MAINTENANCE_PIN_SET"],
  ["pin-update", "app/api/manager/maintenance/pin/route.ts", "MAINTENANCE_PIN_SET"],
  ["status", "app/api/manager/maintenance/update/route.ts", "MAINTENANCE_REQUEST_UPDATED"],
  ["worker", "app/manager/properties/[id]/pin-reset/page.tsx", "MAINTENANCE_USER_CREATED_WITH_PIN"],
  ["live", "app/api/admin/properties/[id]/override/route.ts", "PROPERTY_FORCE_LIVE"],
  ["repair", "app/api/admin/properties/[id]/override/route.ts", "PAYMENT_STATUS_REPAIRED"],
  ["sync", "app/api/admin/properties/[id]/stripe-sync/route.ts", "STRIPE_STATUS_SYNCED"],
] as const;

function fixture(kind: string, file: string) {
  let state: any = { property: { id: "p", name: "Property", propertyCode: "CODE", status: "SETUP", stripeAccountId: "acct" },
    user: { id: "user", propertyId: "p", role: "MANAGER", email: "user@example.invalid", isActive: true, passwordHash: "old", mustResetPassword: true },
    worker: kind === "pin-update" ? { id: "worker", propertyId: "p", pinHash: "old" } : null,
    maintenance: { id: "request", propertyId: "p", status: "OPEN", unit: { unitNumber: "101" }, completedAt: null },
    connection: null, audits: [] };
  let fail: "audit" | "business" | null = null, inTransaction = false, transactions = 0, stripeCalls = 0;
  const write = (fn: () => any) => { if (fail === "business") throw Error("business failure"); return fn(); };
  const db: any = {
    property: { findUnique: async () => ({ ...state.property }), update: async ({ data }: any) => write(() => Object.assign(state.property, data)) },
    managementUser: { findFirst: async () => ({ ...state.user }), update: async ({ data }: any) => write(() => Object.assign(state.user, data)) },
    maintenanceUser: { findFirst: async () => state.worker, update: async ({ data }: any) => write(() => Object.assign(state.worker, data)),
      create: async ({ data }: any) => write(() => state.worker = { id: "worker", ...data }) },
    maintenanceRequest: { findFirst: async () => ({ ...state.maintenance }), update: async ({ data }: any) => write(() => Object.assign(state.maintenance, data)) },
    paymentConnectionStatus: { upsert: async ({ update, create }: any) => write(() => state.connection
      ? Object.assign(state.connection, update) : state.connection = { id: "connection", ...create }) },
    auditLog: { create: async ({ data }: any) => { if (fail === "audit") throw Error("audit failure"); state.audits.push(data); return data; } },
    $transaction: async (fn: any) => { const before = structuredClone(state); transactions++; inTransaction = true;
      try { return await fn(db); } catch (error) { state = before; throw error; } finally { inTransaction = false; } },
  };
  const role = ["password", "live", "repair", "sync"].includes(kind) ? "ADMIN" : "OWNER";
  const imports = { "next/server": response, "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} },
    "@/lib/session": { getSession: async () => ({ role, propertyId: "p", managementUserId: "caller", adminAccessId: "admin" }) },
    "bcryptjs": { hash: async () => { assert.equal(inTransaction, false); return "new-hash"; } },
    "@/lib/pin": { hashPin: async () => "new-hash", isValidFourDigitPin: (pin: string) => /^\d{4}$/.test(pin) },
    "@/lib/permissions": { canManageMaintenancePins: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } },
    "react/jsx-runtime": {},
    "@/lib/stripe": { getStripeClient: () => ({ accounts: { retrieve: async () => { assert.equal(inTransaction, false); stripeCalls++;
      return { id: "acct", charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {} }; } } }) },
  };
  Object.assign(imports, {
    "@/lib/checkoutCollectibility": {
      CheckoutConflict: class extends Error {},
      inspectTenantCheckoutAttempts: async (_db: any, identity: any) => ({ identity, state: "NO_ATTEMPT", evidence: [] }),
      assertCheckoutReductionAllowed: async () => {}, lockCheckout: async () => {},
    },
    "@/lib/manualFinancialOperations": { lockManualRows: async () => {}, isManualLockContention: () => false },
  });
  const api = source(file, imports, kind === "worker" ? "\nexport { saveMaintenancePin };" : "");
  async function call() {
    if (kind === "worker") { const form = new FormData(); for (const [key, value] of Object.entries({ propertyId: "p", workerName: "Worker", pin: "1234" })) form.set(key, value);
      try { await api.saveMaintenancePin(form); } catch (error) { if (String(error).includes("maintenanceSuccess=1")) return { status: 200 }; throw error; } }
    return api.POST(request({ userId: "user", temporaryPassword: "password123", pin: "1234", requestId: "request", status: "COMPLETE",
      action: kind === "live" ? "FORCE_LIVE" : kind === "repair" ? "REPAIR_PAYMENT_STATUS" : undefined }), context);
  }
  return { call, state: () => state, fail: (value: typeof fail) => { fail = value; }, transactions: () => transactions, stripeCalls: () => stripeCalls };
}
for (const [kind, file, action] of cases) {
  for (const failure of ["audit", "business"] as const) test(kind + ": " + failure + " failure rolls back; retry succeeds once", async () => {
    const f = fixture(kind, file); const before = structuredClone(f.state()); f.fail(failure);
    if (kind === "worker") await assert.rejects(f.call, /failure/); else assert.equal((await f.call()).status, 500);
    assert.deepEqual(f.state(), before); assert.equal(f.transactions(), 1);
    f.fail(null); assert.equal((await f.call()).status, 200); assert.equal(f.state().audits.length, 1);
    assert.equal(f.state().audits[0].action, action);
  });
  test(kind + ": success preserves business result and writes required audit", async () => {
    const f = fixture(kind, file); const result = await f.call(); assert.equal(result.status, 200);
    assert.equal(f.transactions(), 1); assert.equal(f.state().audits.length, 1); assert.equal(f.state().audits[0].action, action);
    if (kind === "password") { assert.equal(f.state().user.passwordHash, "new-hash"); assert.equal(result.body.user.mustResetPassword, false); }
    if (kind.startsWith("pin") || kind === "worker") assert.equal(f.state().worker.pinHash, "new-hash");
    if (kind === "status") { assert.equal(result.body.request.status, "COMPLETE"); assert.ok(f.state().maintenance.completedAt); }
    if (kind === "live") assert.equal(result.body.property.status, "LIVE");
    if (kind === "repair") assert.equal(result.body.paymentStatus.processorConnected, false);
    if (kind === "sync") { assert.equal(result.body.paymentStatus.chargesEnabled, true); assert.equal(f.stripeCalls(), 1); }
  });
}
test("repair preserves an established connection row", async () => {
  const f = fixture("repair", cases[6][1]); const connection = { id: "existing", processorConnected: true, payoutsEnabled: true, lastSyncedAt: "original" };
  f.state().connection = { ...connection }; await f.call(); assert.deepEqual(f.state().connection, connection);
});
