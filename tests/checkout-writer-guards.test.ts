import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture, uuid, load, matches } from "./manual-payment-idempotency.test";
import { checkoutFixture } from "./checkout-collectibility.test";

export function writerFixture(role = "MANAGER") {
  const f = fixture(role), c = checkoutFixture();
  f.imports["@/lib/checkoutCollectibility"] = c.helper;
  f.prisma.tenantAssignment.update = async ({ where, data }: any) => {
    const row = f.state.tenantAssignment.find((a: any) => matches(a, where));
    assert.ok(row); f.events.push("tenantAssignment.update"); Object.assign(row, data); return structuredClone(row);
  };
  const dates = load("lib/rentDates.ts", {});
  f.imports["@/lib/rentDates"] = { ...f.imports["@/lib/rentDates"], getBusinessDateInstant: dates.getBusinessDateInstant };
  Object.assign(f.state.units[0], { portalActivated: true, tenantPinHash: "tenant-pin", portalFirstName: "Tenant" });
  const add = (status = "open", id = "one") => { const a = c.add(status, id); f.state.payment.push(a.p); return a; };
  const invoke = (kind: string, extra: any = {}) => {
    if (kind === "payment") return f.pay(extra);
    if (kind === "tier") return f.move(extra);
    if (kind === "unlock") return f.route("app/api/admin/properties/[id]/override/route.ts").POST({ json: async () => ({ action: "UNLOCK_UNIT", unitId: "u", ...extra }) }, { params: Promise.resolve({ id: "p" }) });
    if (kind === "vacancy") return f.route("app/api/manager/units/vacate/route.ts").POST({ json: async () => ({ unitId: "u", tenantAssignmentId: "a", ...extra }) });
    return f.route("app/api/ledger/adjust/route.ts").POST({ json: async () => ({ unitId: "u", tenantAssignmentId: "a", type: kind === "charge" ? "CHARGE" : "CREDIT", amount: 500, ...extra }) });
  };
  c.control.onRetrieve = () => assert.ok(!f.events.some(e => e.includes('FOR UPDATE')), "Stripe retrieval precedes row locks");
  return { ...f, c, add, invoke };
}
for (const kind of ["payment", "credit", "tier", "vacancy", "unlock"]) {
  for (const state of ["open", "unresolved", "expired", "none", "unavailable"]) test(kind + " handles " + state, async () => {
    const f = writerFixture(kind === "unlock" ? "ADMIN" : "MANAGER");
    if (state !== "none") { const a = f.add(state === "expired" ? "expired" : "open"); if (state === "unresolved") a.p.stripeSessionId = null; }
    if (state === "unavailable") f.c.control.unavailable = true;
    const before = structuredClone(f.state);
    const response = await f.invoke(kind, kind === "payment" ? { amount: 1000 } : {});
    const allowed = state === "expired" || state === "none";
    assert.equal(response.status, allowed ? 200 : state === "unavailable" ? 503 : 409);
    if (!allowed) { assert.deepEqual(f.state, before); assert.equal(f.state.auditLog.length, 0); assert.ok(!f.events.some(e => /\.create$|\.update$|\.updateMany$/.test(e))); }
    const message = response.body.error ?? ""; assert.ok(!message.includes("cs-one") && !message.includes("dependency offline"));
  });
  test(kind + " retry freshly observes expiration without tenant activity", async () => {
    const f = writerFixture(kind === "unlock" ? "ADMIN" : "MANAGER"), a = f.add();
    assert.equal((await f.invoke(kind)).status, 409); assert.equal(f.state.auditLog.length, 0);
    a.s.status = "expired"; f.events.splice(0);
    assert.equal((await f.invoke(kind)).status, 200); assert.equal(f.c.calls.filter(s => s.startsWith("checkout:")).length, 2);
  });
}
test("CHARGE and manual charge remain allowed during open Checkout", async () => {
  const f = writerFixture(); f.add(); assert.equal((await f.invoke("charge", { amount: 100 })).status, 200);
  assert.equal(f.c.calls.length, 0);
  const response = await f.route("app/api/ledger/charges/route.ts").POST({ json: async () => ({ propertyId: "p", unitId: "u", tenantAssignmentId: "a", type: "OTHER_FEE", amount: 100, effectiveDate: "2026-10-06" }) });
  assert.equal(response.status, 200); assert.equal(f.c.calls.length, 0);
});
for (const kind of ["payment", "tier"]) test(kind + " blocked UUID later commits once and completed replay bypasses dependency", async () => {
  const f = writerFixture(), a = f.add(); assert.equal((await f.invoke(kind)).status, 409); assert.equal(f.state.auditLog.length, 0);
  a.s.status = "expired"; f.events.splice(0); const first = await f.invoke(kind); assert.equal(first.status, 200);
  const counts = [f.state.payment.length, f.state.ledgerEntry.length, f.state.auditLog.length], calls = f.c.calls.length;
  f.c.control.unavailable = true; f.events.splice(0); const second = await f.invoke(kind);
  assert.deepEqual(second.body, first.body); assert.deepEqual([f.state.payment.length, f.state.ledgerEntry.length, f.state.auditLog.length], counts); assert.equal(f.c.calls.length, calls);
});
test("ADMIN unlock inspects every assignment and blocks entire operation", async () => {
  const f = writerFixture("ADMIN"); f.add("expired"); f.state.tenantAssignment.push({ id: "b", propertyId: "p", unitId: "u", isCurrent: true });
  const b = f.add("open", "two"); b.p.tenantAssignmentId = b.s.metadata.tenantAssignmentId = "b";
  assert.equal((await f.invoke("unlock")).status, 409); assert.ok(f.state.tenantAssignment.every((a: any) => a.isCurrent));
  assert.equal(f.state.units[0].tenantPinHash, "tenant-pin"); assert.equal(f.state.auditLog.length, 0); assert.equal(f.c.calls.length, 2);
});
test("ADMIN unlock changed affected set fails closed", async () => {
  const f = writerFixture("ADMIN"); f.add("expired"); f.controls.onLock = (sql: string) => { if (sql.includes('FROM "Property"')) { f.state.tenantAssignment.push({ id: "replacement", propertyId: "p", unitId: "u", isCurrent: true }); f.controls.onLock = null; } };
  assert.equal((await f.invoke("unlock")).status, 409); assert.equal(f.state.units[0].tenantPinHash, "tenant-pin"); assert.equal(f.state.auditLog.length, 0);
});
test("ADMIN authorization and FORCE_LIVE/repair remain outside guard", async () => {
  const denied = writerFixture(); assert.equal((await denied.invoke("unlock")).status, 401); assert.equal(denied.c.calls.length, 0);
  const f = writerFixture("ADMIN"); f.add(); f.prisma.property.update = async ({ data }: any) => Object.assign(f.property, data);
  f.prisma.paymentConnectionStatus = { upsert: async () => ({ propertyId: "p", readyForLive: false }) };
  for (const action of ["FORCE_LIVE", "REPAIR_PAYMENT_STATUS"]) { assert.equal((await f.invoke("unlock", { action })).status, 200); }
  assert.equal(f.c.calls.length, 0);
});
test("multiple unresolved attempts and old-cycle collectible attempts block reductions", async () => {
  const f = writerFixture(); f.add("expired"); f.add("open", "two"); assert.equal((await f.invoke("credit")).status, 409);
  assert.equal(f.state.ledgerEntry.length, 0); assert.equal(f.c.calls.length, 2);
});
test("debt-increase writers and actual-money reconciliation contain no RF-04 guard", () => {
  for (const file of ["app/api/ledger/charges/route.ts", "jobs/lateFees.ts", "jobs/monthlyRent.ts", "app/api/stripe/webhook/route.ts"]) {
    assert.ok(!readFileSync(resolve(__dirname, "..", file), "utf8").includes("checkoutCollectibility"));
  }
});
