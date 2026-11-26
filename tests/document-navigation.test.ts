import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function fixture() {
  const assigned: string[] = [];
  const holder = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync("lib/documentNavigation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: holder, exports: holder.exports, URL, window: { location: {
    origin: "https://www.rentfray.com", assign: (url: string) => assigned.push(url),
  } } });
  const navigate: unknown = Reflect.get(holder.exports, "navigateDocument");
  assert.ok(typeof navigate === "function");
  return { assigned, navigate: (path: string) => { Reflect.apply(navigate, undefined, [path]); } };
}
for (const path of ["/property-code", "/login/admin", "/login/manager", "/maintenance/dashboard", "/manager/dashboard?code=01234#account"]) {
  test("session document navigation preserves destination and full reload: " + path, () => {
    const f = fixture(); f.navigate(path); assert.deepEqual(f.assigned, ["https://www.rentfray.com" + path]);
  });
}
for (const path of ["https://evil.invalid/", "//evil.invalid/", "javascript:alert(1)", "/\\evil.invalid/", "relative-path", "/\n/evil.invalid/"]) {
  test("document navigation rejects external or ambiguous destination: " + JSON.stringify(path), () => {
    const f = fixture(); assert.throws(() => f.navigate(path), /Invalid internal navigation/); assert.deepEqual(f.assigned, []);
  });
}

 test("render-time session redirect is pure and effect replay navigates once per destination", () => {
  const paths: string[] = [], effects: Array<() => void> = [];
  const attempted: { current: string | null } = { current: null };
  const holder: { exports: unknown } = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync("components/DocumentRedirect.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: holder, exports: holder.exports, require(name: string) {
    if (name === "react") return { useRef: () => attempted, useEffect: (work: () => void) => effects.push(work) };
    assert.equal(name, "@/lib/documentNavigation");
    return { navigateDocument: (path: string) => paths.push(path) };
  } });
  assert.ok(holder.exports && typeof holder.exports === "object");
  const component: unknown = Reflect.get(holder.exports, "DocumentRedirect");
  assert.ok(typeof component === "function");
  assert.equal(Reflect.apply(component, undefined, [{ path: "/login/manager" }]), null);
  assert.deepEqual(paths, []);
  effects[0](); effects[0]();
  assert.deepEqual(paths, ["/login/manager"]);
  Reflect.apply(component, undefined, [{ path: "/property-code" }]); effects[1](); effects[1]();
  assert.deepEqual(paths, ["/login/manager", "/property-code"]);
 });
