import { requiredValue, callVm, httpFacade } from "./fixture-assertions";
import type { Property, ManagementUser, MaintenanceUser, MaintenanceRequest, PaymentConnectionStatus, AuditLog } from "@prisma/client";
import { accountHelper } from "./stripe-account-reconciliation.fixture";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export const root = resolve(__dirname, "..");
export function source(file: string, imports: Record<string, unknown>, append = "", extras: Record<string, unknown> = {}) {
  const fixtureModule: {exports:unknown} = {exports:{}};
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, URL, Buffer,
    process: { env: { NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; }, ...extras });
  return { ...httpFacade(fixtureModule.exports), saveMaintenancePin: async (form: FormData) => { await callVm(fixtureModule.exports,"saveMaintenancePin",form); } };
}
export const response = { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } };
export const context = { params: Promise.resolve({ id: "p" }) };
export const request = (body: unknown) => ({ json: async () => body });

export const cases = [
  ["password", "app/api/admin/properties/[id]/management-users/reset-password/route.ts", "MANAGEMENT_USER_PASSWORD_RESET"],
  ["pin-create", "app/api/manager/maintenance/pin/route.ts", "MAINTENANCE_PIN_SET"],
  ["pin-update", "app/api/manager/maintenance/pin/route.ts", "MAINTENANCE_PIN_SET"],
  ["status", "app/api/manager/maintenance/update/route.ts", "MAINTENANCE_REQUEST_UPDATED"],
  ["worker", "app/manager/properties/[id]/pin-reset/page.tsx", "MAINTENANCE_USER_CREATED_WITH_PIN"],
  ["live", "app/api/admin/properties/[id]/override/route.ts", "PROPERTY_FORCE_LIVE"],
  ["repair", "app/api/admin/properties/[id]/override/route.ts", "PAYMENT_STATUS_REPAIRED"],
  ["sync", "app/api/admin/properties/[id]/stripe-sync/route.ts", "STRIPE_STATUS_SYNCED"],
] as const;

