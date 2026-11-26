import * as gracePolicy from "../lib/gracePeriod";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import type { Unit, Property, PropertySettings, PaymentConnectionStatus, ManagementUser, MaintenanceUser, PropertyTierCharge } from "@prisma/client";
import { isRecord } from "./fixture-assertions";
export type HistoryRow = { id: string; unitId?: string; propertyId?: string | null; metadataJson?: string; targetId?: string; action?: string; status?: string; isCurrent?: boolean; moveInDate?: Date; moveOutDate?: Date | null; amountCents?: number; voidedAt?: Date; stripeSessionId?: string; stripePaymentIntentId?: string };
export type UnitRow = Pick<Unit, "id" | "propertyId" | "tierId" | "isActive" | "portalActivated" | "portalFirstName" | "portalLastName" | "tenantPinHash" | "activatedAt" | "activationSource">;
export type PropertyRow = Pick<Property, "id" | "status" | "stripeAccountId" | "rentFrayStartDate" | "setupCompleteAcknowledgedAt"> & {
 units: UnitRow[]; settings: Pick<PropertySettings, "onboardingComplete" | "setupComplete">;
 managementUsers: Pick<ManagementUser, "lastLoginAt" | "emailVerifiedAt">[]; maintenanceUsers: Pick<MaintenanceUser, "lastLoginAt">[];
 paymentStatus: Pick<PaymentConnectionStatus, "processorConnected" | "bankConnected" | "chargesEnabled" | "payoutsEnabled" | "onboardingComplete" | "requirementsDue" | "requirementsSummary" | "lastSyncedAt" | "readyForLive">;
 tiers?: { id: string; charges: Pick<PropertyTierCharge, "amountCents">[] }[];
};
type ReadArgs = { where: unknown; select?: { tenantAssignments?: { where: Record<string, unknown> } } };
type HistoryDelegate = { findFirst(args: ReadArgs): Promise<HistoryRow | null>; deleteMany(): Promise<void> };
type Client = Record<HistoryModel, HistoryDelegate> & {
 $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
 $transaction<Result>(work: (tx: Client) => Promise<Result>, options: { isolationLevel: string }): Promise<Result>;
 unit: { findFirst(args: ReadArgs): Promise<(UnitRow & { tenantAssignments: HistoryRow[] }) | null>; count(): Promise<number>; delete(args: { where: { id: string } }): Promise<UnitRow> };
 property: { findUnique(args: { where: { id: string } }): Promise<PropertyRow | null>; delete(args: { where: { id: string } }): Promise<PropertyRow> };
 propertyTier: { update(args: { data: { activeUnitCount: number } }): Promise<void> };
};


