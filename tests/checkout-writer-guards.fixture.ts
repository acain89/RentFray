import { requiredRecord } from "./fixture-assertions";

import assert from "node:assert/strict";

import { fixture, load, matches } from "./manual-payment-idempotency.fixture";
import { checkoutFixture } from "./checkout-collectibility.fixture";


export function writerFixture(role = "MANAGER") {
  const f = fixture(role), c = checkoutFixture();
  f.imports["@/lib/checkoutCollectibility"] = c.helper;
  f.prisma.tenantAssignment.update = async ({ where, data }) => {
    const row = f.state.tenantAssignment.find((a) => matches(a, where));
    assert.ok(row); f.events.push("tenantAssignment.update"); Object.assign(row, data); return structuredClone(row);
  };
  const dates = load("lib/rentDates.ts", {});
  f.imports["@/lib/rentDates"] = { ...requiredRecord(f.imports["@/lib/rentDates"]), getBusinessDate: dates.getBusinessDate, getBusinessDateInstant: dates.getBusinessDateInstant };
  Object.assign(f.state.units[0], { portalActivated: true, tenantPinHash: "tenant-pin", portalFirstName: "Tenant" });
  const add = (status = "open", id = "one") => { const a = c.add(status, id); f.state.payment.push(a.p); return a; };
  const invoke = (kind: string, extra: Record<string, unknown> = {}) => {
    if (kind === "payment") return f.pay(extra);
    if (kind === "tier") return f.move(extra);
    if (kind === "unlock") return f.route("app/api/admin/properties/[id]/override/route.ts").POST({ json: async () => ({ action: "UNLOCK_UNIT", unitId: "u", ...extra }) }, { params: Promise.resolve({ id: "p" }) });
    if (kind === "vacancy") return f.route("app/api/manager/units/vacate/route.ts").POST({ json: async () => ({ unitId: "u", tenantAssignmentId: "a", ...extra }) });
    return f.route("app/api/ledger/adjust/route.ts").POST({ json: async () => ({ unitId: "u", tenantAssignmentId: "a", type: kind === "charge" ? "CHARGE" : "CREDIT", amount: 500, ...extra }) });
  };
  c.control.onRetrieve = () => assert.ok(!f.events.some(e => e.includes('FOR UPDATE')), "Stripe retrieval precedes row locks");
  return { ...f, c, add, invoke };
}
