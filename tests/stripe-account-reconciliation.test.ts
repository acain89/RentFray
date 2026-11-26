import { requiredMapValue, requiredValue } from "./fixture-assertions";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";


import { root, isolatedSource, ready, deferred, fixture, webhook, assertRF19Change } from "./stripe-account-reconciliation.fixture";

for (const [label, patch, expected] of [
  ["ready", {}, true], ["details", { details_submitted: false }, false], ["charges", { charges_enabled: false }, false], ["payouts", { payouts_enabled: false }, false],
  ["currently due", { requirements: { currently_due: ["document"] } }, false], ["past due", { requirements: { past_due: ["document"] } }, false], ["disabled", { requirements: { disabled_reason: "rejected" } }, false],
] as const) test("canonical readiness: " + label, () => { assert.equal(fixture().helper.mapStripeAccountStatus({ ...ready, ...patch }).readyForLive, expected); });
test("canonical summary retains ADMIN requirements representation", () => {
  const result = fixture().helper.mapStripeAccountStatus({ ...ready, requirements: { disabled_reason: "reason", currently_due: ["a"], past_due: ["b"], eventually_due: ["c"] } });
  assert.equal(result.requirementsSummary, "Disabled reason: reason | Currently due: a | Past due: b | Eventually due: c");
});
for (const pair of ["webhook/dashboard", "dashboard/ADMIN", "OWNER/webhook"]) test(pair + ": stale pre-lock retrieval retries current state", async () => {
  const f = fixture(); const captured = deferred(), resume = deferred(); let first = true;
  const a = { accounts: { retrieve: async (...args: Parameters<typeof f.stripe.accounts.retrieve>) => { const value = await f.stripe.accounts.retrieve(...args); if (first) { first = false; captured.resolve(); await resume.promise; } return value; } } };
  f.set({ ...ready, charges_enabled: false }); const pending = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await captured.promise;
  f.set(ready); await f.helper.reconcileStripeAccountStatus("p"); resume.resolve(); await pending;
  assert.equal(requiredValue(requiredMapValue(f.properties, "p").cache).readyForLive, true); assert.equal(f.writes.length, 2); assert.ok(f.writes.every(w => w.readyForLive)); assert.equal(f.calls(), 3);
});
test("identical writes still supersede stale inspection via tuple versions", async () => {
  const f = fixture(); await f.helper.reconcileStripeAccountStatus("p"); const captured = deferred(), resume = deferred(); let first = true;
  const a = { accounts: { retrieve: async (...args: Parameters<typeof f.stripe.accounts.retrieve>) => { const value = await f.stripe.accounts.retrieve(...args); if (first) { first = false; captured.resolve(); await resume.promise; } return value; } } };
  const pending = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await captured.promise; await f.helper.reconcileStripeAccountStatus("p"); resume.resolve(); await pending; assert.equal(f.calls(), 4);
});
test("mapping changes cannot write old account state", async () => {
  const f = fixture(); const old = f.stripe.accounts.retrieve; f.stripe.accounts.retrieve = async (...args: Parameters<typeof f.stripe.accounts.retrieve>) => { const a = await old(...args); requiredMapValue(f.properties, "p").stripeAccountId = "new"; requiredMapValue(f.properties, "p").propertyVersion = "99"; return a; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { expectedAccountId: "acct" }), /mapping changed/); assert.equal(f.writes.length, 0);
});
test("retrieved identity mismatch fails before writes", async () => { const f = fixture(); f.stripe.accounts.retrieve = async () => ({ ...ready, id: "foreign" }); await assert.rejects(f.helper.reconcileStripeAccountStatus("p"), /mismatch/); assert.equal(f.writes.length, 0); });
test("retry budget exhausted fails closed without writes", async () => {
  const f = fixture(); const old = f.stripe.accounts.retrieve; f.stripe.accounts.retrieve = async (...args: Parameters<typeof old>) => { const a = await old(...args); requiredMapValue(f.properties, "p").propertyVersion += "1"; return a; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p"), /concurrently/); assert.equal(f.calls(), 3); assert.equal(f.writes.length, 0);
});
test("different properties reconcile while another retrieval is pending", async () => {
  const f = fixture(); const gate = deferred(), began = deferred(); const a = { accounts: { retrieve: async (...args: Parameters<typeof f.stripe.accounts.retrieve>) => { began.resolve(); await gate.promise; return f.stripe.accounts.retrieve(...args); } } };
  const p = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await began.promise; await f.helper.reconcileStripeAccountStatus("q"); assert.ok(requiredMapValue(f.properties, "q").cache); gate.resolve(); await p;
});
test("Stripe failure preserves cache without transaction or fallback", async () => { const f = fixture(); await f.helper.reconcileStripeAccountStatus("p"); const before = structuredClone(f.properties.get("p")); f.failStripe(); await assert.rejects(f.helper.reconcileStripeAccountStatus("p")); assert.deepEqual(f.properties.get("p"), before); assert.equal(f.transactions(), 1); });
test("ADMIN required audit failure rolls back cached state", async () => { const f = fixture(); f.failAudit(); await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { audit: async (tx) => tx.auditLog.create({}) }), /audit failure/); assert.equal(requiredMapValue(f.properties, "p").cache, null); });
test("no-account initialization has no Stripe call or required sync audit", async () => { const f = fixture(); requiredMapValue(f.properties, "p").stripeAccountId = null; const r = await f.helper.reconcileStripeAccountStatus("p", { audit: async () => { throw Error("Unexpected audit"); } }); assert.equal(f.calls(), 0); assert.equal(r.paymentStatus.readyForLive, false); });
test("delayed signed webhook payload never overrides current Stripe state", async () => { const f = fixture(); const api = webhook(f); const r = await api.POST({ text: async () => JSON.stringify({ type: "account.updated", data: { object: { ...ready, charges_enabled: false } } }) }); assert.equal(r.status, 200); assert.equal(requiredValue(requiredMapValue(f.properties, "p").cache).readyForLive, true); });
test("webhook retrieval failure is retryable and never falls back to event payload", async () => { const f = fixture(); f.failStripe(); const r = await webhook(f).POST({ text: async () => JSON.stringify({ type: "account.updated", data: { object: ready } }) }); assert.equal(r.status, 500); assert.equal(f.writes.length, 0); });
for (const file of ["app/api/stripe/webhook/route.ts", "app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts", "app/api/admin/properties/[id]/stripe-sync/route.ts"]) test("RF-19 whole-source preservation: " + file, () => assertRF19Change(file, execFileSync("git", ["show", "88c74f36ee7041399eb5ad94f086f4b9cb010db8:" + file], { cwd: root, encoding: "utf8" }), readFileSync(resolve(root, file), "utf8")));

