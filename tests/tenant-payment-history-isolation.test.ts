import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export function load(file: string, imports: Record<string, any>, source?: string) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(source ?? readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, Buffer, URL, Set, Map,
    process: { env: { SESSION_SECRET: "isolated-history", NODE_ENV: "test" } }, console: { log() {}, error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; } });
  return module.exports;
}
export const json = { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } };
export const session = { role: "TENANT", propertyId: "p", unitId: "u", tenantAssignmentId: "b" };
export function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((part: any) => matches(row, part));
    if (key === "AND") return value.every((part: any) => matches(row, part));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("is" in value) return value.is === null ? row[key] == null : row[key] != null && matches(row[key], value.is);
      if ("in" in value) return value.in.includes(row[key]);
      if ("lt" in value) return row[key] < value.lt;
      if ("lte" in value) return row[key] <= value.lte;
      if ("gt" in value) return row[key] > value.gt;
    }
    return row[key] === value;
  });
}
export function entry(id: string, changes: any = {}) {
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
test("standalone history isolates both ledger and Payment ownership without writes", async () => {
  const rows = hostileRows(); const before = JSON.stringify(rows); let query: any;
  const api = load("app/api/tenant/payment-history/route.ts", {
    "next/server": json, "@/lib/session": { requireRole: async () => session },
    "@prisma/client": { PaymentStatus: { PAID: "PAID", PENDING: "PENDING" } },
    "@/lib/prisma": { prisma: { ledgerEntry: { findMany: async (args: any) => { query = args; return rows.filter(row => matches(row, args.where)); } } } },
  });
  const result = await api.GET(); assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.body.payments, (row: any) => row.id), ["b"]);
  assert.equal(query.take, 100); assert.deepEqual(JSON.parse(JSON.stringify(query.orderBy)), [{ effectiveDate: "desc" }, { createdAt: "desc" }]);
  assert.deepEqual(Array.from(query.where.payment.is.status.in), ["PAID", "PENDING"]);
  assert.equal(result.body.payments[0].amountCents, 1234); assert.equal(result.body.payments[0].note, "Completed");
  assert.equal(JSON.stringify(rows), before);
});
test("standalone excludes failed, reversed, voided, positive and unlinked entries", async () => {
  const good = entry("good"); const rows = [good, entry("pending", { payment: { ...good.payment, status: "PENDING" } }),
    ...["FAILED", "REVERSED", "UNPAID"].map(status => entry(status, { payment: { ...good.payment, status } })),
    entry("void", { voidedAt: new Date() }), entry("positive", { amountCents: 1 }), entry("unlinked", { payment: null })];
  const api = load("app/api/tenant/payment-history/route.ts", { "next/server": json,
    "@/lib/session": { requireRole: async () => session }, "@prisma/client": { PaymentStatus: { PAID: "PAID", PENDING: "PENDING" } },
    "@/lib/prisma": { prisma: { ledgerEntry: { findMany: async (args: any) => rows.filter(row => matches(row, args.where)) } } } });
  const result = await api.GET(); assert.deepEqual(Array.from(result.body.payments, (r: any) => r.id), ["good", "pending"]);
});
test("missing assignment rejects before private history query", async () => {
  const api = load("app/api/tenant/payment-history/route.ts", { "next/server": json,
    "@/lib/session": { requireRole: async () => ({ ...session, tenantAssignmentId: undefined }) },
    "@prisma/client": { PaymentStatus: {} }, "@/lib/prisma": { prisma: new Proxy({}, { get() { throw Error("Unexpected database access"); } }) } });
  assert.equal((await api.GET()).status, 401);
});
