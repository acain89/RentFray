import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const root = resolve(__dirname, "..");
export function isolatedSource(file: string, imports: Record<string, any>, extras: any = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, URL, Buffer, console: { error() {} }, process: { env: { STRIPE_SECRET_KEY: "isolated", STRIPE_WEBHOOK_SECRET: "isolated" } }, require(name: string) { assert.ok(name in imports, "Unmocked import " + name); return imports[name]; }, ...extras });
  return module.exports;
}
export function accountHelper(db: any, stripe: any) {
  return isolatedSource("lib/stripeAccountStatus.ts", { "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripeClient: () => stripe } });
}
const ready = { id: "acct", details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: {} };
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => resolve = r); return { promise, resolve }; }
function fixture() {
  const properties = new Map<string, any>([["p", { stripeAccountId: "acct", propertyVersion: "1", statusVersion: null, cache: null }], ["q", { stripeAccountId: "other", propertyVersion: "2", statusVersion: null, cache: null }]]);
  let version = 10, transactions = 0, calls = 0; let current: any = structuredClone(ready); let failStripe = false, failAudit = false;
  const active = new Set<string>(); const queues = new Map<string, Promise<void>>(); const writes: any[] = [];
  const snapshot = (id: string) => { const p = properties.get(id); return p ? [{ stripeAccountId: p.stripeAccountId, propertyVersion: p.propertyVersion, statusVersion: p.statusVersion }] : []; };
  const db: any = { $queryRaw: async (_s: any, id: string) => snapshot(id),
    property: { findFirst: async ({ where }: any) => { const entry = [...properties.entries()].find(([, p]) => p.stripeAccountId === where.stripeAccountId); return entry ? { id: entry[0] } : null; }, findUnique: async ({ where }: any) => ({ id: where.id, ...properties.get(where.id) }) },
    $transaction: async (fn: any, options: any) => {
      assert.equal(options.timeout, 10000); transactions++; let locked: string | undefined, release: (() => void) | undefined, original: any;
      const tx: any = { $queryRaw: async (s: any, id: string) => {
        if (s.join("").includes('FROM "Property"') && s.join("").includes("FOR UPDATE")) {
          const previous = queues.get(id) ?? Promise.resolve(); const gate = deferred(); queues.set(id, previous.then(() => gate.promise)); await previous;
          release = gate.resolve; locked = id; active.add(id); original = structuredClone(properties.get(id)); return [{ id }];
        }
        if (s.join("").includes("FOR UPDATE")) return [];
        assert.equal(locked, id); return snapshot(id);
      }, paymentConnectionStatus: { upsert: async ({ where, update }: any) => {
        assert.equal(locked, where.propertyId); const p = properties.get(where.propertyId); p.statusVersion = String(++version); p.cache = { id: "status", ...update }; writes.push(structuredClone(update)); return p.cache;
      } }, auditLog: { create: async () => { if (failAudit) throw Error("audit failure"); } } };
      try { return await fn(tx); } catch (e) { if (locked) properties.set(locked, original); throw e; } finally { if (locked) active.delete(locked); release?.(); }
    } };
  const stripe: any = { accounts: { retrieve: async (id: string, _params: any, options: any) => {
    assert.equal(active.has(id === "other" ? "q" : "p"), false, "Stripe outside write transaction"); assert.equal(options.timeout, 10000); assert.equal(options.maxNetworkRetries, 0);
    calls++; if (failStripe) throw Error("transport unavailable"); return { ...structuredClone(current), id };
  } } };
  const helper = accountHelper(db, stripe);
  return { db, stripe, helper, properties, writes, active, set: (a: any) => current = a, calls: () => calls, transactions: () => transactions, failStripe: () => failStripe = true, failAudit: () => failAudit = true };
}
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
  const a: any = { accounts: { retrieve: async (...args: any[]) => { const value = await f.stripe.accounts.retrieve(...args); if (first) { first = false; captured.resolve(); await resume.promise; } return value; } } };
  f.set({ ...ready, charges_enabled: false }); const pending = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await captured.promise;
  f.set(ready); await f.helper.reconcileStripeAccountStatus("p"); resume.resolve(); await pending;
  assert.equal(f.properties.get("p").cache.readyForLive, true); assert.equal(f.writes.length, 2); assert.ok(f.writes.every(w => w.readyForLive)); assert.equal(f.calls(), 3);
});
test("identical writes still supersede stale inspection via tuple versions", async () => {
  const f = fixture(); await f.helper.reconcileStripeAccountStatus("p"); const captured = deferred(), resume = deferred(); let first = true;
  const a: any = { accounts: { retrieve: async (...args: any[]) => { const value = await f.stripe.accounts.retrieve(...args); if (first) { first = false; captured.resolve(); await resume.promise; } return value; } } };
  const pending = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await captured.promise; await f.helper.reconcileStripeAccountStatus("p"); resume.resolve(); await pending; assert.equal(f.calls(), 4);
});
test("mapping changes cannot write old account state", async () => {
  const f = fixture(); const old = f.stripe.accounts.retrieve; f.stripe.accounts.retrieve = async (...args: any[]) => { const a = await old(...args); f.properties.get("p").stripeAccountId = "new"; f.properties.get("p").propertyVersion = "99"; return a; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { expectedAccountId: "acct" }), /mapping changed/); assert.equal(f.writes.length, 0);
});
test("retrieved identity mismatch fails before writes", async () => { const f = fixture(); f.stripe.accounts.retrieve = async () => ({ ...ready, id: "foreign" }); await assert.rejects(f.helper.reconcileStripeAccountStatus("p"), /mismatch/); assert.equal(f.writes.length, 0); });
test("retry budget exhausted fails closed without writes", async () => {
  const f = fixture(); const old = f.stripe.accounts.retrieve; f.stripe.accounts.retrieve = async (...args: any[]) => { const a = await old(...args); f.properties.get("p").propertyVersion += "1"; return a; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p"), /concurrently/); assert.equal(f.calls(), 3); assert.equal(f.writes.length, 0);
});
test("different properties reconcile while another retrieval is pending", async () => {
  const f = fixture(); const gate = deferred(), began = deferred(); const a: any = { accounts: { retrieve: async (...args: any[]) => { began.resolve(); await gate.promise; return f.stripe.accounts.retrieve(...args); } } };
  const p = f.helper.reconcileStripeAccountStatus("p", { stripe: a }); await began.promise; await f.helper.reconcileStripeAccountStatus("q"); assert.ok(f.properties.get("q").cache); gate.resolve(); await p;
});
test("Stripe failure preserves cache without transaction or fallback", async () => { const f = fixture(); await f.helper.reconcileStripeAccountStatus("p"); const before = structuredClone(f.properties.get("p")); f.failStripe(); await assert.rejects(f.helper.reconcileStripeAccountStatus("p")); assert.deepEqual(f.properties.get("p"), before); assert.equal(f.transactions(), 1); });
test("ADMIN required audit failure rolls back cached state", async () => { const f = fixture(); f.failAudit(); await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { audit: async (tx: any) => tx.auditLog.create({}) }), /audit failure/); assert.equal(f.properties.get("p").cache, null); });
test("no-account initialization has no Stripe call or required sync audit", async () => { const f = fixture(); f.properties.get("p").stripeAccountId = null; const r = await f.helper.reconcileStripeAccountStatus("p", { audit: async () => { throw Error("Unexpected audit"); } }); assert.equal(f.calls(), 0); assert.equal(r.paymentStatus.readyForLive, false); });
function webhook(f: ReturnType<typeof fixture>) {
  class FakeStripe { constructor() { return f.stripe; } }
  f.stripe.webhooks = { constructEvent: (body: string) => JSON.parse(body) };
  return isolatedSource("app/api/stripe/webhook/route.ts", { stripe: FakeStripe, "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } }, "next/headers": { headers: async () => ({ get: () => "signed" }) }, "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: f.db }, "@/lib/realtime": { emitEvent() {} }, "@/lib/paymentStatus": {}, "@/lib/rentDates": {}, "@/lib/stripeAccountStatus": f.helper });
}
test("delayed signed webhook payload never overrides current Stripe state", async () => { const f = fixture(); const api = webhook(f); const r = await api.POST({ text: async () => JSON.stringify({ type: "account.updated", data: { object: { ...ready, charges_enabled: false } } }) }); assert.equal(r.status, 200); assert.equal(f.properties.get("p").cache.readyForLive, true); });
test("webhook retrieval failure is retryable and never falls back to event payload", async () => { const f = fixture(); f.failStripe(); const r = await webhook(f).POST({ text: async () => JSON.stringify({ type: "account.updated", data: { object: ready } }) }); assert.equal(r.status, 500); assert.equal(f.writes.length, 0); });

