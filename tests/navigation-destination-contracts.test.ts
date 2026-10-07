import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { detailFixture, nodes, textOf } from "./manager-unit-detail-financial-consistency.test";
const root = resolve(__dirname, "..");
const source = (file: string) => readFileSync(resolve(root, file), "utf8");
for (const result of ["rejected", "error", "valid"]) test("ADMIN recovery: " + result, async () => {
  const effects: any[] = [], calls: any[] = [];
  const window = { location: { href: "" } };
  const jsx = (type: any, props: any) => ({ type, props });
  const imports: any = {
    react: { useState: (value: any) => [value, () => {}], useMemo: (fn: any) => fn(), useCallback: (fn: any) => fn, useEffect: (fn: any) => effects.push(fn) },
    "next/link": () => null, "./page.module.css": {}, "react/jsx-runtime": { jsx, jsxs: jsx },
  };
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(source("app/admin/page.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, window, console, fetch: async (url: string, options: any) => {
      calls.push({ url, options }); if (result === "error") throw Error("Network error"); return { ok: result === "valid" };
    }, require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  module.exports.default(); effects[0](); await new Promise<void>(done => setImmediate(done));
  assert.equal(window.location.href, result === "valid" ? "" : "/login/admin");
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "/api/admin/session");
  assert.equal(calls[0].options.credentials, "include");
  assert.ok(existsSync(resolve(root, "app/login/admin/page.tsx")));
  assert.equal(existsSync(resolve(root, "app/admin-login/page.tsx")), false);
  assert.equal(source("app/admin/page.tsx").includes('"/admin-login"'), false);
});
for (const role of ["OWNER", "MANAGER", "STAFF"]) test("Unit Detail navigation: " + role, async () => {
  const links = nodes(await detailFixture("PAID", role).render()).filter(n => n?.props?.href);
  const vacancy = links.filter(n => textOf(n).includes("Manage move-out on dashboard"));
  assert.equal(vacancy.length, role === "STAFF" ? 0 : 1);
  if (vacancy.length) assert.equal(vacancy[0].props.href, "/manager/dashboard");
  assert.equal(links.some(n => String(n.props.href).includes("/move-out")), false);
  assert.equal(existsSync(resolve(root, "app/manager/units/[id]/move-out/page.tsx")), false);
  assert.ok(existsSync(resolve(root, "app/manager/dashboard/page.tsx")));
  assert.match(source("app/manager/dashboard/page.tsx"), /ManagerDashboardClient/);
  const dashboard = source("app/manager/dashboard/ManagerDashboardClient.tsx");
  assert.match(dashboard, /const canVacateUnit = sessionRole === "OWNER" \|\| sessionRole === "MANAGER"/);
  assert.match(dashboard, /disabled=\{!canVacateUnit\}/);
  assert.match(dashboard, /Vacate Unit/);
});
test("destination auth and canonical vacancy writer unchanged", () => {
  for (const file of ["app/login/admin/page.tsx", "app/api/admin/session/route.ts", "lib/session.ts", "proxy.ts", "app/manager/dashboard/page.tsx", "app/manager/dashboard/ManagerDashboardClient.tsx", "app/api/manager/units/vacate/route.ts"]) {
    const committed = execFileSync("git", ["--no-optional-locks", "show", "HEAD:" + file], { cwd: root, encoding: "utf8", windowsHide: true });
    assert.equal(source(file).replace(/\r\n/g, "\n"), committed.replace(/\r\n/g, "\n"), file);
  }
});