export const root = resolve(__dirname, "..");
type RetentionBody = { ok?: boolean; error?: string; action?: string; property?: { status?: string }; data?: { unitId?: string } };
type Reply = { status: number; body: RetentionBody };
type Request = { json?(): Promise<unknown> };
type Context = { params: Promise<{ id: string }> };
type Session = Omit<typeof import("../lib/session"), "createSessionToken"> & { createSessionToken(input: Record<string, unknown>): string };
type Modules = {
 "lib/session.ts": Session;
 "lib/destructiveRetention.ts": typeof import("../lib/destructiveRetention");
 "lib/manualFinancialOperations.ts": typeof import("../lib/manualFinancialOperations");
 "lib/checkoutCollectibility.ts": typeof import("../lib/checkoutCollectibility");
 "app/api/manager/units/delete/route.ts": { POST(request: Request): Promise<Reply> };
 "app/api/admin/properties/[id]/units/route.ts": { DELETE(request: Request, context: Context): Promise<Reply> };
 "app/api/admin/properties/[id]/route.ts": { DELETE(request: Request, context: Context): Promise<Reply> };
 "app/api/admin/properties/[id]/override/route.ts": { POST(request: Request, context: Context): Promise<Reply> };
};
export function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>, extras?: Record<string, unknown>): Modules[File];
export function load(file: keyof Modules, imports: Record<string, unknown>, extras: Record<string, unknown> = {}): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "synthetic-isolated-retention-session-secret-key" } },
    console: { error() {} }, require(name: string) {
      if (name === "@/lib/gracePeriod") return gracePolicy;
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    }, ...extras });
  const namespace = fixtureModule.exports; assert.ok(isRecord(namespace));
  if (file.startsWith("app/api/")) {
    const method = file.endsWith("/override/route.ts") || file.includes("/manager/") ? "POST" : "DELETE";
    const handler = namespace[method]; assert.ok(typeof handler === "function");
    return { [method]: async (...args: unknown[]) => {
      const raw: unknown = await Reflect.apply(handler, namespace, args); assert.ok(isRecord(raw));
      assert.ok(typeof raw.status === "number"); const body = raw.body; assert.ok(isRecord(body));
      assert.ok(body.ok === undefined || typeof body.ok === "boolean");
      assert.ok(body.error === undefined || typeof body.error === "string");
      assert.ok(body.action === undefined || typeof body.action === "string");
      if (body.property !== undefined) { assert.ok(isRecord(body.property)); assert.ok(body.property.status === undefined || typeof body.property.status === "string"); }
      if (body.data !== undefined) { assert.ok(isRecord(body.data)); assert.ok(body.data.unitId === undefined || typeof body.data.unitId === "string"); }
      return { status: raw.status, body };
    } };
  }
  return namespace;
}
export const historyModels = ["tenantAssignment", "ledgerEntry", "payment", "maintenanceRequest", "unitNote", "unitRecurringFee", "auditLog"] as const;
export type HistoryModel = (typeof historyModels)[number];
export function fixture(role = "ADMIN") {
  const events: string[] = []; let writes = 0, inTransaction = false;
  const unit: UnitRow = { id: "unit", propertyId: "a", tierId: "tier", isActive: false,
    portalActivated: false, portalFirstName: null, portalLastName: null, tenantPinHash: null,
    activatedAt: null, activationSource: null };
  const property: PropertyRow = { id: "a", status: "SETUP", stripeAccountId: null, rentFrayStartDate: null,
    setupCompleteAcknowledgedAt: null, units: [unit], settings: { onboardingComplete: false, setupComplete: false },
    managementUsers: [{ lastLoginAt: null, emailVerifiedAt: null }], maintenanceUsers: [{ lastLoginAt: null }],
    paymentStatus: { processorConnected: false, bankConnected: false, chargesEnabled: false, payoutsEnabled: false,
      onboardingComplete: false, requirementsDue: false, requirementsSummary: null, lastSyncedAt: null, readyForLive: false } };
  const records: Record<HistoryModel, HistoryRow[]> = { tenantAssignment: [], ledgerEntry: [], payment: [], maintenanceRequest: [], unitNote: [], unitRecurringFee: [], auditLog: [] };
  function matches(row: unknown, where: unknown): boolean {
    if (where === undefined || where === null) return true;
    assert.ok(isRecord(where));
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") { assert.ok(Array.isArray(value)); return value.some((part: unknown) => matches(row, part)); }
      assert.ok(isRecord(row)); const field = row[key];
      if (isRecord(value) && "contains" in value) { assert.ok(typeof value.contains === "string"); return typeof field === "string" && field.includes(value.contains); }
      return field === value;
    });
  }
  function read(name: string) { assert.equal(inTransaction, true); assert.ok(events[0]?.includes('FROM "Property"')); events.push(name); }
  const write = (name: string) => { assert.equal(inTransaction, true); events.push(name); writes++; };
  function history(name: HistoryModel): HistoryDelegate { return {
    findFirst: async ({ where }) => { read(name + ".read"); return records[name].find(row => matches(row, where)) ?? null; },
    deleteMany: async () => { write(name + ".deleteMany"); },
  }; }
  const prisma: Client = {
    tenantAssignment: history("tenantAssignment"), ledgerEntry: history("ledgerEntry"), payment: history("payment"), maintenanceRequest: history("maintenanceRequest"), unitNote: history("unitNote"), unitRecurringFee: history("unitRecurringFee"), auditLog: history("auditLog"),
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      assert.equal(inTransaction, true); const sql = strings.join("?"); assert.ok(sql.includes("FOR UPDATE"));
      assert.ok(!sql.includes("a'")); events.push(sql); assert.ok(values.every(v => typeof v === "string")); return [];
    },
    $transaction: async <Result>(fn: (tx: Client) => Promise<Result>, options: { isolationLevel: string }): Promise<Result> => { assert.equal(options.isolationLevel, "ReadCommitted"); events.push("transaction"); inTransaction = true;
      // Reads assert the first SQL lock, rather than an earlier out-of-transaction read.
      events.shift(); try { return await fn(prisma); } finally { inTransaction = false; } },
    unit: {
      findFirst: async ({ where, select }: ReadArgs) => { read("unit.read");
        if (!matches(unit, where)) return null;
        const assignmentWhere = select?.tenantAssignments?.where;
        return { ...unit, tenantAssignments: assignmentWhere
          ? records.tenantAssignment.filter(row => matches(row, { unitId: unit.id, ...assignmentWhere })) : [] }; },
      count: async () => { read("unit.count"); return 0; },
      delete: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, unit.id); write("unit.delete"); return unit; },
    },
    property: {
      findUnique: async ({ where }: { where: { id: string } }) => { read("property.read"); return where.id === property.id ? property : null; },
      delete: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, property.id); write("property.delete"); return property; },
    },
    propertyTier: { update: async ({ data }: { data: { activeUnitCount: number } }) => { assert.equal(data.activeUnitCount, 0); write("tier.update"); } },
  };
  let token: string | undefined;
  const session = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma: { adminAccess: { findUnique: async ({ where }: { where: { id: string } }) => where.id === "admin" ? { id: "admin", isActive: true } : null }, managementUser: { findUnique: async () => ({ id: "user", propertyId: "a", role, isActive: true, passwordHash: "synthetic-credential" }) } } } });
  if (role === "invalid") token = "malformed";
  else if (role !== "absent") token = session.createSessionToken(role === "ADMIN" ? { role, adminAccessId: "admin" } : { role, propertyId: "a", managementUserId: "user", managementCredentialBinding: session.createManagementCredentialBinding("user", "synthetic-credential") });
  const retention = load("lib/destructiveRetention.ts", {});
  const imports = { "@/lib/prisma": { prisma }, "@/lib/session": session,
    "@/lib/destructiveRetention": retention, "@prisma/client": { Prisma: {} },
    "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number; headers?: HeadersInit }) => ({ body, status: options?.status ?? 200 }) } } };
  const manager = load("app/api/manager/units/delete/route.ts", imports);
  const admin = load("app/api/admin/properties/[id]/units/route.ts", imports);
  const propertyApi = load("app/api/admin/properties/[id]/route.ts", { ...imports,
    "@/lib/billingCalendar": { BillingCalendarError: class extends Error {} } });
  return { unit, property, records, events, retention, prisma, manager, admin, propertyApi, writes: () => writes,
    callUnit: (kind: "manager" | "admin", unitId = "unit", propertyId = "a") => kind === "manager"
      ? manager.POST({ json: async () => ({ unitId }) })
      : admin.DELETE({ json: async () => ({ unitId }) }, { params: Promise.resolve({ id: propertyId }) }),
    callProperty: (id = "a") => propertyApi.DELETE({}, { params: Promise.resolve({ id }) }) };
}
