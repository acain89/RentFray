import { requiredMapValue, requiredValue, httpFacade } from "./fixture-assertions";
import { reviewedUnusedDeclarations } from "./reviewed-unused-declarations.fixture";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export type Account = { id: string; details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; requirements?: { currently_due?: readonly string[] | null; past_due?: readonly string[] | null; eventually_due?: readonly string[] | null; disabled_reason?: string | null } | null };
export type StatusData = ReturnType<typeof import("../lib/stripeAccountStatus").mapStripeAccountStatus>;
export type MockStripe = {
 accounts: { retrieve(id: string, params: object, options: { timeout: number; maxNetworkRetries: number }): Promise<Account>; update?: (...args: unknown[]) => Promise<void> };
 accountLinks?: { create(args: { account: string }): Promise<{ url: string }> };
 webhooks?: { constructEvent(body: string): unknown };
};
type AuditTx = { auditLog: { create(args?: unknown): Promise<unknown> } };
type Helper = {
 mapStripeAccountStatus(account: Account | null): StatusData;
 reconcileStripeAccountStatus(propertyId: string, options?: { stripe?: Pick<MockStripe, "accounts">; expectedAccountId?: string | null; audit?: (tx: AuditTx, data: StatusData, accountId: string) => Promise<unknown> }): Promise<{ paymentStatus: Partial<StatusData> & { id?: string; propertyId?: string; lastSyncedAt?: Date }; account: Account | null; data: StatusData }>;
};
export function isolatedSource(file: "lib/stripeAccountStatus.ts", imports: Record<string, unknown>, extras?: Record<string, unknown>): Helper;
export function isolatedSource(file: string, imports: Record<string, unknown>, extras?: Record<string, unknown>): ReturnType<typeof httpFacade>;
export function isolatedSource(file: string, imports: Record<string, unknown>, extras: Record<string, unknown> = {}): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Date, URL, Buffer, console: { error() {} }, process: { env: { STRIPE_SECRET_KEY: "isolated", STRIPE_WEBHOOK_SECRET: "isolated" } }, require(name: string) { assert.ok(name in imports, "Unmocked import " + name); return imports[name]; }, ...extras });
  return file.startsWith("app/api/") ? httpFacade(fixtureModule.exports) : fixtureModule.exports;
}
export function accountHelper(db: unknown, stripe: unknown) {
  return isolatedSource("lib/stripeAccountStatus.ts", { "@/lib/prisma": { prisma: db }, "@/lib/stripe": { getStripeClient: () => stripe } });
}
export const ready = { id: "acct", details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: {} };
export function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => resolve = r); return { promise, resolve }; }
export function fixture() {
  type Update = StatusData & { lastSyncedAt: Date };
  type Property = { stripeAccountId: string | null; propertyVersion: string; statusVersion: string | null; cache: (Update & { id: string }) | null };
  
  type Transaction = AuditTx & { $queryRaw(sql: TemplateStringsArray, id: string): Promise<unknown[]>; paymentConnectionStatus: { upsert(args: {where:{propertyId:string};update:Update}): Promise<Update & {id:string}> } };
  const properties = new Map<string, Property>([["p", { stripeAccountId: "acct", propertyVersion: "1", statusVersion: null, cache: null }], ["q", { stripeAccountId: "other", propertyVersion: "2", statusVersion: null, cache: null }]]);
  let version = 10, transactions = 0, calls = 0; let current: Account = structuredClone(ready); let failStripe = false, failAudit = false;
  const active = new Set<string>(); const queues = new Map<string, Promise<void>>(); const writes: Update[] = [];
  const snapshot = (id: string) => { const p = properties.get(id); return p ? [{ stripeAccountId: p.stripeAccountId, propertyVersion: p.propertyVersion, statusVersion: p.statusVersion }] : []; };
  const db = { $queryRaw: async (_s: TemplateStringsArray, id: string) => snapshot(id),
    property: { findFirst: async ({ where }: { where: { id: string; stripeAccountId: string } }) => { const entry = [...properties.entries()].find(([, p]) => p.stripeAccountId === where.stripeAccountId); return entry ? { id: entry[0] } : null; }, findUnique: async ({ where }: { where: { id: string; stripeAccountId: string } }) => ({ id: where.id, ...properties.get(where.id) }) },
    $transaction: async <Result>(fn: (tx: Transaction) => Promise<Result>, options: { timeout: number }): Promise<Result> => {
      assert.equal(options.timeout, 10000); transactions++; let locked: string | undefined, release: (() => void) | undefined, original: Property | undefined;
      const tx: Transaction = { $queryRaw: async (s: TemplateStringsArray, id: string) => {
        if (s.join("").includes('FROM "Property"') && s.join("").includes("FOR UPDATE")) {
          const previous = queues.get(id) ?? Promise.resolve(); const gate = deferred(); queues.set(id, previous.then(() => gate.promise)); await previous;
          release = gate.resolve; locked = id; active.add(id); original = structuredClone(properties.get(id)); return [{ id }];
        }
        if (s.join("").includes("FOR UPDATE")) return [];
        assert.equal(locked, id); return snapshot(id);
      }, paymentConnectionStatus: { upsert: async ({ where, update }) => {
        assert.equal(locked, where.propertyId); const p = requiredMapValue(properties, where.propertyId); p.statusVersion = String(++version); p.cache = { id: "status", ...update }; writes.push(structuredClone(update)); return p.cache;
      } }, auditLog: { create: async () => { if (failAudit) throw Error("audit failure"); } } };
      try { return await fn(tx); } catch (e) { if (locked) properties.set(locked, requiredValue(original)); throw e; } finally { if (locked) active.delete(locked); release?.(); }
    } };
  const stripe: MockStripe = { accounts: { retrieve: async (id: string, _params: object, options: { timeout: number; maxNetworkRetries: number }) => {
    assert.equal(active.has(id === "other" ? "q" : "p"), false, "Stripe outside write transaction"); assert.equal(options.timeout, 10000); assert.equal(options.maxNetworkRetries, 0);
    calls++; if (failStripe) throw Error("transport unavailable"); return { ...structuredClone(current), id };
  } } };
  const helper = accountHelper(db, stripe);
  return { db, stripe, helper, properties, writes, active, set: (a: Account) => current = a, calls: () => calls, transactions: () => transactions, failStripe: () => failStripe = true, failAudit: () => failAudit = true };
}
export function webhook(f: ReturnType<typeof fixture>) {
  class FakeStripe { constructor() { return f.stripe; } }
  f.stripe.webhooks = { constructEvent: (body: string) => JSON.parse(body) };
  return isolatedSource("app/api/stripe/webhook/route.ts", { stripe: FakeStripe, "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } }, "next/headers": { headers: async () => ({ get: () => "signed" }) }, "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: f.db }, "@/lib/realtime": { emitEvent() {} }, "@/lib/paymentStatus": {}, "@/lib/rentDates": {}, "@/lib/stripeAccountStatus": f.helper });
}

