import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { openPostgresFixture } from "./postgres-fixture";
import { financialModule } from "./e2e/financial-vm.fixture";
import { stripeProvider } from "./e2e/stripe-provider.fixture";
import { load as retentionModule } from "./unit-deletion-retention.fixture";
import * as retention from "../lib/destructiveRetention";

test("verified PostgreSQL financial transitions, signed replay, isolation and retention", async t => {
  const fixture = await openPostgresFixture("financial-postgres");
  const { db } = fixture;
  try {
    await t.test("unscoped mutation is rejected before any fixture write", async () => {
      await assert.rejects(db.property.deleteMany(), /UNSCOPED_MUTATION_REJECTED/);
      assert.equal(await db.property.count(), 0);
    });
    const property = await db.property.create({ data: { name: "Isolated financial acceptance", propertyCode: "9920", status: "READY" } });
    const foreign = await db.property.create({ data: { name: "Unrelated synthetic business", propertyCode: "9921" } });
    const unit = await db.unit.create({ data: { propertyId: property.id, unitNumber: "1", isActive: false } });
    const tenancy = await db.tenantAssignment.create({ data: { propertyId: property.id, unitId: unit.id, firstName: "Synthetic" } });
    const payment = await db.payment.create({ data: { propertyId: property.id, unitId: unit.id, tenantAssignmentId: tenancy.id, billingCycle: "2026-10", amountCents: 150000, processingFeeCents: 0, paymentMethod: "ACH", status: "UNPAID", stripePaymentIntentId: "pi", stripeSessionId: "cs" } });
    await db.ledgerEntry.create({ data: { propertyId: property.id, unitId: unit.id, tenantAssignmentId: tenancy.id, entryType: "CHARGE", chargeType: "RENT", amountCents: 150000, billingCycle: "2026-10", effectiveDate: new Date("2026-10-01") } });
    const metadata = { paymentId: payment.id, propertyId: property.id, unitId: unit.id, tenantAssignmentId: tenancy.id, stripeAccountId: "acct", billingCycle: "2026-10", ledgerBalanceCents: "150000", processingFeeCents: "0", totalAmountCents: "150000" };
    const provider = stripeProvider(0, metadata);
    const localSignatures = new Stripe("sk_test_synthetic_local_not_a_credential").webhooks;
    const stripe = { ...provider.stripe, webhooks: localSignatures };
    class FakeStripe { static errors = Stripe.errors; constructor() { return stripe; } }
    const diagnostics: unknown[][] = [];
    const source = financialModule("mock", {}, (...values) => diagnostics.push(values));
    let signature = "";
    const webhook = source("app/api/stripe/webhook/route.ts", {
      "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number }) => ({ body, status: options?.status ?? 200 }) } },
      stripe: FakeStripe, "next/headers": { headers: async () => ({ get: () => signature }) },
      "@prisma/client": { Prisma }, "@/lib/prisma": { prisma: db },
      "@/lib/stripeAccountStatus": { reconcileStripeAccountStatus: async () => { throw Error("Unexpected provider account operation"); } },
      "@/lib/paymentStatus": source("lib/paymentStatus.ts", {}),
      "@/lib/rentDates": { getBusinessDate: () => new Date(2026, 9, 5), getBusinessDateInstant: source("lib/rentDates.ts", {}).getBusinessDateInstant },
      "@/lib/realtime": { emitEvent() {} },
    });
    let sequence = 0;
    const event = (type: string) => JSON.stringify({ id: "evt_isolated_" + ++sequence, type, data: { object: { ...provider.intent } } });
    const deliver = async (body: string, valid = true) => {
      signature = valid ? localSignatures.generateTestHeaderString({ payload: body, secret: "isolated" }) : "invalid";
      return webhook.POST({ text: async () => body });
    };
    await t.test("invalid signature cannot mutate a payment", async () => {
      assert.equal((await deliver(event("payment_intent.processing"), false)).status, 400);
      assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, "UNPAID");
    });
    await t.test("ACH processing, failure and success persist using mocked provider retrieval", async () => {
      for (const [intentStatus, type, expected] of [["processing", "payment_intent.processing", "PENDING"], ["requires_payment_method", "payment_intent.payment_failed", "FAILED"], ["succeeded", "payment_intent.succeeded", "PAID"]] as const) {
        provider.intent.status = intentStatus;
        provider.intent.last_payment_error = intentStatus === "requires_payment_method" ? { code: "bank_account_unverified" } : null;
        const response = await deliver(event(type));
        assert.equal(response.status, 200, JSON.stringify(diagnostics)); assert.equal(response.body.received, true); assert.notEqual(response.body.reconciled, false);
        assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, expected);
      }
    });
    await t.test("concurrent signed replay posts principal once and retains immutable audits", async () => {
      const body = event("payment_intent.succeeded");
      const before = await db.auditLog.findMany({ orderBy: { id: "asc" } });
      const responses = await Promise.all([deliver(body), deliver(body)]);
      assert.ok(responses.every(response => response.status === 200));
      const entries = await db.ledgerEntry.findMany({ where: { paymentId: payment.id, entryType: "PAYMENT", voidedAt: null } });
      assert.equal(entries.length, 1); assert.equal(entries[0].amountCents, -150000);
      assert.equal(await db.auditLog.count(), before.length + 2);
      assert.deepEqual(await db.auditLog.findMany({ where: { id: { in: before.map(row => row.id) } }, orderBy: { id: "asc" } }), before);
    });
    await t.test("foreign tenancy metadata cannot change financial identity", async () => {
      const before = JSON.stringify(await db.payment.findUniqueOrThrow({ where: { id: payment.id } }));
      const foreignTenant = await db.tenantAssignment.create({ data: { propertyId: foreign.id, unitId: (await db.unit.create({ data: { propertyId: foreign.id, unitNumber: "foreign" } })).id } });
      const body = JSON.stringify({ id: "evt_foreign", type: "payment_intent.succeeded", data: { object: { ...provider.intent, metadata: { ...metadata, tenantAssignmentId: foreignTenant.id } } } });
      const response = await deliver(body); assert.equal(response.status, 200); assert.equal(response.body.reconciled, false);
      assert.equal(JSON.stringify(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })), before);
      assert.equal(await db.ledgerEntry.count({ where: { propertyId: foreign.id } }), 0);
    });
    await t.test("authoritative currency and amount mismatches cannot alter persisted payment facts", async () => {
      const before = JSON.stringify(await db.payment.findUniqueOrThrow({ where: { id: payment.id } }));
      provider.intent.currency = "eur";
      const wrongCurrency = await deliver(event("payment_intent.succeeded"));
      assert.equal(wrongCurrency.status, 200); assert.equal(wrongCurrency.body.reconciled, false);
      provider.intent.currency = "usd"; provider.intent.amount++;
      const wrongAmount = await deliver(event("payment_intent.succeeded"));
      assert.equal(wrongAmount.status, 200); assert.equal(wrongAmount.body.reconciled, false);
      provider.intent.amount--;
      assert.equal(JSON.stringify(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })), before);
    });
    await t.test("manager property isolation and financial-history retention use real locked transactions", async () => {
      let propertyId = foreign.id;
      const api = retentionModule("app/api/manager/units/delete/route.ts", { "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number }) => ({ body, status: options?.status ?? 200 }) } }, "@/lib/prisma": { prisma: db }, "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId }) }, "@/lib/destructiveRetention": retention });
      const request = { json: async () => ({ unitId: unit.id }) };
      assert.equal((await api.POST(request)).status, 404);
      propertyId = property.id;
      assert.equal((await api.POST(request)).status, 409);
      assert.ok(await db.unit.findUnique({ where: { id: unit.id } }));
      assert.equal(await db.payment.count({ where: { id: payment.id } }), 1);
      assert.equal(await db.ledgerEntry.count({ where: { unitId: unit.id } }), 2);
    });
    await t.test("mocked full ACH return and signed replay restore principal exactly once", async () => {
      const ledger = source("lib/ledger.ts", { "@/lib/prisma": { prisma: db } });
      const balance = async () => (await ledger.getUnitLedgerSummary({ unitId: unit.id, tenantAssignmentId: tenancy.id, asOf: new Date("2030-01-01") })).balanceCents;
      assert.equal(await balance(), 0);
      const before = await db.ledgerEntry.findMany({ where: { unitId: unit.id }, orderBy: { id: "asc" } });
      provider.refunds.push({ id: "re_isolated_return", charge: "ch", currency: "usd", amount: 150000, status: "succeeded" });
      const body = JSON.stringify({ id: "evt_isolated_return", type: "charge.refunded", data: { object: { id: "ch", payment_intent: "pi" } } });
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await deliver(body);
        assert.equal(response.status, 200); assert.equal(response.body.received, true); assert.notEqual(response.body.reconciled, false);
        assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, "REVERSED");
        assert.equal(await balance(), 150000);
      }
      assert.deepEqual(await db.ledgerEntry.findMany({ where: { unitId: unit.id }, orderBy: { id: "asc" } }), before);
    });
  } finally { await fixture.close(); }
});
