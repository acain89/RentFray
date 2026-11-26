import type { LedgerEntry, AuditLog, TenantAssignment, Unit } from "@prisma/client";
import { dateFromArguments, isRecord, callVm, httpFacade } from "./fixture-assertions";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export const root = resolve(__dirname, "..");
type Libraries = {
 "lib/pinLockout.ts": typeof import("../lib/pinLockout");
 "lib/manualFinancialOperations.ts": typeof import("../lib/manualFinancialOperations");
 "lib/rentDates.ts": typeof import("../lib/rentDates");
 "lib/billingCalendar.ts": typeof import("../lib/billingCalendar");
 "lib/checkoutCollectibility.ts": typeof import("../lib/checkoutCollectibility");
};
export function load<File extends keyof Libraries>(file: File, imports: Record<string, unknown>, extra?: Record<string, unknown>, suffix?: string): Libraries[File];
export function load(file: "app/manager/dashboard/components/AdjustBalanceForm.tsx", imports: Record<string, unknown>, extra?: Record<string, unknown>, suffix?: string): { default(props: unknown): unknown };
export function load(file: `app/${string}/page.tsx`, imports: Record<string, unknown>, extra?: Record<string, unknown>, suffix?: string): { default(props: unknown): Promise<unknown>; saveMaintenancePin(form: {get(key: string): unknown}): Promise<void> };
export function load(file: string, imports: Record<string, unknown>, extra?: Record<string, unknown>, suffix?: string): ReturnType<typeof httpFacade>;
export function load(file: string, imports: Record<string, unknown>, extra: Record<string, unknown> = {}, suffix = ""): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8") + suffix, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, Buffer,
    console: { error() {} }, ...extra, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    } });
  const namespace = fixtureModule.exports;
  if(file.startsWith("lib/"))return namespace;
  if(file.endsWith(".tsx"))return {default:(props:unknown)=>callVm(namespace,"default",props),saveMaintenancePin:async(form:unknown)=>{await callVm(namespace,"saveMaintenancePin",form);}};
  return httpFacade(namespace);
}
export function matches(row: unknown, where: unknown = {}): boolean {
  assert.ok(isRecord(where));
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR" || key === "AND") { assert.ok(Array.isArray(value)); const parts: unknown[] = value; return key === "OR" ? parts.some(part => matches(row, part)) : parts.every(part => matches(row, part)); }
    assert.ok(isRecord(row)); const field = row[key];
    if (isRecord(value) && typeof value.getTime !== "function") {
      return Object.entries(value).every(([op, target]) => {
        const [left, right] = typeof field === "string" && typeof target === "string" ? [field, target] : [Number(field), Number(target)];
        if (op === "gt") return field != null && left > right;
        if (op === "lte") return field != null && left <= right;
        return matches(field, { [op]: target });
      });
    }
    return field === value;
  });
}
export function fixture(role: string | null = "MANAGER") {
  const now = new Date("2026-10-14T17:00:00Z");
  class Clock extends Date {
    constructor(...args: unknown[]) { const date = dateFromArguments(args.length ? args : [now]); super(date.getTime()); if (args.length > 1) return date; }
    static now() { return now.getTime(); }
  }
  const property = { id: "p", propertyCode: "1234", isActive: true, name: "Property",
    rentFrayStartDate: new Date("2026-01-15T06:00:00Z"), settings: { rentDueDay: 15, gracePeriodDays: 2, lateFeeEnabled: false } };
  const tier = { id: "t", propertyId: "p", rentDueDay: 15, gracePeriodDays: 2, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 };
  type UnitRow = Pick<Unit, "id" | "propertyId" | "unitNumber" | "tierId" | "isActive" | "portalActivated" | "tenantPinHash" | "portalFirstName" | "portalLastName" | "activatedAt"> & { tier: typeof tier; property: typeof property };
  type LedgerRow = Partial<LedgerEntry> & Pick<LedgerEntry, "id" | "effectiveDate" | "amountCents">;
  type Assignment = Partial<TenantAssignment> & Pick<TenantAssignment, "id" | "propertyId" | "unitId" | "isCurrent" | "moveOutDate" | "firstName" | "lastName">;
  let state: { unit: UnitRow; assignments: Assignment[]; ledger: LedgerRow[]; audits: Partial<AuditLog>[] } = { unit: { id: "u", propertyId: "p", unitNumber: "1", tierId: "t", tier, property,
    isActive: true, portalActivated: true, tenantPinHash: "hash-A", portalFirstName: "A", portalLastName: "Tenant", activatedAt: now },
    assignments: [{ id: "a", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, firstName: "A", lastName: "Tenant" }], ledger: [], audits: [] };
  const events: [string, ...unknown[]][] = [], tokens: Extract<Parameters<typeof import("../lib/session").createSessionToken>[0], { role: "TENANT" }>[] = [], cookies: string[] = [], realtime: [string, Record<string, unknown>][] = [];
  const controls: { validPin: boolean; onVerify: (() => void) | null; onLock: (() => void) | null; onTransaction: (() => void) | null; failAudit: boolean; inTransaction: boolean } = { validPin: true, onVerify: null, onLock: null, onTransaction: null, failAudit: false, inTransaction: false };
  const unitRead = async (args: { where: Record<string, unknown>; include?: { tenantAssignments?: { where: unknown } } }) => {
    events.push(["unit.read", controls.inTransaction]);
    const where = args.where.propertyId_unitNumber ?? args.where;
    if (!matches(state.unit, where)) return null;
    const tenantWhere = args.include?.tenantAssignments?.where ?? {};
    return structuredClone({ ...state.unit, tenantAssignments: state.assignments.filter((a) => matches(a, tenantWhere)) });
  };
  const delegates = {
    property: { findUnique: async ({ where }: { where: Record<string, unknown> }) => { events.push(["property.read", controls.inTransaction]); return matches(state.unit.property, where) ? structuredClone(state.unit.property) : null; } },
    unit: { findUnique: unitRead, findFirst: unitRead, update: async ({ where, data }: { where: unknown; data: Partial<UnitRow> }) => {
      assert.equal(controls.inTransaction, true); assert.ok(matches(state.unit, where)); events.push(["unit.write"]);
      Object.assign(state.unit, data); return structuredClone(state.unit);
    } },
    tenantAssignment: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      events.push(["assignment.read", controls.inTransaction, where.id ?? null]);
      return structuredClone(state.assignments.find((a) => matches(a, where)) ?? null);
    }, update: async ({ where, data }: { where: { id: string }; data: Partial<Assignment> }) => {
      assert.equal(controls.inTransaction, true); events.push(["assignment.write", where.id]);
      const assignment = state.assignments.find((a) => matches(a, where)); assert.ok(assignment);
      Object.assign(assignment, data); return structuredClone(assignment);
    } },
    ledgerEntry: { create: async ({ data }: { data: Omit<LedgerRow, "id"> }) => {
      assert.equal(controls.inTransaction, true); events.push(["ledger.write"]);
      const row = { id: "entry-" + state.ledger.length, createdAt: now, ...data }; state.ledger.push(row); return structuredClone(row);
    } },
    auditLog: { create: async ({ data }: { data: Partial<AuditLog> }) => {
      assert.equal(controls.inTransaction, true); if (controls.failAudit) throw Error("audit failure");
      state.audits.push(data); return structuredClone(data);
    } },
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => { assert.equal(controls.inTransaction, true); events.push(["advisory", values.join(":")]); return 1; },
  };
  type Database = typeof delegates & {
    payment?: { findMany(): Promise<unknown[]> };
    $queryRaw?: (parts: TemplateStringsArray) => Promise<{ id: string }[]>;
    $transaction<Value>(fn: (tx: Database) => Promise<Value>): Promise<Value>;
  };
  const db: Database = { ...delegates, $transaction: async <Value>(fn: (tx: Database) => Promise<Value>): Promise<Value> => {
    controls.onTransaction?.(); controls.onTransaction = null;
    let before = structuredClone(state); controls.inTransaction = true; events.push(["begin"]);
    db.$queryRaw = async (parts: TemplateStringsArray) => {
      const sql = parts.join("?"); events.push(["row", sql]);
      if (controls.onLock) { controls.onLock(); controls.onLock = null; before = structuredClone(state); }
      return [{ id: "locked" }];
    };
    try { const result = await fn(db); events.push(["commit"]); return result; }
    catch (error) { state = before; events.push(["rollback"]); throw error; }
    finally { controls.inTransaction = false; }
  } };
  const lockout: typeof import("../lib/pinLockout") = load("lib/pinLockout.ts", {}, { Date: Clock });
  const helpers = load("lib/manualFinancialOperations.ts", {});
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } },
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: db },
    "@/lib/manualFinancialOperations": helpers,
    "@/lib/permissions": { canManageFinancials: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "@/lib/session": { getSession: async () => role ? { role, propertyId: "p", managementUserId: "m" } : null,
      createSessionToken: (payload: Extract<Parameters<typeof import("../lib/session").createSessionToken>[0], { role: "TENANT" }>) => { events.push(["token"]); tokens.push(payload); return "token"; },
      setSessionCookie: async (token: string) => { assert.equal(controls.inTransaction, false); events.push(["cookie"]); cookies.push(token); } },
    "@/lib/pin": { verifyPin: async (_pin: string, hash: string) => {
      assert.equal(controls.inTransaction, false); assert.equal(hash, "hash-A"); events.push(["verify"]); controls.onVerify?.(); return controls.validPin;
    } }, "@/lib/pinLockout": Object.fromEntries((["checkPinAllowed", "recordFailedAttempt", "clearPinAttempts"] as const).map(name => [name, (key: string) => {
      events.push([name]); return lockout[name](key);
    }])), "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/realtime": { emitEvent: (...args: [string, Record<string, unknown>]) => { assert.equal(controls.inTransaction, false); realtime.push(args); } },
  };
  imports["@/lib/rentDates"] = load("lib/rentDates.ts", {}, { Date: Clock });
  imports["@/lib/billingCalendar"] = load("lib/billingCalendar.ts", imports, { Date: Clock });
  const invoke = (file: string, body: unknown) => load(file, imports, { Date: Clock }).POST({ headers: { get: () => null }, json: async () => body });
  const login = (body: Record<string, unknown> = {}) => invoke("app/api/tenant/session/route.ts", { propertyCode: state.unit.property.propertyCode, unitNumber: "1", pin: "1234", ...body });
  const replace = () => { state.assignments[0].isCurrent = false; state.assignments[0].moveOutDate = new Date(0);
    state.assignments.push({ ...state.assignments[0], id: "b", isCurrent: true, moveOutDate: null }); state.unit.tenantPinHash = "hash-B"; };
  return { state: () => state, controls, db, imports, events, tokens, cookies, realtime, lockout, invoke, login, replace, now };
}
