import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isValidElement } from "react";
import * as jsx from "react/jsx-runtime";

class Redirect extends Error {
  constructor(readonly destination: string) { super("Framework redirect"); }
}

function page() {
  const fixture: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync("app/tenant/pay/page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module: fixture, exports: fixture.exports,
    require(name: string): unknown {
      // No balance, payment, database, authentication or provider code is loaded.
      assert.equal(name, "next/navigation");
      return { redirect: (destination: string) => { throw new Redirect(destination); } };
    },
  });
  return (fixture.exports as { default(props?: unknown): never }).default;
}

for (const query of [{}, { checkout: "success" }, { checkout: "cancelled" },
  { amount: "0.01", unitId: "foreign", destination: "https://untrusted.invalid" }]) {
  test(`old payment page redirects without trusting query flags: ${JSON.stringify(query)}`, () => {
    assert.throws(() => page()({ searchParams: Promise.resolve(query) }),
      (error: unknown) => error instanceof Redirect && error.destination === "/tenant/dashboard");
  });
}

test("dashboard retains the explicit payment action and authoritative data source", () => {
  const dashboard = readFileSync("app/tenant/dashboard/page.tsx", "utf8");
  assert.ok(dashboard.includes('fetch("/api/tenant/dashboard"'));
  assert.ok(dashboard.includes("<PayNowButton"));
  assert.ok(dashboard.includes("disabled={paymentBlocked || isPending}"));
  const button = readFileSync("app/components/PayNowButton.tsx", "utf8");
  assert.ok(button.includes('fetch("/api/payments/create-session"'));
  assert.ok(button.includes("JSON.stringify({ unitId })"));
});

function paymentButton(status = 200, disabled = false) {
  const requests: Array<{ url: string; options: RequestInit }> = [];
  const alerts: string[] = [];
  const location = { href: "" };
  const fixture: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync("app/components/PayNowButton.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: fixture, exports: fixture.exports,
    require(name: string): unknown {
      if (name === "@/lib/pwaPaymentInteraction") return { beginPaymentInteraction: () => () => {} };
      if (name === "@/lib/documentNavigation") return { navigateDocument: (path: string) => { location.href = path; } };
      if (name === "react") return { useState: () => [false, () => {}] };
      assert.equal(name, "react/jsx-runtime");
      return jsx;
    },
    window: { location }, alert: (message: string) => alerts.push(message),
    fetch: async (url: string, options: RequestInit) => {
      requests.push({ url, options });
      return { status, json: async () => status === 200
        ? { ok: true, data: { url: "https://checkout.example.invalid/existing" } }
        : { ok: false, error: "A payment is already processing." } };
    },
  });
  const component = (fixture.exports as { default(props: unknown): unknown }).default;
  const node = component({ unitId: "synthetic-unit", amount: 103.95, disabled });
  assert.ok(isValidElement<{ onClick(): Promise<void>; disabled: boolean }>(node));
  return { click: node.props.onClick, disabled: node.props.disabled, requests, alerts, location };
}

test("canonical payment requires an explicit click and sends only unit identity", async () => {
  const f = paymentButton(); assert.equal(f.requests.length, 0);
  await f.click(); assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "/api/payments/create-session");
  assert.equal(f.requests[0].options.method, "POST");
  assert.equal(f.requests[0].options.credentials, "include");
  assert.deepEqual(JSON.parse(String(f.requests[0].options.body)), { unitId: "synthetic-unit" });
  assert.equal(f.location.href, "https://checkout.example.invalid/existing");
});
for (const status of [401, 403]) test(`canonical payment preserves authorization recovery: ${status}`, async () => {
  const f = paymentButton(status); await f.click();
  assert.equal(f.location.href, "/property-code"); assert.equal(f.requests.length, 1);
});
test("canonical payment preserves server conflict without retry or redirect", async () => {
  const f = paymentButton(409); await f.click();
  assert.deepEqual(f.alerts, ["A payment is already processing."]);
  assert.equal(f.requests.length, 1); assert.equal(f.location.href, "");
});
test("canonical payment honors the dashboard's disabled/pending gate", async () => {
  const f = paymentButton(200, true); assert.equal(f.disabled, true);
  await f.click(); assert.equal(f.requests.length, 0); assert.equal(f.location.href, "");
});