// Restore only approved reconciliation spans before enforcing whole-file equality.
export function assertRF19Change(file: string, before: string, after: string) {
  before = before.replace(/\r\n/g, "\n"); after = after.replace(/\r\n/g, "\n");
  assert.ok(after.includes('import { reconcileStripeAccountStatus } from "@/lib/stripeAccountStatus";'));
  let restored = after.replace('import { reconcileStripeAccountStatus } from "@/lib/stripeAccountStatus";\n', "");
  function restore(oldStart: string, newStart: string, end: string) {
    const a = before.indexOf(oldStart), b = before.indexOf(end, a), c = restored.indexOf(newStart), d = restored.indexOf(end, c);
    assert.ok(a >= 0 && b > a && c >= 0 && d > c, file + " bounded reconciliation span");
    restored = restored.slice(0, c) + before.slice(a, b) + restored.slice(d);
  }
  if (file === "app/api/stripe/webhook/route.ts") restore(' const requirementsDue = Boolean(', '      await reconcileStripeAccountStatus(property.id,', '      emitEvent("payment:update", { propertyId: property.id });');
  else if (file === "app/api/manager/dashboard/route.ts") {
    restored = restored.replace('import { prisma } from "@/lib/prisma";', 'import { prisma } from "@/lib/prisma";\nimport { getStripeClient } from "@/lib/stripe";');
    restore('    if (property.stripeAccountId) {', '    if (property.stripeAccountId) {', '\nlet bankStatus:');
  } else if (file === "app/api/stripe/connect/route.ts") restore('    const stripeAccount = await stripe.accounts.retrieve(accountId);', '    await reconcileStripeAccountStatus(property.id,', '    const stripeReturnUrl');
  else if (file.endsWith("/stripe-sync/route.ts")) {
    restored = 'import type { Prisma } from "@prisma/client";\n' + restored.replace('import { getSession } from "@/lib/session";', 'import { getSession } from "@/lib/session";\nimport { getStripeClient } from "@/lib/stripe";');
    const a = before.indexOf('function getRequirementsSummary'), b = before.indexOf('export async function POST'); restored = restored.replace('export async function POST', before.slice(a, b) + 'export async function POST');
    restore('    if (!property.stripeAccountId)', '    const { paymentStatus, account, data }', '    return NextResponse.json({\n      ok: true,\n      property,\n      paymentStatus,\n      stripeAccount:');
  } else throw Error("Unexpected RF-19 file");
  assert.equal(restored, before, "Only RF-19 reconciliation changed: " + file);
}
for (const file of ["app/api/stripe/webhook/route.ts", "app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts", "app/api/admin/properties/[id]/stripe-sync/route.ts"]) test("RF-19 whole-source preservation: " + file, () => assertRF19Change(file, execFileSync("git", ["show", "88c74f36ee7041399eb5ad94f086f4b9cb010db8:" + file], { cwd: root, encoding: "utf8" }), readFileSync(resolve(root, file), "utf8")));

