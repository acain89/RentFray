import { fixture as paymentReturnFixture } from "./e2e/payment-return-accounting.fixture";
import { test } from "node:test";
import assert from "node:assert/strict";




import Stripe from "stripe";



type Event = { id: string; type: string; data: { object: Record<string, unknown> } };

type Fixture = ReturnType<typeof paymentReturnFixture>;

const action = "STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED";
const sdk = new Stripe("sk_test_isolated_signature_only");
const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
function financial(f: Fixture) {
  const state: Record<string, unknown> = { ...f.db() };
  delete state.audits; delete state.failAudit;
  return normalize(state);
}
const exceptions = (f: Fixture) => f.db().audits.filter(row => row.action === action);

async function fixture() {
  // Shared pure fixture keeps the real SDK signature verification override local.
  const signature = { value: "signature" };
  const f = paymentReturnFixture(995,()=>signature.value);
  await f.apply();
  f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  f.stripe.webhooks.constructEvent = (body, sig, secret) => sdk.webhooks.constructEvent(body, sig, secret);
  Object.assign(f.stripe.refunds,{create:()=>assert.fail("Refund creation prohibited")});
  Object.assign(f.stripe,{transfers:{ create: () => assert.fail("Transfer creation prohibited"), createReversal: () => assert.fail("Transfer reversal prohibited") }});
  Object.assign(f.stripe,{applicationFees:{ createRefund: () => assert.fail("Fee refund prohibited") }});
  return { f, send(event: Event, badSignature = false) {
    const body = JSON.stringify(event);
    signature.value = sdk.webhooks.generateTestHeaderString({ payload: body, secret: badSignature ? "wrong-isolated-secret" : "isolated" });
    return f.webhook.POST({ text: async () => body });
  } };
}

test("verified partial return is durably recorded after rollback without financial changes or raw payloads", async () => {
  const { f, send } = await fixture(); const before = financial(f), audits = normalize(f.db().audits);
  const event = f.event("refund.updated"); event.id = "evt_partial_one";
  event.data.object.metadata = { private: "SYNTHETIC_PRIVATE_BANK_CUSTOMER_PAYLOAD" };
  const response = await send(event); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Financial event requires reconciliation" });
  assert.deepEqual(financial(f), before); assert.deepEqual(normalize(f.db().audits.slice(0, -1)), audits);
  const row = exceptions(f)[0]; assert.equal(exceptions(f).length, 1);
  assert.equal(row.id, "stripe-partial-return:evt_partial_one"); assert.equal(row.propertyId, "property"); assert.equal(row.targetId, "payment");
  assert.deepEqual(JSON.parse(row.metadataJson!), { eventId: event.id, eventType: event.type, intentId: "pi", reason: "PARTIAL_RETURN_ALLOCATION_UNRESOLVED" });
  assert.ok(!JSON.stringify(f.db().audits).includes("SYNTHETIC_PRIVATE_BANK_CUSTOMER_PAYLOAD"));
});

test("repeated and concurrent deliveries retain one marker and remain 503", async () => {
  const { f, send } = await fixture(); const before = financial(f), event = f.event("charge.refunded"); event.id = "evt_duplicate";
  for (let i = 0; i < 2; i++) assert.equal((await send(event)).status, 503);
  for (const response of await Promise.all([send(event), send(event)])) assert.equal(response.status, 503);
  assert.equal(exceptions(f).length, 1); assert.deepEqual(financial(f), before);
});

test("different events retain separate evidence linked to the same stored Payment", async () => {
  const { f, send } = await fixture();
  for (const id of ["evt_first", "evt_second"]) { const event = f.event("refund.updated"); event.id = id; assert.equal((await send(event)).status, 503); }
  assert.equal(exceptions(f).length, 2); assert.ok(exceptions(f).every(row => row.targetId === "payment"));
});

test("audit persistence failure stays retryable without financial writes; later delivery records evidence", async () => {
  const { f, send } = await fixture(); const before = financial(f), event = f.event("refund.updated"); event.id = "evt_storage_retry";
  f.db().failAudit = true; assert.equal((await send(event)).status, 503);
  assert.equal(exceptions(f).length, 0); assert.deepEqual(financial(f), before);
  f.db().failAudit = false; assert.equal((await send(event)).status, 503);
  assert.equal(exceptions(f).length, 1); assert.deepEqual(financial(f), before);
});

test("invalid real HMAC cannot create an exception or alter financial records", async () => {
  const { f, send } = await fixture(); const before = normalize(f.db());
  assert.equal((await send(f.event("refund.updated"), true)).status, 400); assert.deepEqual(normalize(f.db()), before);
});

test("signed but foreign refund mapping is not recorded against another payment", async () => {
  const { f, send } = await fixture(); const before = normalize(f.db()), event = f.event("refund.updated");
  event.data.object.payment_intent = "pi_foreign";
  const response = await send(event); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, reconciled: false }); assert.deepEqual(normalize(f.db()), before);
});

test("later unambiguous provider evidence uses existing idempotent recovery and retains exception history", async () => {
  const { f, send } = await fixture(); const event = f.event("refund.updated"); event.id = "evt_recovery";
  assert.equal((await send(event)).status, 503); const marker = normalize(exceptions(f));
  f.refunds[0].amount = 150995;
  for (let i = 0; i < 2; i++) assert.equal((await send(event)).status, 200);
  assert.equal(f.payment().status, "REVERSED"); assert.equal(await f.balance(), 150000);
  assert.deepEqual(normalize(exceptions(f)), marker);
});
