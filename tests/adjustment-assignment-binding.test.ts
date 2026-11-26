import { isElement, invokeEvent, requestData } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture as tenancyFixture, load } from "./tenant-login-assignment-race.fixture";

function fixture(role: string | null = "MANAGER") {
  const f = tenancyFixture(role);
  f.db.payment = { findMany: async () => [] };
  f.imports["@/lib/checkoutCollectibility"] = load("lib/checkoutCollectibility.ts", { stripe: class {} }, { process: { env: {} } });
  return f;
}
const file = "app/api/ledger/adjust/route.ts";
const adjust = (f: ReturnType<typeof fixture>, type = "CHARGE", extra: Record<string, unknown> = {}) => f.invoke(file, { unitId: "u", tenantAssignmentId: "a", type, amount: 100, memo: "test", ...extra });
for (const type of ["CHARGE", "CREDIT"]) test(type + " keeps N17 instant/cycle/memo and distinct submissions", async () => {
  const f = fixture(); assert.equal((await adjust(f, type)).status, 200); assert.equal((await adjust(f, type)).status, 200);
  assert.equal(f.state().ledger.length, 2);
  for (const entry of f.state().ledger) {
    assert.equal(entry.tenantAssignmentId, "a"); assert.equal(entry.entryType, type); assert.equal(entry.amountCents, 10000);
    assert.equal(entry.billingCycle, "2026-09"); assert.equal(entry.effectiveDate.getTime(), f.now.getTime()); assert.equal(entry.memo, "test");
    assert.equal(entry.idempotencyKey, undefined);
  }
  assert.equal(f.state().audits.length, 0); assert.equal(f.realtime.length, 0);
});
for (const kind of ["replaced", "foreign-property", "foreign-unit", "not-current"]) test("adjustment stale identity " + kind, async () => {
  const f = fixture(); f.controls.onLock = () => {
    if (kind === "replaced") f.replace();
    else if (kind === "foreign-property") f.state().assignments[0].propertyId = "other";
    else if (kind === "foreign-unit") f.state().assignments[0].unitId = "other";
    else f.state().assignments[0].isCurrent = false;
  };
  assert.equal((await adjust(f)).status, 409); assert.equal(f.state().ledger.length, 0); assert.equal(f.state().audits.length, 0);
});
for (const role of ["OWNER", "MANAGER"]) test("adjustment role preserved " + role, async () => { assert.equal((await adjust(fixture(role))).status, 200); });
for (const role of [null, "STAFF", "TENANT", "MAINTENANCE", "ADMIN"]) test("adjustment denies " + role, async () => { const f = fixture(role); assert.equal((await adjust(f)).status, 401); assert.equal(f.events.length, 0); });
test("adjustment requires assignment and retains proration retirement", async () => {
  const f = fixture(); assert.equal((await adjust(f, "CHARGE", { tenantAssignmentId: undefined })).status, 400);
  assert.equal((await adjust(f, "PRORATION")).status, 410); assert.equal(f.state().ledger.length, 0);
});
test("adjustment pre-start cycle still clamps without changing effective instant", async () => {
  const f = fixture(); f.state().unit.property.rentFrayStartDate = new Date("2027-01-15T06:00:00Z");
  assert.equal((await adjust(f)).status, 200); assert.equal(f.state().ledger[0].billingCycle, "2027-01"); assert.equal(f.state().ledger[0].effectiveDate.getTime(), f.now.getTime());
});
test("CHARGE does not consult payment state or retarget after financial state changes", async () => {
  const f = fixture(); f.db.payment = new Proxy({ findMany: async (): Promise<never[]> => { throw Error("Payment state is outside this contract"); } }, { get() { throw Error("Payment state is outside this contract"); } });
  assert.equal((await adjust(f)).status, 200); assert.equal(f.state().ledger[0].tenantAssignmentId, "a");
});
test("real adjustment form keeps opened A across B props refresh", async () => {
  let index = 0; const slots: unknown[] = [], sent: Record<string, unknown>[] = [];
  const react = { useState: (initial: unknown) => { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? Reflect.apply(initial, undefined, []) : initial;
    return [slots[i], (value: unknown) => { slots[i] = value; }]; } };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const component = load("app/manager/dashboard/components/AdjustBalanceForm.tsx", { react, "react/jsx-runtime": { jsx, jsxs: jsx } }, {
    alert() {}, fetch: async (_: unknown, options: { body: string }) => { sent.push(requestData(options)); return { ok: true, json: async () => ({ ok: true }) }; },
  }).default;
  function collect(node: unknown, predicate: (node: { type: unknown; props: Record<string, unknown> }) => boolean): { type: unknown; props: Record<string, unknown> }[] {
    if (!isElement(node)) return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => collect(child, predicate))];
  }
  let assignment = "a";
  const render = () => { index = 0; return component({ unitId: "u", tenantAssignmentId: assignment, onClose() {}, onSuccess() {} }); };
  let tree = render(); invokeEvent(collect(tree, n => n.type === "input" && n.props.type === "number")[0], "onChange", { target: { value: "100" } });
  assignment = "b"; tree = render(); await invokeEvent(collect(tree, n => n.type === "button" && n.props.children === "Apply")[0], "onClick");
  assert.equal(sent[0].tenantAssignmentId, "a"); assert.equal(sent[0].unitId, "u");
});
