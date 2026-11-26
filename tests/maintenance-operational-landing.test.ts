import { requiredValue, requiredRecord, requiredArray, requiredText, isElement, invokeEvent, type MockReply } from "./fixture-assertions";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { fixture, load } from "./admin-session-revalidation.fixture";

const json = (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 });
type FetchOptions = { method?: string; body?: string; credentials?: RequestCredentials; cache?: RequestCache };
type Fetch = (url: string, options: FetchOptions) => Promise<{ ok: boolean; status: number; json(): Promise<Record<string, unknown>> }>;
const response = (result: MockReply) => ({ ok: result.status < 400, status: result.status, json: async () => result.body });
const tick = () => new Promise<void>(done => setImmediate(done));
const row = { id: "r", propertyId: "p", unitId: "u", unit: { unitNumber: "101" }, category: "PLUMBING", urgency: "NORMAL", status: "OPEN", description: "Leaking tap", createdAt: new Date(0), updatedAt: new Date(0) };

function backend(role = "MAINTENANCE") {
  const f = fixture(role === "ADMIN" ? "ADMIN" : "MAINTENANCE");
  if (["OWNER", "MANAGER", "STAFF"].includes(role)) {
    f.state.management = { id: "m", propertyId: "p", role, isActive: true, passwordHash: "synthetic-credential" };
    f.values.set("rf_session", f.session.createSessionToken({ role, propertyId: "p", managementUserId: "m",
      managementCredentialBinding: f.session.createManagementCredentialBinding("m", f.state.management.passwordHash) }));
  }
  if (role === "TENANT") {
    f.state.assignment = { id: "t", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, unit: { id: "u", propertyId: "p" } };
    f.values.set("rf_session", f.session.createSessionToken({ role, propertyId: "p", unitId: "u", tenantAssignmentId: "t" }));
  }
  const state = { rows: [structuredClone(row)], audits: [] as Partial<import("@prisma/client").AuditLog>[] };
  const prisma = {
    maintenanceRequest: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => state.rows.filter(r => r.propertyId === where.propertyId),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => state.rows.find(r => r.id === where.id && r.propertyId === where.propertyId) ?? null,
      update: async ({ where, data }: { where: {id:string}; data: Partial<typeof row> }) => { const r = state.rows.find(r => r.id === where.id)!; Object.assign(r, data); return r; },
      delete: async ({ where }: { where: Record<string, unknown> }) => { state.rows = state.rows.filter(r => r.id !== where.id); },
    },
    auditLog: { create: async ({ data }: { data: Partial<import("@prisma/client").AuditLog> }) => { state.audits.push(data); } },
  };
  Object.assign(prisma, { $transaction: async <Result>(fn: (tx: typeof prisma) => Promise<Result>): Promise<Result> => fn(prisma) });
  const imports = { "@/lib/session": f.session, "@/lib/prisma": { prisma }, "next/server": { NextResponse: { json } }, "@prisma/client": { Prisma: {} } };
  const dashboard = load("app/api/maintenance/dashboard/route.ts", imports);
  const update = load("app/api/manager/maintenance/update/route.ts", imports);
  const auth = load("app/api/auth/session/route.ts", imports);
  const calls: { url: string; options: FetchOptions }[] = [];
  const fetch = async (url: string, options: FetchOptions = {}) => {
    calls.push({ url, options });
    if (url === "/api/maintenance/dashboard") return response(await dashboard.GET());
    if (url === "/api/manager/maintenance/update") return response(await update.POST({ json: async () => JSON.parse(requiredText(options.body)) }));
    if (url === "/api/auth/session" && options.method === "DELETE") return response(await auth.DELETE());
    throw Error("Unexpected API " + url);
  };
  return { ...f, sessionState: f.state, state, dashboard, update, calls, fetch };
}

