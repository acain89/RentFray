import { callVm, httpFacade, requiredRecord } from "./fixture-assertions";
import * as gracePolicy from "../lib/gracePeriod";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";


export const root = resolve(__dirname, "..");
type PageExports = { default(props?: unknown): Promise<unknown>; action(form: { get(key: string): unknown }): Promise<unknown>; saveSettings(form: { get(key: string): unknown; has(key: string): boolean }): Promise<unknown> };
type Http = ReturnType<typeof httpFacade>;
export function load(file: "app/api/auth/verify-email/route.ts", imports: Record<string, unknown>, append?: string): { GET(request: { url: string }): Promise<{ status: number; url: string }> };
export function load(file: "lib/propertySettings.ts", imports: Record<string, unknown>, append?: string): typeof import("../lib/propertySettings");
export function load(file: "app/manager/dashboard/components/ManagerPanel.tsx", imports: Record<string, unknown>, append?: string): { default(props: unknown): unknown };
export function load(file: `app/${string}/page.tsx`, imports: Record<string, unknown>, append?: string): PageExports;
export function load(file: string, imports: Record<string, unknown>, append?: string): Http & PageExports & Pick<typeof import("../lib/propertySettings"), "upsertPropertySettings">;
export function load(file: string, imports: Record<string, unknown>, append = ""): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Date, URL, Buffer,
    process: { env: { NEXT_PUBLIC_BASE_URL: "https://isolated.invalid", NODE_ENV: "test" } },
    console: { error() {} },
    require(name: string) { if (name === "@/lib/gracePeriod") return gracePolicy; if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; },
  });
  const namespace = fixtureModule.exports;
  if (file === "app/api/auth/verify-email/route.ts") return { GET: async (request: unknown) => {
    const raw = requiredRecord(await callVm(namespace, "GET", request)); assert.ok(typeof raw.status === "number"); assert.ok(typeof raw.url === "string"); return Object.assign(raw, { status: raw.status, url: raw.url });
  } };
  if (file.startsWith("app/api/")) return httpFacade(namespace);
  // The library export type is tied to this exact compiled source module.
  if (file === "lib/propertySettings.ts") return namespace;
  return { default: (...args: unknown[]) => callVm(namespace, "default", ...args), action: (...args: unknown[]) => callVm(namespace, "action", ...args), saveSettings: (...args: unknown[]) => callVm(namespace, "saveSettings", ...args) };

}
export const request = (body: unknown = {}) => ({ json: async () => body, headers: { get: () => null } });
export const context = (id = "p") => ({ params: Promise.resolve({ id }) });
export function fixture(role: string | null = "OWNER") {
  const calls: [string, unknown][] = [];
  const session = role ? { role, propertyId: "p", managementUserId: "caller" } : null;
  type Args = { where?: unknown; data?: unknown; update?: unknown; create?: unknown; select?: unknown; orderBy?: unknown };
  interface Delegate {
    findMany(args?: Args): Promise<unknown[]>; findFirst(args?: Args): Promise<unknown>; findUnique(args?: Args): Promise<unknown>;
    create(args?: Args): Promise<unknown>; update(args?: Args): Promise<unknown>; updateMany(args?: Args): Promise<{ count: number }>;
    upsert(args?: Args): Promise<unknown>; delete(args?: Args): Promise<unknown>; count(args?: Args): Promise<number>; aggregate(args?: Args): Promise<{ _sum: { unitCount: number } }>;
  }
  const models = ["property", "propertySettings", "unit", "propertyTier", "propertyTierCharge", "managementUser", "maintenanceRequest", "auditLog", "tenantAssignment", "paymentConnectionStatus", "emailVerificationToken"] as const;
  type Client = { [Model in typeof models[number]]: Partial<Delegate> } & {
    maintenanceUser?: Partial<Delegate>;
    $queryRaw(sql: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>; $executeRaw(sql: TemplateStringsArray, ...values: unknown[]): Promise<number>;
    $transaction<Value>(work: (tx: Client) => Promise<Value>): Promise<Value>;
  };
  function transaction<Value>(work: (tx: Client) => Promise<Value>): Promise<Value>;
  async function transaction(work: unknown): Promise<unknown> {
    if (typeof work === "function") return Reflect.apply(work, undefined, [db]);
    assert.ok(Array.isArray(work)); const values: unknown[] = work; return Promise.all(values);
  }
  const db: Client = { property: {}, propertySettings: {}, unit: {}, propertyTier: {}, propertyTierCharge: {}, managementUser: {}, maintenanceRequest: {}, auditLog: {}, tenantAssignment: {}, paymentConnectionStatus: {}, emailVerificationToken: {}, $queryRaw: async () => [], $executeRaw: async () => 0, $transaction: transaction };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }),
      redirect: (url: URL | string) => ({ url: String(url), status: 307 }) } },
    "@/lib/session": { getSession: async () => session, refreshSessionCookie: async () => {},
      createManagementCredentialBinding: (id: string, hash: string) => {
        assert.ok(id && hash); return crypto.createHmac("sha256", "fixture-only").update(JSON.stringify([id, hash])).digest("hex");
      },
      requireManagerLevelSession: async () => { if (!session || !["OWNER", "MANAGER"].includes(session.role)) throw Error("Forbidden"); return session; },
      requireManagementSession: async () => { if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) throw Error("Forbidden"); return session; },
      createSessionToken: (input: unknown) => { calls.push(["session", input]); return "isolated-cookie"; },
      setSessionCookie: async () => {}, clearSessionCookie: async () => {} },
    "@/lib/permissions": { isManagementRole: (r: string) => ["OWNER", "MANAGER", "STAFF"].includes(r),
      canManageFinancials: (r: string) => ["OWNER", "MANAGER"].includes(r), canManageMaintenancePins: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "@/lib/prisma": { prisma: db },
    "@/lib/rentDates": {
      getBusinessDate: () => new Date(2026, 9, 20),
      getBusinessDateInstant: (value: string) => new Date(value + "T05:00:00Z"),
    },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {}, TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "bcryptjs": { hash: async () => "bcrypt-isolated", compare: async () => true },
    "@/lib/email": { sendVerificationEmail: async (input: unknown) => { calls.push(["email", input]); },
      hashEmailVerificationToken: () => "hashed-token", sendWelcomeEmail: async () => {} },
    "@/lib/managementAuth": { verifyManagementPassword: async () => true },
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } },
    "react/jsx-runtime": { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }), jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }) },
    "@/lib/pin": { hashPin: async () => "pin-isolated", isValidFourDigitPin: () => true },
    "@/lib/billingCalendar": { lockBillingCalendar: async () => { throw Error("Unexpected calendar write"); }, BillingCalendarError: class extends Error {} },
    "@/lib/destructiveRetention": { assertPristineProperty: async () => { throw Error("Unexpected deletion"); }, lockRetentionProperty: async () => {}, DestructiveRetentionError: class extends Error {} },
  };
  for (const model of models) {
    const record = (args?: Args) => ({ id: "p", propertyCode: "1234", settings: {}, tiers: [], ...(args?.data === undefined ? {} : requiredRecord(args.data)) });
    db[model] = {
      findMany: async args => { calls.push([model + ".findMany", args]); return []; },
      findFirst: async args => { calls.push([model + ".findFirst", args]); return null; },
      findUnique: async args => { calls.push([model + ".findUnique", args]); return record(args); },
      create: async args => { calls.push([model + ".create", args]); return record(args); },
      update: async args => { calls.push([model + ".update", args]); return record(args); },
      updateMany: async args => { calls.push([model + ".updateMany", args]); return { count: 1 }; },
      upsert: async args => { calls.push([model + ".upsert", args]); return record(args); },
      delete: async args => { calls.push([model + ".delete", args]); return record(args); },
      count: async args => { calls.push([model + ".count", args]); return 0; },
      aggregate: async args => { calls.push([model + ".aggregate", args]); return { _sum: { unitCount: 2 } }; },
    };
  }
  return { imports, db, calls, session };
}

export const reads = ["manager/property/qr", "manager/units/inactive", "admin/properties/[id]/charges",
  "admin/properties/[id]/management-users", "admin/properties/[id]", "manager/onboarding/property", "manager/property/payment-status"];
