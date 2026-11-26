import { fixture } from "./payment-return-accounting.fixture";




import { test, expect } from "@playwright/test";







test("full ACH withdrawal restores exactly principal, excluding all payment/dispute fees", async () => {
  const f = fixture(2500); await f.apply(); expect(await f.balance()).toBe(0);
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "withdraw", currency: "usd", amount: -152500, fee: 1500, net: -154000 }] });
  await f.apply("charge.dispute.funds_withdrawn");
  expect(f.payment().status).toBe("REVERSED"); expect(await f.balance()).toBe(150000);
  expect(f.db().ledger.filter((e) => e.entryType === "ADJUSTMENT" && !e.voidedAt)).toHaveLength(0);
});
test("duplicate/concurrent withdrawal and reinstatement apply once", async () => {
  const f = fixture(2500); await f.apply();
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "withdraw", currency: "usd", amount: -152500 }] });
  await Promise.all([f.apply("charge.dispute.funds_withdrawn"), f.apply("charge.dispute.funds_withdrawn")]);
  expect(await f.balance()).toBe(150000);
  f.disputes[0].balance_transactions.push({ id: "reinstate", currency: "usd", amount: 152500 });
  await Promise.all([f.apply("charge.dispute.funds_reinstated"), f.apply("charge.dispute.funds_reinstated")]);
  expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
test("dispute creation without movement does not restore debt", async () => {
  const f = fixture(); await f.apply(); f.disputes.push({ id: "du", charge: "ch", balance_transactions: [], status: "warning_needs_response" });
  await f.apply("charge.dispute.created"); expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
test("partial and cumulative fee-free returns preserve remaining credit", async () => {
  const f = fixture(); await f.apply(); f.refunds.push({ id: "refund-a", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(50000); expect(f.payment().status).toBe("PAID");
  f.refunds.push({ id: "refund-b", charge: "ch", currency: "usd", status: "succeeded", amount: 25000 });
  await f.apply("charge.refunded"); expect(await f.balance()).toBe(75000);
  expect(f.db().ledger.filter((e) => e.entryType === "ADJUSTMENT" && !e.voidedAt)).toHaveLength(1);
});
test("partial -> full return removes partial adjustment without double restoration", async () => {
  const f = fixture(); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  await f.apply("charge.refunded"); f.refunds[0].amount = 150000;
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(150000); expect(f.payment().status).toBe("REVERSED");
});
for (const status of ["pending", "failed", "canceled"] as const) {
  test(`external ${status} refund does not restore debt`, async () => {
    const f = fixture(); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status, amount: 150000 });
    await f.apply("charge.refunded"); expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
  });
}
test("ambiguous partial bundled-fee allocation fails without financial writes", async () => {
  const f = fixture(2500); await f.apply(); f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
  const before = structuredClone(f.db()); await expect(f.apply("charge.refunded")).rejects.toThrow("Financial event requires reconciliation");
  expect({ ...f.db(), audits: before.audits }).toEqual(before);
  expect(f.db().audits.filter((row) => row.action === "STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED")).toHaveLength(1);
});

for (const type of ["charge.refunded", "charge.refund.updated", "refund.created", "refund.updated", "refund.failed"]) {
  test(`${type}: ambiguous fee-bearing return is HTTP 503 on duplicate delivery`, async () => {
    const f = fixture(995); await f.apply();
    f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "succeeded", amount: 50000 });
    const before = structuredClone(f.db());
    for (let delivery = 0; delivery < 2; delivery++) {
      const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event(type)) });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Financial event requires reconciliation" });
      expect({ ...f.db(), audits: before.audits }).toEqual(before);
      expect(f.db().audits.filter((row) => row.action === "STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED")).toHaveLength(1);
    }
  });
}

for (const type of ["charge.refund.updated", "refund.updated"]) {
  test(`${type}: pending refund becoming successful is inspected`, async () => {
    const f = fixture(995); await f.apply();
    f.refunds.push({ id: "r", charge: "ch", currency: "usd", status: "pending", amount: 50000 });
    await f.apply("charge.refunded");
    const before = structuredClone(f.db());
    f.refunds[0].status = "succeeded";
    const response = await f.webhook.POST({ text: async () => JSON.stringify(f.event(type)) });
    expect(response.status).toBe(503); expect({ ...f.db(), audits: before.audits }).toEqual(before);
    expect(f.db().audits.filter((row) => row.action === "STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED")).toHaveLength(1);
    // A later full return is unambiguous and remains idempotently recoverable.
    f.refunds[0].amount = 150995;
    await f.apply(type); await f.apply(type);
    expect(f.payment().status).toBe("REVERSED"); expect(await f.balance()).toBe(150000);
  });
}

test("unrelated events and permanently invalid refund mappings are acknowledged without writes", async () => {
  const f = fixture(); const before = structuredClone(f.db());
  const unrelated = await f.webhook.POST({ text: async () => JSON.stringify(f.event("customer.updated")) });
  expect(unrelated.status).toBe(200); expect(await unrelated.json()).toEqual({ received: true });
  const event = f.event("refund.updated"); event.data.object.payment_intent = "unrelated";
  const invalid = await f.webhook.POST({ text: async () => JSON.stringify(event) });
  expect(invalid.status).toBe(200); expect(await invalid.json()).toEqual({ received: true, reconciled: false });
  expect(f.db()).toEqual(before);
});
test("stale success after withdrawal uses current funds state, not old success", async () => {
  const f = fixture(); await f.apply(); f.disputes.push({ id: "du", charge: "ch", balance_transactions: [{ id: "w", currency: "usd", amount: -150000 }] });
  await f.apply("charge.dispute.funds_withdrawn"); await f.apply();
  expect(await f.balance()).toBe(150000); expect(f.payment().status).toBe("REVERSED");
});

test("full successful refund neutralizes the original fee and restores principal only once", async () => {
  const f = fixture(2500); await f.apply();
  f.refunds.push({ id: "full", charge: "ch", currency: "usd", status: "succeeded", amount: 152500 });
  await f.apply("charge.refunded"); await f.apply("charge.refunded");
  expect(await f.balance()).toBe(150000);
  expect(f.payment().status).toBe("REVERSED");
});
test("stale withdrawal delivered after reinstatement uses current restored funds", async () => {
  const f = fixture(2500); await f.apply();
  f.disputes.push({ id: "du", charge: "ch", balance_transactions: [
    { id: "w", currency: "usd", amount: -152500 }, { id: "r", currency: "usd", amount: 152500 },
  ] });
  await f.apply("charge.dispute.funds_reinstated");
  await f.apply("charge.dispute.funds_withdrawn");
  expect(await f.balance()).toBe(0); expect(f.payment().status).toBe("PAID");
});
