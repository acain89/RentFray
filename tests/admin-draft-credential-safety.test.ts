import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const file = resolve(__dirname, "..", "app/admin/properties/new/page.tsx");
const key = "rentfray_new_property_wizard_draft";
const password = "owner-secret-not-for-storage";
const data = () => ({
  account: { fullName: "Owner", email: "owner@example.invalid", password, confirmPassword: password },
  property: { name: "Property", address: "123 Street", businessType: "MULTIFAMILY" },
  tiers: [{ id: "tier", name: "Tier", unitLabels: "101", baseRent: "1000", dueDay: "1", graceDays: "5",
    lateFeeInitial: "10", lateFeeDaily: "1", lateFeeMaxDays: "5", charges: [{ id: "fee", label: "Water", amount: "20" }] }],
  applySameRulesToAll: true, paymentSetupDeferred: true,
});
function nodes(node: any): any[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node];
  return [node, ...nodes(node.props?.children)];
}
function fixture(raw?: string) {
  const storage = new Map<string, string>(raw === undefined ? [] : [[key, raw]]);
  const writes: string[] = [], submissions: any[] = [], paths: string[] = [];
  const states: any[] = [], effects: (() => void)[] = [];
  let index = 0, mounted = false, unavailable = false, failWrite = false, resultOk = true;
  const imports: any = {
    "./page.css": {},
    react: {
      useState: (initial: any) => { const slot = index++; if (!(slot in states)) states[slot] = initial;
        return [states[slot], (value: any) => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }]; },
      useMemo: (fn: () => any) => fn(),
      useEffect: (fn: () => void) => { if (!mounted) effects.push(fn); },
    },
    "react/jsx-runtime": { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) },
    "next/navigation": { useRouter: () => ({ push: (path: string) => paths.push(path), replace: (path: string) => paths.push(path) }) },
  };
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, {
    module, exports: module.exports, Date, window: { scrollTo() {}, localStorage: {
      getItem: (name: string) => { if (unavailable) throw Error("storage unavailable"); return storage.get(name) ?? null; },
      setItem: (name: string, value: string) => { if (unavailable || failWrite) throw Error("storage write unavailable"); writes.push(value); storage.set(name, value); },
      removeItem: (name: string) => { if (unavailable) throw Error("storage unavailable"); storage.delete(name); },
    } },
    fetch: async (url: string, options: any) => { assert.equal(url, "/api/admin/properties");
      submissions.push(JSON.parse(options.body)); return { ok: resultOk, json: async () => resultOk
        ? { property: { id: "p", name: "Property", propertyCode: "01234" }, verificationEmailSent: true }
        : { error: "isolated rejection" } }; },
    require: (name: string) => { assert.ok(name in imports, "Unmocked import " + name); return imports[name]; },
  });
  const render = () => { index = 0; return module.exports.default(); };
  render(); mounted = true;
  const restore = () => { for (const effect of effects) effect(); };
  const click = async (label: string) => {
    const button = nodes(render()).find(node => node?.type === "button" &&
      nodes(node.props.children).filter(child => typeof child === "string").join("").trim() === label);
    assert.ok(button, "Missing button " + label); await button.props.onClick();
  };
  return { storage, writes, submissions, paths, states, restore, render, click,
    enter: () => { states[7] = data(); }, step: (value: number) => { states[0] = value; },
    unavailable: () => { unavailable = true; }, failWrite: () => { failWrite = true; }, reject: () => { resultOk = false; } };
}
function assertSafe(raw: string) {
  assert.ok(!raw.includes(password));
  const parsed = JSON.parse(raw);
  assert.equal(Object.hasOwn(parsed.data.account, "password"), false);
  assert.equal(Object.hasOwn(parsed.data.account, "confirmPassword"), false);
  const expected = data();
  assert.deepEqual(parsed.data, { ...expected, account: { fullName: expected.account.fullName, email: expected.account.email } });
  return parsed;
}