// Restore only approved reconciliation spans before enforcing whole-file equality.
export function assertRF19Change(file: string, before: string, after: string) {
  before = before.replace(/\r\n/g, "\n"); after = after.replace(/\r\n/g, "\n");
  // F1 and the response-security batch supersede RF-19's historical whole-file baseline.
  // Keep exact equality against the committed F1-F3 source plus only reviewed response edits.
  if (["app/api/stripe/webhook/route.ts", "app/api/manager/dashboard/route.ts", "app/api/stripe/connect/route.ts"].includes(file)) {
    // 58cd091 adds durable partial-return exceptions without rewriting financial facts.
    const reviewedCommit = file === "app/api/stripe/webhook/route.ts"
      ? "58cd0911d3e85e24e5eb99e8da8dff76132c7b1a" : "24e5d002f69e8ee7cecb64435b4f88a7e6b3ca59";
    let expected = execFileSync("git", ["show", reviewedCommit + ":" + file], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
    if (file === "app/api/manager/dashboard/route.ts") {
      const boundary = expected.indexOf("    await refreshSessionCookie(session);");
      assert.ok(boundary >= 0);
      expected = expected.slice(0, boundary) + expected.slice(boundary).replace('{ status: 401 }', '{ status: 403 }');
    }
    if (file === "app/api/stripe/connect/route.ts") {
      expected = expected.replace('{ status: 401 }', '{ status: !session ? 401 : 403 }');
      expected = expected.replace('console.error("POST /api/stripe/connect error:", error);',
        'console.error("POST /api/stripe/connect failed", { code: error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^(P\\d{4}|[a-z_]{1,50})$/.test(error.code) ? error.code : "UNKNOWN" });');
      expected = expected.replace('    const message =\n      error instanceof Error && error.message\n        ? error.message\n        : "Stripe error";', '    const message = "Stripe error";');
    }
    assert.equal(after, reviewedUnusedDeclarations(file, expected), "Only reviewed response edits may differ from committed F1-F3: " + file);
    return;
  }
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