export function fixture(kind: string, file: string) {
  type Worker = Partial<MaintenanceUser> & Pick<MaintenanceUser,"id"|"propertyId"|"pinHash">;
  type Connection = Partial<Omit<PaymentConnectionStatus,"lastSyncedAt">> & {lastSyncedAt?:Date|string};
  type State = { property: Pick<Property,"id"|"name"|"propertyCode"|"status"|"stripeAccountId">; user: Pick<ManagementUser,"id"|"propertyId"|"role"|"email"|"isActive"|"passwordHash"|"mustResetPassword">; worker: Worker|null; maintenance: Pick<MaintenanceRequest,"id"|"propertyId"|"status"|"completedAt"> & {unit:{unitNumber:string}}; connection: Connection|null; audits:Partial<AuditLog>[] };
  let state: State = { property: { id: "p", name: "Property", propertyCode: "CODE", status: "SETUP", stripeAccountId: "acct" },
    user: { id: "user", propertyId: "p", role: "MANAGER", email: "user@example.invalid", isActive: true, passwordHash: "old", mustResetPassword: true },
    worker: kind === "pin-update" ? { id: "worker", propertyId: "p", pinHash: "old" } : null,
    maintenance: { id: "request", propertyId: "p", status: "OPEN", unit: { unitNumber: "101" }, completedAt: null },
    connection: null, audits: [] };
  let fail: "audit" | "business" | null = null, inTransaction = false, transactions = 0, stripeCalls = 0;
  const write = <Value>(fn: () => Value) => { if (fail === "business") throw Error("business failure"); return fn(); };
  const delegates = {
    property: { findUnique: async () => ({ ...state.property }), update: async ({ data }: {data:Partial<State["property"]>}) => write(() => Object.assign(state.property, data)) },
    managementUser: { findFirst: async () => ({ ...state.user }), update: async ({ data }: {data:Partial<State["user"]>}) => write(() => Object.assign(state.user, data)) },
    maintenanceUser: { findFirst: async () => state.worker, update: async ({ data }: {data:Partial<Worker>}) => write(() => Object.assign(requiredValue(state.worker), data)),
      create: async ({ data }: {data:Omit<Worker,"id">}) => write(() => state.worker = { id: "worker", ...data }) },
    maintenanceRequest: { findFirst: async () => ({ ...state.maintenance }), update: async ({ data }: {data:Partial<State["maintenance"]>}) => write(() => Object.assign(state.maintenance, data)) },
    paymentConnectionStatus: { upsert: async ({ update, create }: {update:Connection;create:Connection}) => write(() => state.connection
      ? Object.assign(state.connection, update) : state.connection = { id: "connection", ...create }) },
    auditLog: { create: async ({ data }: {data:Partial<AuditLog>}) => { if (fail === "audit") throw Error("audit failure"); state.audits.push(data); return data; } },
  };
  type Client = typeof delegates & {$queryRaw?:(sql:TemplateStringsArray)=>Promise<unknown[]>;$transaction<Value>(fn:(tx:Client)=>Promise<Value>):Promise<Value>};
  const db:Client = {...delegates, $transaction: async <Value>(fn:(tx:Client)=>Promise<Value>):Promise<Value> => { const before = structuredClone(state); transactions++; inTransaction = true;
      try { return await fn(db); } catch (error) { state = before; throw error; } finally { inTransaction = false; } },
  };
  const role = ["password", "live", "repair", "sync"].includes(kind) ? "ADMIN" : "OWNER";
  const imports = { "next/server": response, "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} },
    "@/lib/session": { getSession: async () => ({ role, propertyId: "p", managementUserId: "caller", adminAccessId: "admin" }) },
    "bcryptjs": { hash: async () => { assert.equal(inTransaction, false); return "new-hash"; } },
    "@/lib/pin": { hashPin: async () => "new-hash", isValidFourDigitPin: (pin: string) => /^\d{4}$/.test(pin) },
    "@/lib/permissions": { canManageMaintenancePins: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "next/link": () => null,
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } },
    "react/jsx-runtime": {},
    "@/lib/stripe": { getStripeClient: () => ({ accounts: { retrieve: async () => { assert.equal(inTransaction, false); stripeCalls++;
      return { id: "acct", charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {} }; } } }) },
  };
  Object.assign(imports, {
    "@/lib/checkoutCollectibility": {
      CheckoutConflict: class extends Error {},
      inspectTenantCheckoutAttempts: async (_db: unknown, identity: import("../lib/checkoutCollectibility").CheckoutIdentity) => ({ identity, state: "NO_ATTEMPT", evidence: [] }),
      assertCheckoutReductionAllowed: async () => {}, lockCheckout: async () => {},
    },
    "@/lib/manualFinancialOperations": { lockManualRows: async () => {}, isManualLockContention: () => false },
  });
  if (kind === "sync") {
    db.$queryRaw = async (sql: TemplateStringsArray) => sql.join("").includes("FOR UPDATE") ? [] : [{ stripeAccountId: state.property.stripeAccountId, propertyVersion: "1", statusVersion: state.connection ? "written" : null }];
    Object.assign(imports, { "@/lib/stripeAccountStatus": accountHelper(db, imports["@/lib/stripe"].getStripeClient()) });
  }
  const api = source(file, imports, kind === "worker" ? "\nexport { saveMaintenancePin };" : "");
  async function call() {
    if (kind === "worker") { const form = new FormData(); for (const [key, value] of Object.entries({ propertyId: "p", workerName: "Worker", pin: "1234" })) form.set(key, value);
      try { await api.saveMaintenancePin(form); } catch (error) { if (String(error).includes("maintenanceSuccess=1")) return { status: 200, body: undefined }; throw error; } }
    return api.POST(request({ userId: "user", temporaryPassword: "password123", pin: "1234", requestId: "request", status: "COMPLETE",
      action: kind === "live" ? "FORCE_LIVE" : kind === "repair" ? "REPAIR_PAYMENT_STATUS" : undefined }), context);
  }
  return { call, state: () => state, fail: (value: typeof fail) => { fail = value; }, transactions: () => transactions, stripeCalls: () => stripeCalls };
}