for (const role of ["OWNER", "MANAGER", "STAFF"]) test("Connect retains banking boundary: " + role, async () => {
  const f = fixture(); let links = 0;
  f.stripe.accounts.update = async () => {};
  f.stripe.accountLinks = { create: async ({ account }: any) => { assert.equal(account, "acct"); links++; return { url: "https://isolated.invalid/onboarding" }; } };
  class FakeStripe { constructor() { return f.stripe; } }
  const api = isolatedSource("app/api/stripe/connect/route.ts", { stripe: FakeStripe, "@/lib/prisma": { prisma: f.db }, "@/lib/session": { getSession: async () => ({ role, propertyId: "p" }) }, "@/lib/stripeAccountStatus": f.helper, "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } } });
  const result = await api.POST({ url: "https://isolated.invalid/api/stripe/connect" });
  assert.equal(result.status, role === "OWNER" ? 200 : 401);
  assert.equal(f.calls(), role === "OWNER" ? 1 : 0); assert.equal(links, role === "OWNER" ? 1 : 0);
});
test("no-account sync cannot clear a newly associated account", async () => {
  const f = fixture(); f.properties.get("p").stripeAccountId = null;
  const raw = f.db.$queryRaw; let first = true;
  f.db.$queryRaw = async (...args: any[]) => { const rows = await raw(...args); if (first) { first = false; f.properties.get("p").stripeAccountId = "acct"; f.properties.get("p").propertyVersion = "99"; } return rows; };
  await assert.rejects(f.helper.reconcileStripeAccountStatus("p", { expectedAccountId: null }), /mapping changed/);
  assert.equal(f.writes.length, 0);
});