for (const role of ["OWNER", "MANAGER", "STAFF"]) test("Connect retains banking boundary: " + role, async () => {
  const f = fixture(); let links = 0;
  f.stripe.accounts.update = async () => {};
  f.stripe.accountLinks = { create: async ({ account }: { account: string }) => { assert.equal(account, "acct"); links++; return { url: "https://isolated.invalid/onboarding" }; } };
  class FakeStripe { constructor() { return f.stripe; } }
  const api = isolatedSource("app/api/stripe/connect/route.ts", { stripe: FakeStripe, "@/lib/prisma": { prisma: f.db }, "@/lib/session": { getSession: async () => ({ role, propertyId: "p" }) }, "@/lib/stripeAccountStatus": f.helper, "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } } });
  const result = await api.POST({ url: "https://isolated.invalid/api/stripe/connect" });
  assert.equal(result.status, role === "OWNER" ? 200 : 403);
  assert.equal(f.calls(), role === "OWNER" ? 1 : 0); assert.equal(links, role === "OWNER" ? 1 : 0);
});
test("no-account sync cannot clear a newly associated account", async () => {
  const f = fixture(); requiredMapValue(f.properties, "p").stripeAccountId = null;
  const raw = f.db.$queryRaw; let first = true;
  f.db.$queryRaw = async (...args: Parameters<typeof raw>) => { const rows = await raw(...args); if (first) { first = false; requiredMapValue(f.properties, "p").stripeAccountId = "acct"; requiredMapValue(f.properties, "p").propertyVersion = "99"; } return rows; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { expectedAccountId: null }), /mapping changed/);
  assert.equal(f.writes.length, 0);
});

for (const file of ["app/api/stripe/webhook/route.ts", "app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts"]) test("response baseline rejects unrelated source changes: " + file, () => {
  const current = readFileSync(resolve(root, file), "utf8");
  assert.throws(() => assertRF19Change(file, "", current + "\n// unauthorized source change"), /Only reviewed response edits/);
});