function ui(file: string, fetch: Fetch, initial: unknown[] = []) {
  let cursor = 0;
  const states: unknown[] = [...initial];
  const effects: (() => void)[] = [];
  const navigations: string[] = [];
  const window = { location: { href: "" }, confirm: () => true, localStorage: { getItem: () => "CODE", setItem() {} } };
  const router = { replace: (url: string) => navigations.push(url) };
  const fixtureModule: { exports: Partial<{ default(props: Record<string, unknown>): unknown }> } = { exports: {} };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const imports: Record<string, unknown> = {
    react: {
      useState: (value: unknown) => { const index = cursor++; if (!(index in states)) states[index] = value; return [states[index], (next: unknown) => { states[index] = typeof next === "function" ? Reflect.apply(next, undefined, [states[index]]) : next; }]; },
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => string) => snapshot(),
      useCallback: <Value>(fn: Value) => fn,
      useEffect: (fn: () => void) => effects.push(fn),
    },
    "next/navigation": { useRouter: () => router },
    "react/jsx-runtime": { jsx, jsxs: jsx },
  };
  const hookModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, "../lib/usePropertyCode.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module: hookModule, exports: hookModule.exports, window, Event, require: (name: string) => { assert.equal(name, "react"); return imports.react; } });
  imports["@/lib/usePropertyCode"] = hookModule.exports;
  const source = readFileSync(resolve(__dirname, "..", file), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module: fixtureModule, exports: fixtureModule.exports, window, fetch, Date, console, require: (name: string) => { if (!(name in imports)) throw Error("Unmocked " + name); return imports[name]; } });
  function render(props: Record<string, unknown> = {}) { cursor = 0; return requiredValue(fixtureModule.exports.default)(props); }
  return { render, states, effects, window, navigations };
}
function nodes(tree: unknown): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isElement(tree)) return [];
  return [tree, ...nodes(tree.props?.children)];
}
const page = "app/maintenance/dashboard/page.tsx";

test("valid login issues worker session and navigates without credentials; invalid PIN stays on login", async () => {
  for (const valid of [true, false]) {
    const f = fixture("MAINTENANCE"); f.values.clear();
    const hash = "$2b$10$" + "a".repeat(53);
    const api = load("app/api/maintenance/session/route.ts", {
      "next/server": { NextResponse: { json } }, "@/lib/session": f.session,
      "@/lib/authThrottle": { admitMaintenanceLogin: async () => ({ admitted: true, property: { id: "p", isActive: true, status: "LIVE" } }) },
      bcryptjs: { compare: async () => valid }, "@/lib/pin": { verifyPin: () => { throw Error("Unexpected credential format"); } },
      "@/lib/prisma": { prisma: { maintenanceUser: { findMany: async () => [{ id: "w", pinHash: hash }], update: async () => ({}) } } },
    });
    const client = ui("app/login/maintenance/MaintenanceLoginClient.tsx", async (url: string, options: FetchOptions) => {
      assert.equal(url, "/api/maintenance/session");
      return response(await api.POST({ json: async () => JSON.parse(requiredText(options.body)) }));
    }, ["1234", "", false]);
    const form = nodes(client.render({ propertyCode: "CODE" })).find(n => n.type === "form");
    await invokeEvent(form,"onSubmit",{ preventDefault() {} });
    assert.equal(client.window.location.href, valid ? "/maintenance/dashboard" : "");
    assert.equal(Boolean(await f.session.getSession()), valid);
    if (valid) assert.equal(requiredValue(await f.session.getSession()).maintenanceUserId, "w");
  }
});

test("operational page loads only existing dashboard projection and retains empty state", async () => {
  for (const empty of [true, false]) {
    const f = backend();
    f.state.rows = empty ? [] : [structuredClone(row), { ...structuredClone(row), id: "foreign", propertyId: "other" }];
    const client = ui(page, f.fetch); client.render(); client.effects[0](); await tick();
    assert.equal(requiredArray(client.states[0]).length, empty ? 0 : 1);
    assert.equal(client.navigations.length, 0);
    const rendered = JSON.stringify(client.render());
    assert.equal(rendered.includes("No maintenance requests."), empty);
    assert.equal(rendered.includes("foreign"), false);
    assert.equal(rendered.includes("tenantName"), false);
    assert.equal(f.calls[0].url, "/api/maintenance/dashboard");
  }
});

