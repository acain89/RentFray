import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { PaymentStatus } from "@prisma/client";
import type { SessionRole } from "../lib/session";
import type { UnitFinancialState } from "../lib/unitFinancialState";

// No real Prisma, Next server, or external service is loaded by these fixtures.
class Clock extends Date {
  constructor(...args: unknown[]) {
    const value: unknown = args.length ? Reflect.construct(Date, args) : new Date("2026-10-07T18:00:00Z");
    assert.ok(value instanceof Date);
    super(value.getTime());
  }
  static now() { return new Date("2026-10-07T18:00:00Z").getTime(); }
}
type ExportRoute = "balances" | "ledger" | "payments";
type LibraryModules = {
  "lib/session.ts": typeof import("../lib/session");
  "lib/rentDates.ts": typeof import("../lib/rentDates");
  "lib/unitFinancialState.ts": typeof import("../lib/unitFinancialState");
  "lib/ledger.ts": typeof import("../lib/ledger");
  "lib/unitStatusEngine.ts": typeof import("../lib/unitStatusEngine");
  "lib/billingCalendar.ts": typeof import("../lib/billingCalendar");
};
type Modules = LibraryModules & Record<`app/api/exports/${ExportRoute}/route.ts`, { GET(request: { url: string }): Promise<Reply> }>;
function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>): Modules[File] {
  const fixtureModule: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Date: Clock, Intl, URL, Buffer,
    process: { env: { SESSION_SECRET: "synthetic-isolated-export-contract-session-secret-key", NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { assert.ok(name in imports, `Unmocked: ${name}`); return imports[name]; } });
  assert.ok(fixtureModule.exports && typeof fixtureModule.exports === "object");
  // This closed namespace map refers to the actual compiled TypeScript modules.
  // The three route entries use the explicit Reply protocol supplied above.
  return fixtureModule.exports as Modules[File];
}
export class Reply {
  status: number; body: unknown;
  constructor(body: unknown, options: { status?: number; headers?: HeadersInit } = {}) { this.body = body; this.status = options.status ?? 200; }
  static json(body: unknown, options: { status?: number; headers?: HeadersInit } = {}) { return new Reply(body, options); }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object"; }
function matches(row: unknown, where: unknown): boolean {
  if (where === null || where === undefined) return true;
  assert.ok(record(where), "Expected a structured Prisma filter");
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "OR") {
      assert.ok(Array.isArray(value));
      return value.some((part: unknown) => matches(row, part));
    }
    assert.ok(record(row), "Expected a projected database row");
    const field = row[key];
    if (record(value)) {
      if ("contains" in value) {
        assert.equal(typeof value.contains, "string");
        if (typeof value.contains !== "string") throw new Error("Expected a text filter");
        return String(field).toLowerCase().includes(value.contains.toLowerCase());
      }
      if ("lte" in value) {
        assert.ok(value.lte instanceof Date);
        assert.ok(typeof field === "string" || typeof field === "number" || field instanceof Date);
        return new Date(field).getTime() <= value.lte.getTime();
      }
      return matches(field, value);
    }
    return field === value;
  });
}
type ReadArgs = {
  where: { [key: string]: unknown; tenantAssignmentId?: unknown; effectiveDate?: { lte: Date } };
  include?: { payment?: { select: { status: boolean } } };
  select?: unknown;
  orderBy?: unknown;
};
type Query = ReadArgs & { model: "unit" | "units" | "ledger" | "payment" };
export function fixture(role: SessionRole | null = "OWNER") {
  const queries: Query[] = [], cookies = new Map<string, string>();
  const management = { id: "m", propertyId: "p", role, isActive: true, passwordHash: "isolated-hash" };
  const units = ["101", "102"].map((unitNumber, i) => ({ id: `u${i + 1}`, propertyId: "p", isActive: true, unitNumber,
    property: { name: "Property", propertyCode: "1234", settings: { rentDueDay: 1, gracePeriodDays: 2, lateFeeEnabled: false }, rentFrayStartDate: new Date("2026-01-01T06:00:00Z") },
    tier: { id: "t", name: "Tier", baseRentCents: 1000, rentDueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 },
    tenantAssignments: [{ id: `b${i + 1}`, firstName: "Current", lastName: unitNumber, moveInDate: new Date("2026-10-01T05:00:00Z") }] }));
  units.push({ ...units[0], id: "foreign", propertyId: "q", unitNumber: "999" });
  type UnitRow = (typeof units)[number];
  type Attribution = { firstName: string; lastName: string } | null;
  type PaymentRow = {
    id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
    billingCycle: string | null; amountCents: number; processingFeeCents: number;
    status: PaymentStatus; createdAt: Date; unit: UnitRow; tenantAssignment: Attribution;
    memo?: string; referenceNumber?: string;
  };
  type EntryRow = {
    id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null;
    billingCycle: string | null; voidedAt: Date | null; entryType: string;
    amountCents: number; chargeType: string; effectiveDate: Date; createdAt: Date;
    unit: UnitRow; property: UnitRow["property"]; tenantAssignment: Attribution;
    payment: PaymentRow | null; memo?: string; referenceNumber?: string;
  };
  const entries: EntryRow[] = [], payments: PaymentRow[] = [];
  function entry(type: string, amount: number, changes: Partial<EntryRow> = {}) {
    const row = { id: `e${entries.length}`, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", billingCycle: "2026-10", voidedAt: null,
      entryType: type, amountCents: amount, chargeType: "RENT", effectiveDate: new Date("2026-10-01T05:00:00Z"), createdAt: new Date("2026-10-02T18:00:00Z"),
      unit: units[0], property: units[0].property, tenantAssignment: { firstName: "Current", lastName: "101" }, payment: null, ...changes };
    entries.push(row); return row;
  }
  function payment(status: PaymentStatus, changes: Partial<PaymentRow> = {}) {
    const row = { id: `p${payments.length}`, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", billingCycle: "2026-10", amountCents: 1000,
      status, processingFeeCents: 50, createdAt: new Date("2026-10-02T18:00:00Z"), unit: units[0], tenantAssignment: { firstName: "Current", lastName: "101" }, ...changes };
    payments.push(row); entry("PAYMENT", -row.amountCents, { ...changes, payment: row }); return row;
  }
  const db = {
    managementUser: { findUnique: async () => management },
    adminAccess: { findUnique: async () => ({ id: "admin", isActive: true }) },
    maintenanceUser: { findUnique: async () => ({ id: "worker", propertyId: "p", isActive: true }) },
    tenantAssignment: { findUnique: async () => ({ id: "b1", propertyId: "p", unitId: "u1", isCurrent: true, moveOutDate: null }) },
    unit: {
      findFirst: async ({ where }: ReadArgs) => { queries.push({ model: "unit", where }); return units.find(u => matches(u, where)) ?? null; },
      findMany: async ({ where }: ReadArgs) => { queries.push({ model: "units", where }); return units.filter(u => matches(u, where)); },
    },
    ledgerEntry: { findMany: async (args: ReadArgs) => { queries.push({ model: "ledger", ...args }); return entries.filter(e => matches(e, args.where)); } },
    payment: { findMany: async (args: ReadArgs) => { queries.push({ model: "payment", ...args }); return payments.filter(p => matches(p, args.where)); } },
  };
  const session = load("lib/session.ts", { crypto, "@/lib/prisma": { prisma: db }, "next/headers": { cookies: async () => ({ get: (name: string) => cookies.has(name) ? { value: cookies.get(name) } : undefined }) } });
  if (role) cookies.set("rf_session", session.createSessionToken((role === "OWNER" || role === "MANAGER" || role === "STAFF")
    ? { role, propertyId: "p", managementUserId: "m", managementCredentialBinding: session.createManagementCredentialBinding("m", management.passwordHash) }
    : { role, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", adminAccessId: "admin", maintenanceUserId: "worker" }));
  const dates = load("lib/rentDates.ts", {});
  const canonical = load("lib/unitFinancialState.ts", {
    "@/lib/ledger": load("lib/ledger.ts", { "@/lib/prisma": { prisma: db } }), "@/lib/rentDates": dates,
    "@/lib/unitStatusEngine": load("lib/unitStatusEngine.ts", {}),
    "@/lib/billingCalendar": load("lib/billingCalendar.ts", { "@/lib/rentDates": dates, "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} } }),
    "@/lib/billingConfig": { getProcessingFeeCents: () => 50 },
  });
  type FinancialInput = Parameters<typeof canonical.getUnitFinancialState>[0];
  const states: { input: FinancialInput; state: UnitFinancialState }[] = [];
  async function get(route: ExportRoute, query = "") {
    return load(`app/api/exports/${route}/route.ts`, { "next/server": { NextResponse: Reply }, "@/lib/prisma": { prisma: db }, "@/lib/session": session,
      "@/lib/billingConfig": { formatCentsToDollars: (c: number) => (c / 100).toFixed(2) },
      "@/lib/unitFinancialState": { getUnitFinancialState: async (input: FinancialInput) => { const state = await canonical.getUnitFinancialState(input); states.push({ input, state }); return state; } },
    }).GET({ url: `https://isolated.invalid/api/exports/${route}?${query}` });
  }
  return { get, units, entries, payments, entry, payment, queries, states, management };
}
