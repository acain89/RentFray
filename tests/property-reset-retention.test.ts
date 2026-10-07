import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load, root } from "./unit-deletion-retention.test";
function fixture(role: string | null = "ADMIN", unresolved = false, foreignUnit = false, failAudit = false) {
  const mutations: string[] = []; let reads = 0;
  const property = { id: "a", name: "Property", propertyCode: "CODE", status: "LIVE", units: [], paymentStatus: null };
  const unit = { id: "unit", propertyId: "a", unitNumber: "101", portalActivated: true, tenantPinHash: "retained-hash", portalFirstName: "Tenant",
    portalLastName: "Name", activatedAt: new Date("2026-10-01"), activationSource: "TENANT" };
  const assignments = [{ id: "current", propertyId: "a", unitId: "unit", isCurrent: true, moveOutDate: null as Date | null },
    { id: "historical", propertyId: "a", unitId: "unit", isCurrent: false, moveOutDate: new Date("2026-09-01") }];
  const audits: any[] = [], events: string[] = [];
  let inTransaction = false;
  const history = { ledger: [{ id: "ledger", amountCents: 1000 }], payment: [{ id: "paid", status: "PAID" }], maintenance: [{ id: "request" }] };
  const collectibility = load("lib/checkoutCollectibility.ts", { stripe: class { constructor() { throw Error("Stripe must not be contacted"); } } });
  const rows = load("lib/manualFinancialOperations.ts", {});
  const expectScope = (where: any) => { assert.equal(where.propertyId, "a"); assert.equal(where.unitId, "unit"); };
  const prisma: any = {
    property: { findUnique: async ({ where }: any) => { assert.equal(where.id, "a"); reads++; return property; }, update: async ({ data }: any) => { assert.ok(inTransaction); mutations.push("property"); Object.assign(property, data); return property; } },
    unit: { findFirst: async ({ where }: any) => { assert.equal(where.id, "unit"); assert.equal(where.propertyId, "a"); return foreignUnit ? null : unit; },
      update: async ({ where, data }: any) => { assert.ok(inTransaction); assert.equal(where.id, "unit"); mutations.push("unit"); Object.assign(unit, data); } },
    tenantAssignment: { findMany: async ({ where }: any) => { expectScope(where); return assignments.filter(a => a.isCurrent === where.isCurrent).map(a => ({ id: a.id })); },
      updateMany: async ({ where, data }: any) => { assert.ok(inTransaction); expectScope(where); assert.deepEqual(Array.from(where.id.in), ["current"]); mutations.push("tenantAssignment"); Object.assign(assignments[0], data); return { count: 1 }; } },
    auditLog: { create: async ({ data }: any) => { assert.ok(inTransaction); assert.equal(data.propertyId, "a"); if (failAudit) throw Error("required audit failed"); mutations.push("auditLog"); audits.push(data); } },
    paymentConnectionStatus: { upsert: async ({ update, create }: any) => { assert.ok(inTransaction); assert.deepEqual(Object.keys(update), []); mutations.push("paymentConnectionStatus"); return { id: "connection", ...create }; } },
    payment: { findMany: async ({ where }: any) => { expectScope(where); assert.equal(where.tenantAssignmentId, "current"); events.push(inTransaction ? "locked inventory" : "inspection");
      return unresolved ? [{ id: "attempt", propertyId: "a", unitId: "unit", tenantAssignmentId: "current", billingCycle: "2026-10", amountCents: 1000, processingFeeCents: 0,
        stripeSessionId: null, stripePaymentIntentId: null, status: "UNPAID", createdAt: new Date("2026-10-01") }] : []; } },
    $executeRaw: async (sql: TemplateStringsArray) => { assert.ok(inTransaction); assert.match(sql.join(""), /pg_advisory_xact_lock/); events.push("assignment lock"); },
    $queryRaw: async (sql: TemplateStringsArray) => { assert.ok(inTransaction); assert.match(sql.join(""), /FOR UPDATE NOWAIT/); events.push("row lock"); return []; },
    $transaction: async (fn: any) => { const before = structuredClone({ property, unit, assignments, audits, mutations }); inTransaction = true;
      try { return await fn(prisma); } catch (error) { Object.assign(property, before.property); Object.assign(unit, before.unit); assignments.splice(0, assignments.length, ...before.assignments); audits.splice(0, audits.length, ...before.audits); mutations.splice(0, mutations.length, ...before.mutations); throw error; } finally { inTransaction = false; } },
  };
  for (const model of ["ledgerEntry", "maintenanceRequest"])
    prisma[model] = new Proxy({}, { get() { throw Error("Forbidden mutation/access: " + model); } });
  prisma.payment = new Proxy(prisma.payment, { get(target, key) { if (key !== "findMany") throw Error("Forbidden Payment mutation/access"); return target[key]; } });
  const api = load("app/api/admin/properties/[id]/override/route.ts", {
    "@/lib/prisma": { prisma }, "@/lib/session": { getSession: async () => role ? { role } : null },
    "@/lib/checkoutCollectibility": collectibility, "@/lib/manualFinancialOperations": rows,
    "next/server": { NextResponse: { json: (body: any, options?: any) => ({ body, status: options?.status ?? 200 }) } },
  });
  return { mutations, unit, assignments, audits, history, events, reads: () => reads, call: (action: string) => api.POST({ json: async () => ({ action, unitId: "unit", reason: "isolated" }) }, { params: Promise.resolve({ id: "a" }) }) };
}
test("reset: ADMIN receives 410 without any application data reads or mutations", async () => {
  const f = fixture(); const response = await f.call("RESET_PROPERTY"); assert.equal(response.status, 410);
  assert.match(response.body.error, /retired/); assert.equal(f.reads(), 0); assert.equal(f.mutations.length, 0);
});
for (const role of [null, "OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE"])
  test("reset: preserves ADMIN guard " + role, async () => { const f = fixture(role); assert.equal((await f.call("RESET_PROPERTY")).status, 401); assert.equal(f.mutations.length, 0); });
