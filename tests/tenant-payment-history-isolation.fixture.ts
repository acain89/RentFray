import { isRecord, checkedHttpNamespace, type MockReply } from "./fixture-assertions";


import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


type GetApi = { GET(): Promise<MockReply> };
type PostApi = { POST(request?: { json(): Promise<unknown> }): Promise<MockReply> };
type Modules = {
 "lib/session.ts": typeof import("../lib/session");
 "app/api/tenant/payment-history/route.ts": GetApi;
 "app/api/tenant/dashboard/route.ts": PostApi;
 "app/api/tenant/balance/route.ts": GetApi;
 "app/api/tenant/maintenance/create/route.ts": PostApi;
 "app/api/tenant/maintenance/list/route.ts": GetApi;
 "app/api/manager/maintenance/route.ts": GetApi;
 "app/api/maintenance/dashboard/route.ts": GetApi;
};
export function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>, source?: string): Modules[File];
export function load(file: keyof Modules, imports: Record<string, unknown>, source?: string): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(source ?? readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, Buffer, URL, Set, Map,
    process: { env: { SESSION_SECRET: "synthetic-isolated-history-session-secret-key", NODE_ENV: "test" } }, console: { log() {}, error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  if(file.startsWith("app/api/")) return checkedHttpNamespace(fixtureModule.exports);
  return fixtureModule.exports;
}
export const json = { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } };
export const session = { role: "TENANT" as const, propertyId: "p", unitId: "u", tenantAssignmentId: "b" };
export function matches(row: unknown, where: unknown = {}): boolean {
  if (!isRecord(where)) throw Error("Expected a query predicate");
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR" || key === "AND") { if (!Array.isArray(value)) throw Error("Expected predicate branches"); const parts: unknown[] = value; return key === "OR" ? parts.some(part => matches(row, part)) : parts.every(part => matches(row, part)); }
    if (!isRecord(row)) throw Error("Expected stored fixture data"); const field = row[key];
    if (isRecord(value) && !(value instanceof Date)) {
      if ("is" in value) return value.is === null ? field == null : field != null && matches(field, value.is);
      if ("in" in value) { if (!Array.isArray(value.in)) throw Error("Expected predicate choices"); const choices: unknown[] = value.in; return choices.includes(field); }
      const [left, right] = typeof field === "string" && typeof (value.lt ?? value.lte ?? value.gt) === "string" ? [field, String(value.lt ?? value.lte ?? value.gt)] : [Number(field), Number(value.lt ?? value.lte ?? value.gt)];
      if ("lt" in value) return left < right;
      if ("lte" in value) return left <= right;
      if ("gt" in value) return left > right;
    }
    return field === value;
  });
}
export type ReadQuery = { where: Record<string, unknown>; take?: number; orderBy?: unknown };
type HistoryPayment = { id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null; status: string; paidAt: Date; paymentMethod: string };
type Entry = { id: string; propertyId: string; unitId: string; tenantAssignmentId: string | null; paymentId: string | null; entryType: string; amountCents: number; voidedAt: Date | null; effectiveDate: Date; createdAt: Date; billingCycle: string; memo: string; referenceNumber: string; chargeType: string | null; payment: HistoryPayment | null };
export function entry(id: string): Entry & { payment: HistoryPayment };
export function entry(id: string, changes: Partial<Entry>): Entry;
export function entry(id: string, changes: Partial<Entry> = {}): Entry {
  return { id, propertyId: "p", unitId: "u", tenantAssignmentId: "b", paymentId: "pay-" + id,
    entryType: "PAYMENT", amountCents: -1234, voidedAt: null, effectiveDate: new Date("2026-01-01"),
    createdAt: new Date("2026-01-02"), billingCycle: "2026-10", memo: id, referenceNumber: id, chargeType: null,
    payment: { id: "pay-" + id, propertyId: "p", unitId: "u", tenantAssignmentId: "b", status: "PAID", paidAt: new Date("2026-01-01"), paymentMethod: "ACH" }, ...changes };
}
export function hostileRows() {
  const good = entry("b");
  return [good, entry("a", { tenantAssignmentId: "a", payment: { ...good.payment, tenantAssignmentId: "a" } }),
    entry("null-ledger", { tenantAssignmentId: null }), entry("null-payment", { payment: { ...good.payment, tenantAssignmentId: null } }),
    entry("mismatched", { payment: { ...good.payment, tenantAssignmentId: "a" } }),
    entry("foreign", { propertyId: "q" }), entry("wrong-unit", { unitId: "v" }),
    entry("foreign-payment", { payment: { ...good.payment, propertyId: "q" } }),
    entry("wrong-unit-payment", { payment: { ...good.payment, unitId: "v" } })];
}
