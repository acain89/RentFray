import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { isValidElement } from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";

type Props = { children?: unknown; disabled?: boolean; onClick?: () => Promise<void> };
function elements(node: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node.props, ...elements(node.props.children)];
}
function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (isValidElement<Props>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const balance = (cents = 10000, pending = false) => ({ ok: true, balanceCents: cents,
  chargesCents: 10000, paymentsCents: 0, hasPendingPayment: pending,
  pendingPaymentAmountCents: pending ? 10000 : 0, lastPaymentDate: null,
  lastPaymentAmountCents: null });
function fixture(page: "balance", body: unknown, status = 200) {
  const states: unknown[] = [], effects: Array<() => void> = [], requests: Array<{ url: string; options: RequestInit }> = [];
  const redirects: string[] = []; let cursor = 0, initialized = false;
  const holder: { exports: Record<string, unknown> } = { exports: {} };
  let checkout = { status: 200, body: { ok: true, data: { url: "https://checkout.example.invalid/frozen" } } as unknown };
  const hooks = {
    useState(initial: unknown) { const slot = cursor++; if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value: unknown) => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }]; },
    useEffect(effect: () => void) { if (!initialized) effects.push(effect); },
    useMemo(calculate: () => unknown) { return calculate(); },
  };
  const source = readFileSync(`app/tenant/${page}/page.tsx`, "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module: holder, exports: holder.exports,
    require(name: string) { if (name === "react") return hooks; if (name === "react/jsx-runtime") return jsx;
      if (name === "next/navigation") return { useSearchParams: () => ({ get: () => null }),
        useRouter: () => ({ replace: (url: string) => redirects.push(url), push: (url: string) => redirects.push(url) }) };
      throw new Error(`Unexpected component dependency: ${name}`); },
    window: { location: { set href(url: string) { redirects.push(url); } } },
    fetch: async (url: string, options: RequestInit = {}) => { requests.push({ url, options });
      const reply = url === "/api/tenant/balance" ? { status, body } : checkout;
      return { status: reply.status, ok: reply.status >= 200 && reply.status < 300, json: async () => reply.body }; },
  });
  function render() { cursor = 0; const component = holder.exports.default;
    assert.equal(typeof component, "function"); if (typeof component !== "function") throw Error("Missing component");
    const node: unknown = component(); initialized = true; return node; }
  const first = render();
  return { first, requests, redirects, render,
    async load() { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); return render(); },
    checkout(status: number, body: unknown) { checkout = { status, body }; },
  };
}
for (const page of ["balance"] as const) {
  test(`${page}: positive cents renders authoritative $100.00`, async () => {
    const f = fixture(page, balance()); assert.match(text(f.first), /Loading/);
    assert.ok(!elements(f.first).some(p => p.onClick));
    const node = await f.load(); assert.match(text(node), /\$100\.00/);
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, "/api/tenant/balance");
  });
  for (const [cents, display] of [[1, "$0.01"], [0, "$0.00"], [-2500, "$-25.00"]] as const)
    test(`${page}: ${cents} cents display and collection state`, async () => {
      const f = fixture(page, balance(cents)); const node = await f.load(); assert.ok(text(node).includes(display));
    });
  for (const bad of [undefined, null, "10000", 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    test(`${page}: rejects invalid balance ${String(bad)}`, async () => {
      const f = fixture(page, { ...balance(), balanceCents: bad }); const node = await f.load();
      assert.match(text(node), /Failed to load|Invalid balance/); assert.ok(!text(node).includes("$0.00"));
      assert.ok(!elements(node).some(p => p.onClick && p.disabled === false)); assert.equal(f.requests.length, 1);
    });
  for (const status of [401, 403, 500]) test(`${page}: handles HTTP ${status} without false financial data`, async () => {
    const f = fixture(page, { error: status === 500 ? "Failed to load balance." : "Unauthorized" }, status);
    const node = await f.load(); assert.ok(!text(node).includes("$0.00"));
    if (status !== 500) assert.deepEqual(f.redirects, ["/property-code"]);
    assert.equal(f.requests.length, 1);
  });
  test(`${page}: malformed body fails closed`, async () => {
    const f = fixture(page, null); assert.match(text(await f.load()), /Failed to load|Invalid balance/);
    assert.equal(f.requests.length, 1);
  });
}
test("Balance Detail needs no fabricated property, unit or delinquency data", async () => {
  const f = fixture("balance", balance()); const node = await f.load();
  assert.match(text(node), /Balance Detail/); assert.match(text(node), /Total Charges/);
  assert.ok(!text(node).includes("DELINQUENT")); assert.ok(!text(node).includes("undefined"));
});
test("Balance Detail rejects malformed charge/paid totals", async () => {
  for (const field of ["chargesCents", "paymentsCents"]) {
    const f = fixture("balance", { ...balance(), [field]: "100" });
    assert.match(text(await f.load()), /Failed to load|Invalid balance/);
  }
});
test("Balance Detail converts last-payment cents and does not fabricate an absent payment", async () => {
  const paid = fixture("balance", { ...balance(), lastPaymentAmountCents: 2501, lastPaymentDate: "2026-10-01T05:00:00Z" });
  assert.ok(text(await paid.load()).includes("$25.01"));
  const absent = fixture("balance", balance()); assert.ok(text(await absent.load()).includes("—"));
});