for (const role of ["OWNER", "MANAGER", "STAFF", "TENANT", "ADMIN", "anonymous", "inactive", "moved", "other-worker"]) test("operational data unavailable to " + role, async () => {
  const f = backend(["inactive", "moved", "other-worker", "anonymous"].includes(role) ? "MAINTENANCE" : role);
  if (role === "anonymous") f.values.clear();
  if (role === "inactive") requiredValue(f.sessionState.worker).isActive = false;
  if (role === "moved") requiredValue(f.sessionState.worker).propertyId = "other";
  if (role === "other-worker") requiredValue(f.sessionState.worker).id = "different";
  const client = ui(page, f.fetch); client.render(); client.effects[0](); await tick();
  assert.equal(client.states[0], null);
  assert.deepEqual(client.navigations, ["/property-code"]);
});

for (const status of ["OPEN", "IN_PROGRESS", "COMPLETE", "THIRD_PARTY"]) test("worker status control invokes existing API and reloads: " + status, async () => {
  const f = backend(); const client = ui(page, f.fetch); client.render(); client.effects[0](); await tick();
  const select = nodes(client.render()).find(n => n.type === "select");
  invokeEvent(select,"onChange",{ target: { value: status } }); await tick();
  assert.equal(f.state.rows[0].status, status);
  assert.equal(f.state.audits[0].actorMaintenanceUserId, "w");
  assert.deepEqual(f.calls.map(c => c.url), ["/api/maintenance/dashboard", "/api/manager/maintenance/update", "/api/maintenance/dashboard"]);
  assert.equal(requiredRecord(requiredArray(client.states[0])[0]).status, status);
});

test("confirmed worker deletion uses existing API, audit and empty queue; foreign request rejected", async () => {
  const f = backend(); const client = ui(page, f.fetch); client.render(); client.effects[0](); await tick();
  invokeEvent(nodes(client.render()).find(n => n.type === "button" && n.props.children === "Delete request"),"onClick"); await tick();
  assert.equal(f.state.rows.length, 0); assert.equal(f.state.audits[0].action, "MAINTENANCE_REQUEST_DELETED");
  assert.equal(requiredArray(client.states[0]).length, 0);
  f.state.rows = [{ ...structuredClone(row), propertyId: "other" }];
  assert.equal((await f.update.POST({ json: async () => ({ requestId: "r", status: "COMPLETE" }) })).status, 404);
  assert.equal(f.state.rows[0].status, "OPEN");
});

test("logout clears real session through existing authority and returns to entry flow", async () => {
  const f = backend(); const client = ui(page, f.fetch); client.render(); client.effects[0](); await tick();
  invokeEvent(nodes(client.render()).find(n => n.type === "button" && n.props.children === "Logout"),"onClick"); await tick();
  assert.equal(client.window.location.href, "/property-code");
  assert.equal(await f.session.getSession(), null);
  assert.equal((await f.dashboard.GET()).status, 401);
  assert.equal(requiredValue(f.calls.at(-1)).options.method, "DELETE");
});

test("failed actions do not invent success or expose server errors; no management controls", async () => {
  const f = backend(); const client = ui(page, async (url: string, options: FetchOptions) => url === "/api/manager/maintenance/update"
    ? response({ status: 500, body: { error: "private internal detail" } }) : f.fetch(url, options));
  client.render(); client.effects[0](); await tick();
  invokeEvent(nodes(client.render()).find(n => n.type === "select"),"onChange",{ target: { value: "COMPLETE" } }); await tick();
  assert.equal(requiredRecord(requiredArray(client.states[0])[0]).status, "OPEN");
  assert.equal(requiredText(client.states[1]).includes("private internal"), false);
  assert.equal(f.state.audits.length, 0);
  assert.deepEqual(nodes(client.render()).filter(n => n.type === "button").map(n => n.props.children), ["Logout", "Delete request"]);
});