for (const action of ["Continue", "Back", "Save & Exit"]) test(action + " persists nonsecret draft and keeps live credentials", async () => {
  const f = fixture(); f.restore(); f.enter(); if (action === "Back") f.step(2);
  await f.click(action); const parsed = assertSafe(f.storage.get(key)!);
  assert.equal(parsed.step, action === "Continue" ? 2 : 1);
  assert.equal(f.states[7].account.password, password); assert.equal(f.states[7].account.confirmPassword, password);
  if (action === "Save & Exit") assert.deepEqual(f.paths, ["/admin?saved=draft"]);
});
test("legacy restore sanitizes persistent copy and never restores credentials", () => {
  const f = fixture(JSON.stringify({ step: 4, data: data(), savedAt: "2026-10-07T12:00:00Z" })); f.restore();
  assert.equal(f.states[7].account.password, ""); assert.equal(f.states[7].account.confirmPassword, "");
  assert.equal(f.states[0], 4); assert.equal(assertSafe(f.storage.get(key)!).savedAt, "2026-10-07T12:00:00Z");
  const again = fixture(f.storage.get(key)); again.restore();
  assert.equal(again.states[7].account.password, ""); assert.equal(again.states[7].account.confirmPassword, "");
});
test("sanitizer excludes unknown legacy account fields and preserves nonsecret data", () => {
  const legacy: any = data(); legacy.account.secretToken = password;
  const f = fixture(JSON.stringify({ step: 2, data: legacy })); f.restore(); assertSafe(f.storage.get(key)!);
});
test("legacy cleanup removes copy if rewriting fails", () => {
  const f = fixture(JSON.stringify({ step: 3, data: data() })); f.failWrite(); f.restore();
  assert.equal(f.storage.has(key), false); assert.equal(f.states[7].account.password, ""); assert.equal(f.states[0], 3);
});
for (const raw of ["{", "null", JSON.stringify({ data: { account: { password }, tiers: null } }), JSON.stringify({ password })]) {
  test("malformed legacy draft stays usable: " + raw.slice(0, 20), () => {
    const f = fixture(raw); f.restore(); assert.equal(f.states[6], true); assert.equal(f.states[7].account.password, "");
    assert.equal(f.storage.has(key), false); assert.doesNotThrow(f.render);
  });
}
test("unavailable storage keeps wizard usable without credential restoration", () => {
  const f = fixture(); f.unavailable(); f.restore(); assert.equal(f.states[6], true); assert.doesNotThrow(f.render);
});
test("live submission retains credentials and success clears sanitized draft", async () => {
  const f = fixture(); f.restore(); f.enter(); await f.click("Save & Exit"); f.step(6); await f.click("Go Live");
  assert.deepEqual(f.submissions, [data()]); assert.equal(f.storage.has(key), false);
  assert.ok(f.writes.every(raw => !raw.includes(password)));
});
test("failed submission keeps safe draft and live credentials retryable", async () => {
  const f = fixture(); f.restore(); f.enter(); await f.click("Save & Exit"); f.reject(); f.step(6); await f.click("Go Live");
  assertSafe(f.storage.get(key)!); assert.equal(f.states[7].account.password, password); assert.deepEqual(f.submissions, [data()]);
});
test("storage write failure preserves existing Save/Exit error behavior", async () => {
  const f = fixture(); f.restore(); f.enter(); f.failWrite(); await f.click("Save & Exit");
  assert.equal(f.storage.has(key), false); assert.equal(f.paths.length, 0);
  assert.equal(f.states[4], "Unable to save your draft locally."); assert.equal(f.states[2], false);
});

export function assertApprovedDraftChange(before: string, after: string) {
  const parse = (source: string) => ts.createSourceFile("wizard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const original = parse(before), current = parse(after);
  const page = (source: ts.SourceFile) => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "NewPropertyPage") as ts.FunctionDeclaration;
  const boundary = (source: ts.SourceFile, name: string) => page(source).body!.statements.find(node =>
    name === "restore" ? ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useEffect"
      : ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => decl.name.getText(source) === name))!;
  const replacements: { start: number; end: number; value: string }[] = [];
  for (const name of ["restore", "persistLocalDraft"]) {
    const node = boundary(current, name); replacements.push({ start: node.getStart(current), end: node.end, value: boundary(original, name).getText(original) });
  }
  for (const name of ["PersistedWizardData", "sanitizeDraftData"]) {
    const matches = current.statements.filter(node => (ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.text === name);
    assert.equal(matches.length, 1); const node = matches[0];
    replacements.push({ start: node.getStart(current), end: node.end + 2, value: "" });
  }
  let restored = after;
  for (const patch of replacements.sort((a, b) => b.start - a.start)) restored = restored.slice(0, patch.start) + patch.value + restored.slice(patch.end);
  assert.equal(restored.replace(/\n$/, ""), before.replace(/\n$/, ""), "Only RF-17 draft sanitization/restoration may change; the rest of the wizard stays exact");
}
