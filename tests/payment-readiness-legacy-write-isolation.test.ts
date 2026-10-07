import { accountHelper } from "./stripe-account-reconciliation.test";
import { test } from "node:test";
import assert from "node:assert/strict";
import { source, response, request, context } from "./required-audit-atomicity.test";

const adminFile = "app/api/admin/properties/[id]/payment-status/route.ts";
const managerFile = "app/api/manager/property/set-payment-status/route.ts";
function fixture(file: string, role: string | null) {
  const state = { processorConnected: true, bankConnected: true, chargesEnabled: true, payoutsEnabled: true,
    onboardingComplete: true, requirementsDue: true, requirementsSummary: "required", readyForLive: true, lastSyncedAt: "original" };
  let mutations = 0, parsed = 0;
  const forbidden = () => { mutations++; throw Error("Unexpected mutation"); };
  const api = source(file, { "next/server": response,
    "@/lib/session": { getSession: async () => role ? { role, propertyId: "p" } : null },
    "@/lib/permissions": { canManageFinancials: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "@/lib/prisma": { prisma: { property: { findUnique: async () => ({ id: "p", name: "Property", propertyCode: "CODE", status: "LIVE", paymentStatus: state }) },
      paymentConnectionStatus: { upsert: forbidden, update: forbidden, create: forbidden }, auditLog: { create: forbidden }, $transaction: forbidden } },
  });
  return { api, state, mutations: () => mutations, parsed: () => parsed,
    call: (body: any) => api.POST({ json: async () => { parsed++; return body; } }, context) };
}
for (const [file, role] of [[adminFile, "ADMIN"], [managerFile, "OWNER"], [managerFile, "MANAGER"]]) {
  for (const body of [{}, { processorConnected: false, payoutsEnabled: false, requirementsSummary: null },
    { stripeConnected: false, achEnabled: false, onboardingComplete: false, adminApproved: false, notes: "stale" }, { propertyId: "foreign", chargesEnabled: false }]) {
    test(file + ": retired write preserves all current state " + JSON.stringify(body), async () => {
      const f = fixture(file, role); const before = structuredClone(f.state); assert.equal((await f.call(body)).status, 410);
      assert.deepEqual(f.state, before); assert.equal(f.mutations(), 0); assert.equal(f.parsed(), 0);
    });
  }
}
for (const [file, roles] of [[adminFile, [null, "OWNER", "MANAGER", "STAFF", "TENANT"]], [managerFile, [null, "ADMIN", "STAFF", "TENANT", "MAINTENANCE"]]] as const)
  for (const role of roles) test(file + ": retains authorization " + role, async () => {
    const f = fixture(file, role); assert.equal((await f.call({})).status, 401); assert.equal(f.mutations(), 0); assert.equal(f.parsed(), 0);
  });
test("ADMIN payment status GET retains current response", async () => {
  const f = fixture(adminFile, "ADMIN"); const result = await f.api.GET(request({}), context);
  assert.equal(result.status, 200); assert.equal(result.body.ok, true); assert.equal(result.body.property.status, "LIVE");
  assert.deepEqual(result.body.paymentStatus, f.state); assert.equal(f.mutations(), 0);
});
test("authoritative Stripe sync can still reconcile in both directions", async () => {
  let enabled = false; const state: any = { chargesEnabled: true, payoutsEnabled: true }; let transactions = 0;
  const db: any = { $queryRaw: async (sql: any) => sql.join("").includes("FOR UPDATE") ? [] : [{ stripeAccountId: "acct", propertyVersion: "1", statusVersion: state.lastSyncedAt ? "written" : null }], property: { findUnique: async () => ({ id: "p", stripeAccountId: "acct" }) },
    paymentConnectionStatus: { upsert: async ({ update }: any) => Object.assign(state, update) }, auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => { transactions++; return fn(db); } };
  const api = source("app/api/admin/properties/[id]/stripe-sync/route.ts", { "next/server": response,
    "@/lib/session": { getSession: async () => ({ role: "ADMIN" }) }, "@/lib/prisma": { prisma: db },
    "@/lib/stripeAccountStatus": accountHelper(db, { accounts: { retrieve: async () => ({ id: "acct", charges_enabled: enabled, payouts_enabled: enabled, details_submitted: enabled, requirements: {} }) } }) });
  assert.equal((await api.POST(request({}), context)).status, 200); assert.equal(state.chargesEnabled, false); assert.equal(state.payoutsEnabled, false);
  enabled = true; await api.POST(request({}), context); assert.equal(state.chargesEnabled, true); assert.equal(state.payoutsEnabled, true); assert.equal(transactions, 2);
});
test("Stripe sync without an account preserves conservative initialization without adding an audit", async () => {
  let writes = 0;
  const db: any = {
    $queryRaw: async (sql: any) => sql.join("").includes("FOR UPDATE") ? [] : [{ stripeAccountId: null, propertyVersion: "1", statusVersion: null }],
    property: { findUnique: async () => ({ id: "p", stripeAccountId: null }) },
    paymentConnectionStatus: { upsert: async ({ update }: any) => { writes++; return update; } },
    auditLog: { create: async () => { throw Error("Unexpected audit"); } },
    $transaction: async (fn: any) => fn(db),
  };
  const api = source("app/api/admin/properties/[id]/stripe-sync/route.ts", { "next/server": response,
    "@/lib/session": { getSession: async () => ({ role: "ADMIN" }) }, "@/lib/prisma": { prisma: db },
    "@/lib/stripeAccountStatus": accountHelper(db, { accounts: { retrieve: async () => { throw Error("Unexpected external call"); } } }) });
  const result = await api.POST(request({}), context); assert.equal(result.status, 200); assert.equal(writes, 1);
  assert.equal(result.body.paymentStatus.processorConnected, false); assert.equal(result.body.paymentStatus.readyForLive, false);
  assert.equal(result.body.paymentStatus.requirementsSummary, "No Stripe account is connected.");
});
test("manager retirement retains requirement for an authenticated property", async () => {
  const api = source(managerFile, { "next/server": response,
    "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: null }) },
    "@/lib/permissions": { canManageFinancials: () => true } });
  assert.equal((await api.POST(request({ propertyId: "foreign" }))).status, 401);
});
