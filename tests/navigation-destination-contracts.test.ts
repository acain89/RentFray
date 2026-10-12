import { assertApprovedSessionConfigurationChange } from "./management-credential-revocation.test";
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
    const restoreAUD06Session = (source: string): string => {
      let restored = source.replace(/\r\n/g, "\n");
      const deltas: Array<[string, string, number]> = [
  [
    "",
    "export type SessionValidationOptions = Readonly<{ strictAuthority?: boolean }>;\n\n// Only errors created by session authorization may become 401/403 responses.\nexport class SessionAuthorizationError extends Error {\n  readonly status: 401 | 403;\n  constructor(status: 401 | 403) {\n    super(status === 401 ? \"Unauthorized\" : \"Forbidden\");\n    this.name = \"SessionAuthorizationError\";\n    this.status = status;\n  }\n}\n\n",
    1
  ],
  [
    "async function hasCurrentManagementAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentManagementAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentTenantAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentTenantAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "async function hasCurrentAuthority(session: SessionPayload): Promise<boolean> {",
    "async function hasCurrentAuthority(session: SessionPayload, options: SessionValidationOptions = {}): Promise<boolean> {",
    1
  ],
  [
    "export async function validateSessionToken(token: string): Promise<SessionPayload | null> {",
    "export async function validateSessionToken(token: string, options: SessionValidationOptions = {}): Promise<SessionPayload | null> {",
    1
  ],
  [
    "export async function getSession() {",
    "export async function getSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireSession() {",
    "export async function requireSession(options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function requireRole(role: SessionRole) {",
    "export async function requireRole(role: SessionRole, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "export async function refreshSessionCookie(session: SessionPayload) {",
    "export async function refreshSessionCookie(session: SessionPayload, options: SessionValidationOptions = {}) {",
    1
  ],
  [
    "} catch {\n    return false;",
    "} catch (error) {\n    if (options.strictAuthority) throw error;\n    return false;",
    2
  ],
  [
    "} catch {\n      return false;",
    "} catch (error) {\n      if (options.strictAuthority) throw error;\n      return false;",
    2
  ],
  [
    "hasCurrentManagementAuthority(session)",
    "hasCurrentManagementAuthority(session, options)",
    2
  ],
  [
    "hasCurrentTenantAuthority(session)",
    "hasCurrentTenantAuthority(session, options)",
    2
  ],
  [
    "hasCurrentAuthority(session)",
    "hasCurrentAuthority(session, options)",
    3
  ],
  [
    "validateSessionToken(token)",
    "validateSessionToken(token, options)",
    1
  ],
  [
    "getSession()",
    "getSession(options)",
    1
  ],
  [
    "requireSession()",
    "requireSession(options)",
    1
  ],
  [
    "throw new Error(\"Unauthorized\");",
    "throw new SessionAuthorizationError(401);",
    5
  ],
  [
    "throw new Error(\"Forbidden\");",
    "throw new SessionAuthorizationError(403);",
    1
  ]
];
      for (const [original, approved, count] of deltas) {
        assert.equal(restored.split(approved).length - 1, count, "Exact AUD-06 session delta: " + approved);
        restored = restored.split(approved).join(original);
      }
      return restored;
    };
  for (const file of ["app/login/admin/page.tsx", "app/api/admin/session/route.ts", "lib/session.ts", "proxy.ts", "app/manager/dashboard/page.tsx", "app/manager/dashboard/ManagerDashboardClient.tsx", "app/api/manager/units/vacate/route.ts"]) {
    const committed = execFileSync("git", ["--no-optional-locks", "show", "HEAD:" + file], { cwd: root, encoding: "utf8", windowsHide: true });
    if (file === "lib/session.ts") assertApprovedSessionConfigurationChange(committed, restoreAUD06Session(source(file)));
    else assert.equal(source(file).replace(/\r\n/g, "\n"), committed.replace(/\r\n/g, "\n"), file);
  }
});
