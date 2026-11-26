import { startTransition } from "react";
import { isRecord } from "./fixture-assertions";
import * as gracePolicy from "../lib/gracePeriod";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export const file = resolve(__dirname, "..", "app/admin/properties/new/page.tsx");
export const key = "rentfray_new_property_wizard_draft";
export const password = "owner-secret-not-for-storage";
export const data = () => ({
  account: { fullName: "Owner", email: "owner@example.invalid", password, confirmPassword: password },
  property: { name: "Property", address: "123 Street", businessType: "MULTIFAMILY" },
  tiers: [{ id: "tier", name: "Tier", unitLabels: "101", baseRent: "1000", dueDay: "1", graceDays: "5",
    lateFeeInitial: "10", lateFeeDaily: "1", lateFeeMaxDays: "5", charges: [{ id: "fee", label: "Water", amount: "20" }] }],
  applySameRulesToAll: true, paymentSetupDeferred: true,
});
export function nodes(node: unknown): unknown[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node];
  return [node, ...nodes(isRecord(node) && isRecord(node.props) ? node.props.children : undefined)];
}
export function fixture(raw?: string) {
  const storage = new Map<string, string>(raw === undefined ? [] : [[key, raw]]);
  const writes: string[] = [], submissions: unknown[] = [], paths: string[] = [];
  const states: unknown[] = [], effects: (() => void)[] = [];
  let index = 0, mounted = false, unavailable = false, failWrite = false, resultOk = true;
  const imports = {
    "./page.css": {},
    react: { startTransition,
      useState: (initial: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = initial;
        return [states[slot], (value: unknown) => { states[slot] = typeof value === "function" ? Reflect.apply(value, undefined, [states[slot]]) : value; }]; },
      useMemo: <Value>(fn: () => Value) => fn(),
      useEffect: (fn: () => void) => { if (!mounted) effects.push(fn); },
    },
    "react/jsx-runtime": { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }), jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }) },
    "next/navigation": { useRouter: () => ({ push: (path: string) => paths.push(path), replace: (path: string) => paths.push(path) }) },
  };
  const fixtureModule: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, {
    module: fixtureModule, exports: fixtureModule.exports, Date, window: { scrollTo() {}, localStorage: {
      getItem: (name: string) => { if (unavailable) throw Error("storage unavailable"); return storage.get(name) ?? null; },
      setItem: (name: string, value: string) => { if (unavailable || failWrite) throw Error("storage write unavailable"); writes.push(value); storage.set(name, value); },
      removeItem: (name: string) => { if (unavailable) throw Error("storage unavailable"); storage.delete(name); },
    } },
    fetch: async (url: string, options: { body: string }) => { assert.equal(url, "/api/admin/properties");
      submissions.push(JSON.parse(options.body)); return { ok: resultOk, json: async () => resultOk
        ? { property: { id: "p", name: "Property", propertyCode: "01234" }, verificationEmailSent: true }
        : { error: "isolated rejection" } }; },
    require: (name: string) => { if (name === "@/lib/gracePeriod") return gracePolicy; if (name === "@/app/components/GracePeriodInput") return { default: () => null, __esModule: true }; assert.ok(name in imports, "Unmocked import " + name); const value: unknown = Reflect.get(imports, name); return value; },
  });
  const namespace = fixtureModule.exports; assert.ok(isRecord(namespace));
  const component = namespace.default; assert.ok(typeof component === "function");
  const render = (): unknown => { index = 0; return Reflect.apply(component, namespace, []); };
  render(); mounted = true;
  const restore = () => { for (const effect of effects) effect(); };
  const click = async (label: string) => {
    const button = nodes(render()).find(node => isRecord(node) && node.type === "button" &&
      isRecord(node.props) && nodes(node.props.children).filter(child => typeof child === "string").join("").trim() === label);
    assert.ok(isRecord(button), "Missing button " + label); assert.ok(isRecord(button.props));
    const onClick = button.props.onClick; assert.ok(typeof onClick === "function");
    await Reflect.apply(onClick, button.props, []);
  };
  const account = () => { const draft = states[7]; assert.ok(isRecord(draft)); assert.ok(isRecord(draft.account)); return draft.account; };
  return { storage, writes, submissions, paths, states, restore, render, click, account,
    enter: () => { states[7] = data(); }, step: (value: number) => { states[0] = value; },
    unavailable: () => { unavailable = true; }, failWrite: () => { failWrite = true; }, reject: () => { resultOk = false; } };
}
export function assertSafe(raw: string) {
  assert.ok(!raw.includes(password));
  const parsed: unknown = JSON.parse(raw); assert.ok(isRecord(parsed)); assert.ok(isRecord(parsed.data)); assert.ok(isRecord(parsed.data.account));
  assert.equal(Object.hasOwn(parsed.data.account, "password"), false);
  assert.equal(Object.hasOwn(parsed.data.account, "confirmPassword"), false);
  const expected = data();
  assert.deepEqual(parsed.data, { ...expected, account: { fullName: expected.account.fullName, email: expected.account.email } });
  return parsed;
}

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
