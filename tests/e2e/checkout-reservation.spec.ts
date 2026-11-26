import { fixture } from "./checkout-reservation.fixture";


import { requiredText, requiredMapValue } from "../fixture-assertions";

import { test, expect } from "@playwright/test";






async function start(f: ReturnType<typeof fixture>) {
  const response = await f.checkout().POST(f.request());
  if (response.status !== 200) throw new Error(response.body.error);
  expect(response.body.ok).toBe(true);
  expect(response.body.data).toBeDefined();
  return requiredText(response.body.data?.url);
}
function fresh() { const f = fixture(); f.db().payments = []; return f; }
test("sequential Pay clicks and second tab reuse one Checkout", async () => {
  const f = fresh(); const first = await start(f); const second = await start(f);
  expect(second).toBe(first); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
});
test("parallel starts serialize one collectible reservation", async () => {
  const f = fresh(); const urls = await Promise.all([start(f), start(f), start(f)]);
  expect(new Set(urls).size).toBe(1); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
  expect(f.lockKeys).toContain("property:unit:historical");
});
test("balance/property name changes never reprice an open Checkout", async () => {
  const f = fresh(); await start(f); const quote = structuredClone(f.creations[0]);
  f.db().balance = 175000; f.unit.property.name = "Changed";
  await start(f); expect(f.creations).toHaveLength(1); expect(f.creations[0]).toEqual(quote);
});
test("decreased debt fails closed without returning obsolete URL or creating replacement", async () => {
  const f = fresh(); await start(f); f.db().balance = 50000;
  const result = await f.checkout().POST(f.request());
  expect(result.status).toBe(409); expect(result.body.data).toBeUndefined();
  expect(f.creations).toHaveLength(1); expect(f.db().payments).toHaveLength(1);
});
test("FAILED with open Checkout remains protected", async () => {
  const f = fresh(); const url = await start(f); f.payment().status = "FAILED";
  expect(await start(f)).toBe(url); expect(f.creations).toHaveLength(1);
});
test("expired Checkout is replaced at current balance", async () => {
  const f = fresh(); await start(f); requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId)).status = "expired";
  f.db().balance = 175000; await start(f);
  expect(f.db().payments).toHaveLength(2); expect(f.creations).toHaveLength(2);
  expect(f.creations[1].params.metadata.ledgerBalanceCents).toBe("175000");
});
test("complete Checkout with processing Intent is not replaced", async () => {
  const f = fresh(); await start(f);
  const session = requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId)); session.status = "complete"; session.payment_intent = "pi";
  f.intent.status = "processing"; await expect(start(f)).rejects.toThrow("processing");
  expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(1);
});
test("complete Checkout with canceled Intent permits replacement", async () => {
  const f = fresh(); await start(f); const session = requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId));
  session.status = "complete"; session.payment_intent = "pi"; f.intent.metadata = f.creations[0].params.metadata; f.intent.status = "canceled";
  await start(f); expect(f.creations).toHaveLength(2);
});
test("ambiguous timeout recovers same Payment with identical parameters/key/timestamp", async () => {
  const f = fresh(); f.timeout(); await expect(start(f)).rejects.toThrow("Failed to create payment session");
  const original = structuredClone(f.creations[0]); f.db().balance = 175000; f.unit.property.name = "Changed";
  await start(f); expect(f.db().payments).toHaveLength(1); expect(f.creations).toHaveLength(2);
  expect(f.creations[1]).toEqual(original);
});
test("old unresolved reservation fails closed", async () => {
  const f = fresh(); f.timeout(); await expect(start(f)).rejects.toThrow();
  f.payment().createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await expect(start(f)).rejects.toThrow("cannot safely"); expect(f.creations).toHaveLength(1);
});
test("multiple pre-existing collectible Checkouts never create another", async () => {
  const f = fresh(); await start(f);
  const duplicate = { ...structuredClone(f.payment()), id: "duplicate", stripeSessionId: "duplicate-cs" };
  const session = { ...structuredClone(requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId))), id: "duplicate-cs",
    metadata: { ...requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId)).metadata, paymentId: "duplicate" } };
  f.db().payments.push(duplicate); f.sessions.set("duplicate-cs", session);
  await expect(start(f)).rejects.toThrow("Multiple"); expect(f.creations).toHaveLength(1);
});
test("wrong existing Checkout identity fails closed", async () => {
  const f = fresh(); await start(f); requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId)).metadata.unitId = "other";
  const response = await f.checkout().POST(f.request());
  expect(response.status).toBe(409); expect(response.body.ok).toBe(false);
  expect(response.body.error).toBe("A payment is processing or awaiting authoritative reconciliation.");
  expect(response.body.data).toBeUndefined(); expect(f.creations).toHaveLength(1);
  expect(f.db().payments).toHaveLength(1);
  expect(response.body.error).not.toContain(f.payment().stripeSessionId);
  expect(response.body.error).not.toContain("other");
});
test("success races start: processing/successful Stripe state prevents replacement", async () => {
  const f = fresh(); await start(f);
  const session = requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId)); session.status = "complete"; session.payment_intent = "pi";
  f.intent.status = "succeeded";
  await expect(start(f)).rejects.toThrow("reconciliation"); expect(f.creations).toHaveLength(1);
});
test("settlement committed before retry wins over new reservation", async () => {
  const f = fresh(); await start(f); f.intent.metadata = f.creations[0].params.metadata;
  await f.apply(); f.db().balance = await f.balance();
  await expect(start(f)).rejects.toThrow("No balance"); expect(f.creations).toHaveLength(1);
});
test("webhook failure plus retry/start share serialization without extra collection", async () => {
  const f = fresh(); await start(f); f.intent.metadata = f.creations[0].params.metadata;
  f.db().failAudit = true; await expect(f.apply()).rejects.toThrow();
  f.db().failAudit = false; await f.apply(); f.db().balance = await f.balance();
  await expect(start(f)).rejects.toThrow("No balance"); expect(f.db().ledger.filter((e) => e.entryType === "PAYMENT")).toHaveLength(1);
});

test("canceled PENDING attempt commits retirement before the financial SSOT quotes replacement", async () => {
  const f = fresh(); await start(f);
  f.payment().status = "PENDING";
  const session = requiredMapValue(f.sessions, requiredText(f.payment().stripeSessionId));
  session.status = "complete"; session.payment_intent = "pi";
  f.intent.metadata = f.creations[0].params.metadata;
  f.intent.status = "canceled";
  await start(f);
  expect(f.db().payments[0].status).toBe("FAILED");
  expect(f.creations).toHaveLength(2);
});

test("concurrent exported settlement and Pay requests cannot create a second collectible attempt", async () => {
  const f = fresh(); await start(f);
  f.intent.metadata = f.creations[0].params.metadata;
  f.db().useLedgerBalance = true;
  const results = await Promise.allSettled([f.apply(), start(f)]);
  expect(results[0].status).toBe("fulfilled");
  expect(f.creations).toHaveLength(1);
  expect(f.db().payments).toHaveLength(1);
  expect(await f.balance()).toBe(0);
  expect(f.db().ledger.filter((e) => e.entryType === "PAYMENT")).toHaveLength(1);
});
