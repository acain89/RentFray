import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import Stripe from "stripe";

type Reply = { status: number; body: { ok: false; error: string } };
type Loaded = {
  POST(request: Request): Promise<Reply>;
  CheckoutBlocked: new(message: string) => Error;
};
class AuthorizationError extends Error {
  constructor(readonly status: 401 | 403) { super(status === 401 ? "Unauthorized" : "Forbidden"); }
}
class Conflict extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

function fixture(failure: unknown) {
  const logs: unknown[][] = [];
  let injected = failure;
  const holder: { exports: unknown } = { exports: {} };
  class ProviderDouble { static errors = Stripe.errors; }
  const imports: Record<string, unknown> = {
    stripe: ProviderDouble,
    "@prisma/client": { Prisma: {} },
    "@/lib/prisma": { prisma: new Proxy({}, { get() { assert.fail("No database operation expected"); } }) },
    "next/server": { NextResponse: { json: (body: Reply["body"], options: { status: number }) => ({ body, status: options.status }) } },
    "@/lib/session": { SessionAuthorizationError: AuthorizationError, getSession: async () => { throw injected; } },
    "@/lib/checkoutCollectibility": { CheckoutConflict: Conflict },
    "@/lib/liveGating": {}, "@/lib/paymentStatus": {}, "@/lib/unitFinancialState": {},
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
  };
  const source = readFileSync("app/api/payments/create-session/route.ts", "utf8");
  runInNewContext(ts.transpileModule(source + "\nexports.CheckoutBlocked = CheckoutBlocked;", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, {
    module: holder, exports: holder.exports,
    process: { env: { STRIPE_SECRET_KEY: "sk_test_synthetic_no_network" } },
    console: { error: (...args: unknown[]) => logs.push(args) },
    require(name: string) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const api = holder.exports as Loaded;
  return { logs, api, inject(value: unknown) { injected = value; },
    send: () => api.POST(new Request("https://isolated.invalid/api/payments/create-session", { method: "POST" })) };
}

const sensitive = "SYNTHETIC_PRIVATE_MARKER bank-number credential customer@example.invalid";
for (const kind of ["StripeAPIError", "StripeAuthenticationError", "StripeConnectionError", "StripeRateLimitError", "StripeInvalidRequestError"] as const) {
  test(`${kind}: safe customer response, fixed diagnostic and unchanged 400`, async () => {
    const error = new Stripe.errors[kind]({ type: "api_error", message: sensitive });
    Object.assign(error, { raw: { message: sensitive, bank: sensitive }, requestId: sensitive, headers: { authorization: sensitive }, cause: new Error(sensitive) });
    const f = fixture(error); const response = await f.send();
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Unable to start secure payment. Please try again later.");
    assert.equal(response.body.ok, false);
    assert.deepEqual(f.logs, [["create-session error:", "STRIPE_ERROR"]]);
    assert.ok(!JSON.stringify([response, f.logs]).includes(sensitive));
  });
}

for (const failure of [new Error(sensitive), sensitive, null, undefined, 42, { message: sensitive, raw: sensitive }]) {
  test(`unexpected ${typeof failure}: no raw details, unchanged 500`, async () => {
    const f = fixture(failure); const response = await f.send();
    assert.equal(response.status, 500); assert.equal(response.body.error, "Failed to create payment session.");
    assert.deepEqual(f.logs, [["create-session error:", "UNEXPECTED_ERROR"]]);
    assert.ok(!JSON.stringify([response, f.logs]).includes(sensitive));
  });
}

test("provider message, stack and serialization hooks are never accessed", async () => {
  const failure = new Stripe.errors.StripeAPIError({ type: "api_error", message: sensitive });
  for (const key of ["message", "stack", "raw", "requestId"]) Object.defineProperty(failure, key, { get() { assert.fail(`Read private field ${key}`); } });
  Object.assign(failure, { toJSON() { assert.fail("Serialized raw provider error"); }, toString() { assert.fail("Formatted raw provider error"); } });
  const f = fixture(failure); assert.equal((await f.send()).status, 400);
  assert.deepEqual(f.logs, [["create-session error:", "STRIPE_ERROR"]]);
});

for (const status of [401, 403] as const) test(`authorization ${status} retains response and no error logging`, async () => {
  const f = fixture(new AuthorizationError(status)); const response = await f.send();
  assert.equal(response.status, status); assert.equal(response.body.error, status === 401 ? "Unauthorized" : "Forbidden");
  assert.deepEqual(f.logs, []);
});
for (const status of [409, 503]) test(`application conflict retains ${status} and safe message`, async () => {
  const f = fixture(new Conflict("Tenant payment status is temporarily unavailable. Please retry.", status));
  const response = await f.send(); assert.equal(response.status, status);
  assert.equal(response.body.error, "Tenant payment status is temporarily unavailable. Please retry.");
  assert.deepEqual(f.logs, [["create-session error:", "CHECKOUT_CONFLICT"]]);
});
test("blocked checkout retains its application message and 400", async () => {
  const f = fixture(null); f.inject(new f.api.CheckoutBlocked("No balance due."));
  const response = await f.send(); assert.equal(response.status, 400); assert.equal(response.body.error, "No balance due.");
  assert.deepEqual(f.logs, [["create-session error:", "CHECKOUT_BLOCKED"]]);
});