for (const [action, expected] of [["FORCE_LIVE", ["property", "auditLog"]],
  ["UNLOCK_UNIT", ["tenantAssignment", "unit", "auditLog"]], ["REPAIR_PAYMENT_STATUS", ["paymentConnectionStatus", "auditLog"]]] as [string, string[]][])
  test("override: unchanged operation " + action, async () => { const f = fixture(); const response = await f.call(action);
    assert.equal(response.status, 200); assert.equal(response.body.ok, true); assert.equal(response.body.action, action);
    assert.deepEqual(f.mutations, expected); if (action === "FORCE_LIVE") assert.equal(response.body.property.status, "LIVE"); });

test("unlock with no attempt retains history and performs scoped termination after locked inventory reread", async () => {
  const f = fixture(); const before = structuredClone({ history: f.history, historical: f.assignments[1] });
  assert.equal((await f.call("UNLOCK_UNIT")).status, 200);
  assert.equal(f.assignments[0].isCurrent, false); assert.equal(f.unit.tenantPinHash, null);
  assert.equal(f.audits[0].action, "UNIT_UNLOCKED_BY_ADMIN");
  assert.deepEqual({ history: f.history, historical: f.assignments[1] }, before);
  assert.deepEqual(f.events.slice(0, 3), ["inspection", "assignment lock", "locked inventory"]);
});
test("unlock unresolved attempt fails closed without changing identities, credentials, history or audit", async () => {
  const f = fixture("ADMIN", true); const before = structuredClone({ unit: f.unit, assignments: f.assignments, history: f.history });
  assert.equal((await f.call("UNLOCK_UNIT")).status, 409);
  assert.deepEqual({ unit: f.unit, assignments: f.assignments, history: f.history }, before);
  assert.deepEqual(f.mutations, []); assert.deepEqual(f.audits, []); assert.ok(!f.events.includes("row lock"));
});
test("unlock foreign unit cannot inspect attempts or mutate records", async () => {
  const f = fixture("ADMIN", false, true); assert.equal((await f.call("UNLOCK_UNIT")).status, 404);
  assert.deepEqual(f.mutations, []); assert.deepEqual(f.events, []);
});
test("required unlock audit failure rolls back tenant termination and credential clearing", async () => {
  const f = fixture("ADMIN", false, false, true); const before = structuredClone({ unit: f.unit, assignments: f.assignments, history: f.history });
  assert.equal((await f.call("UNLOCK_UNIT")).status, 500);
  assert.deepEqual({ unit: f.unit, assignments: f.assignments, history: f.history }, before);
  assert.deepEqual(f.mutations, []); assert.deepEqual(f.audits, []);
});
test("reset: UI has no control, success branch or replacement reset", () => {
  const source = readFileSync(resolve(root, "app/admin/properties/[id]/setup/page.tsx"), "utf8");
  assert.ok(!source.includes("RESET_PROPERTY")); assert.ok(!source.includes("Reset Property"));
  for (const action of ["FORCE_LIVE", "UNLOCK_UNIT", "REPAIR_PAYMENT_STATUS"]) assert.ok(source.includes(action));
});
