import { recordRows, requiredArray, requiredRecord, requiredValue } from "./fixture-assertions";
import type { ReadQuery } from "./tenant-payment-history-isolation.fixture";
import { test } from "node:test";
import assert from "node:assert/strict";




import { load, json, session, matches, entry, hostileRows } from "./tenant-payment-history-isolation.fixture";

test("standalone history isolates both ledger and Payment ownership without writes", async () => {
  const rows = hostileRows(); const before = JSON.stringify(rows); const queries: ReadQuery[] = [];
  const api = load("app/api/tenant/payment-history/route.ts", {
    "next/server": json, "@/lib/session": { requireRole: async () => session },
    "@prisma/client": { PaymentStatus: { PAID: "PAID", PENDING: "PENDING" } },
    "@/lib/prisma": { prisma: { ledgerEntry: { findMany: async (args: ReadQuery) => { queries.push(args); return rows.filter(row => matches(row, args.where)); } } } },
  });
  const result = await api.GET(); assert.equal(result.status, 200);
  assert.deepEqual(Array.from(recordRows(result.body.payments), (row) => row.id), ["b"]);
  const query = requiredValue(queries[0]); assert.equal(query.take, 100); assert.deepEqual(JSON.parse(JSON.stringify(query.orderBy)), [{ effectiveDate: "desc" }, { createdAt: "desc" }]);
  assert.deepEqual(Array.from(requiredArray(requiredRecord(requiredRecord(requiredRecord(query.where.payment).is).status).in)), ["PAID", "PENDING"]);
  assert.equal(recordRows(result.body.payments)[0].amountCents, 1234); assert.equal(recordRows(result.body.payments)[0].note, "Completed");
  assert.equal(JSON.stringify(rows), before);
});
test("standalone excludes failed, reversed, voided, positive and unlinked entries", async () => {
  const good = entry("good"); const rows = [good, entry("pending", { payment: { ...good.payment, status: "PENDING" } }),
    ...["FAILED", "REVERSED", "UNPAID"].map(status => entry(status, { payment: { ...good.payment, status } })),
    entry("void", { voidedAt: new Date() }), entry("positive", { amountCents: 1 }), entry("unlinked", { payment: null })];
  const api = load("app/api/tenant/payment-history/route.ts", { "next/server": json,
    "@/lib/session": { requireRole: async () => session }, "@prisma/client": { PaymentStatus: { PAID: "PAID", PENDING: "PENDING" } },
    "@/lib/prisma": { prisma: { ledgerEntry: { findMany: async (args: ReadQuery) => rows.filter(row => matches(row, args.where)) } } } });
  const result = await api.GET(); assert.deepEqual(Array.from(recordRows(result.body.payments), (r) => r.id), ["good", "pending"]);
});
test("missing assignment rejects before private history query", async () => {
  const api = load("app/api/tenant/payment-history/route.ts", { "next/server": json,
    "@/lib/session": { requireRole: async () => ({ ...session, tenantAssignmentId: undefined }) },
    "@prisma/client": { PaymentStatus: {} }, "@/lib/prisma": { prisma: new Proxy({}, { get() { throw Error("Unexpected database access"); } }) } });
  assert.equal((await api.GET()).status, 401);
});
