import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

const root = resolve(__dirname, "../..");
function load(file: string, imports: Record<string, any>, extras = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Buffer, Date, URL,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "batch1-isolated" } },
    require(name: string) { if (!(name in imports)) throw Error("Unexpected import: " + name); return imports[name]; }, ...extras });
  return module.exports;
}
function nodes(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function fixture() {
  let clock = Date.now();
  class Clock extends Date { static now() { return clock; } }
  let token: string | undefined;
  let state = { requests: [{ id: "request", propertyName: "Requested Property", createdAt: new Date(),
    propertyType: "Apartment", address: "Address", contactName: "Contact", contactInfo: "contact@isolated.invalid" }], properties: [] as any[] };
  const operations: string[] = [];
  let failDelete = false;
  let inTransaction = false;
  const prisma: any = {
    adminAccess: { findUnique: async ({ where }: any) => where.id === "admin" ? { id: "admin", isActive: true } : null },
    managementUser: { findUnique: async () => ({ id: "user", propertyId: "a", isActive: true, role: currentRole }) },
    tenantAssignment: { findUnique: async () => ({ id: "assignment", propertyId: "a", unitId: "unit", isCurrent: true,
      moveOutDate: null, unit: { id: "unit", propertyId: "a" } }) },
    setupRequest: {
      findMany: async () => { operations.push("requests.read"); return state.requests; },
      findUnique: async ({ where }: any) => { operations.push("request.read"); return state.requests.find(r => r.id === where.id) ?? null; },
      delete: async ({ where }: any) => { operations.push("request.delete"); if (failDelete) throw Error("Delete failed");
        const row = state.requests.find(r => r.id === where.id); if (!row) throw Error("Request not found");
        state.requests = state.requests.filter(r => r.id !== where.id); return row; },
    },
    property: {
      findUnique: async ({ where }: any) => { operations.push("property.read"); return where.id === "missing" ? null :
        { id: where.id, name: "Arbitrary Property", tiers: [], isActive: true, status: "SETUP" }; },
      create: async ({ data }: any) => { expect(inTransaction).toBe(true); operations.push("property.create");
        const row = { ...data, id: "created" }; state.properties.push(row); return row; },
    },
    $transaction: async (fn: any) => { const before = structuredClone(state); inTransaction = true;
      try { return await fn(prisma); } catch (error) { state = before; throw error; } finally { inTransaction = false; } },
  };
  let currentRole = "ADMIN";
  const session = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma } }, { Date: Clock });
  function use(kind: string) {
    currentRole = kind;
    if (kind === "absent") { token = undefined; return; }
    if (kind === "malformed") { token = "broken"; return; }
    clock = Date.now();
    token = session.createSessionToken(kind === "expired" || kind === "signature-invalid" ? { role: "ADMIN", adminAccessId: "admin" } :
      kind === "TENANT" ? { role: kind, propertyId: "a", unitId: "unit", tenantAssignmentId: "assignment" } :
      kind === "MAINTENANCE" ? { role: kind, propertyId: "a", maintenanceUserId: "worker" } :
      kind === "ADMIN" ? { role: kind, adminAccessId: "admin" } : { role: kind, propertyId: "a", managementUserId: "user" });
    if (kind === "expired") clock += 8 * 86400000;
    if (kind === "signature-invalid") { const index = token!.lastIndexOf(".") + 1; token = token!.slice(0, index) + (token![index] === "a" ? "b" : "a") + token!.slice(index + 1); }
  }
  const jsx = (_type: any, props: any) => ({ type: _type, props });
  const imports = { "@/lib/prisma": { prisma }, "@/lib/session": session,
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "next/navigation": { redirect: (url: string) => { throw Error("REDIRECT:" + url); }, notFound: () => { throw Error("NOT_FOUND"); } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": () => null,
    "@/components/admin/AdminSupportTools": () => null };
  const requests = load("app/admin/requests/page.tsx", imports).default;
  const property = load("app/admin/properties/[id]/page.tsx", imports).default;
  use("ADMIN");
  return { use, requests, property, operations, state: () => state, failDelete: () => { failDelete = true; } };
}
const denied = ["absent", "malformed", "signature-invalid", "expired", "TENANT", "OWNER", "MANAGER", "STAFF", "MAINTENANCE"];
for (const kind of denied) {
  for (const page of ["requests", "property"] as const) test(`${kind}: ${page} rejects before protected data`, async () => {
    const f = fixture(); f.use(kind);
    await expect(page === "requests" ? f.requests() : f.property({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("REDIRECT:/login/admin");
    expect(f.operations).toEqual([]);
  });
  for (const actionIndex of [0, 1]) test(`${kind}: rendered action ${actionIndex} independently rejects`, async () => {
    const f = fixture(); const tree = await f.requests();
    const forms = nodes(tree).filter(n => n.type === "form"); const action = forms[actionIndex].props.action;
    f.operations.length = 0; f.use(kind); const form = new FormData(); form.set("id", "request");
    await expect(action(form)).rejects.toThrow(); expect(f.operations).toEqual([]);
    expect(f.state().requests).toHaveLength(1); expect(f.state().properties).toHaveLength(0);
  });
}
test("ADMIN renders requests and arbitrary property globally", async () => {
  const f = fixture(); expect(JSON.stringify(await f.requests())).toContain("Requested Property");
  expect(JSON.stringify(await f.property({ params: Promise.resolve({ id: "foreign" }) }))).toContain("Arbitrary Property");
});
for (const fail of [false, true]) test(`ADMIN approval atomic; delete failure=${fail}`, async () => {
  const f = fixture(); const action = nodes(await f.requests()).find(n => n.type === "form")!.props.action;
  f.operations.length = 0; if (fail) f.failDelete(); const form = new FormData(); form.set("id", "request");
  await expect(action(form)).rejects.toThrow(fail ? "Delete failed" : "REDIRECT:/admin/properties/created");
  expect(f.state().properties).toHaveLength(fail ? 0 : 1); expect(f.state().requests).toHaveLength(fail ? 1 : 0);
  expect(f.operations).toEqual(["request.read", "property.create", "request.delete"]);
});
test("ADMIN rejection deletes only selected request", async () => {
  const f = fixture(); f.state().requests.push({ ...f.state().requests[0], id: "other" });
  const forms = nodes(await f.requests()).filter(n => n.type === "form"); const form = new FormData(); form.set("id", "request");
  await expect(forms[1].props.action(form)).rejects.toThrow("REDIRECT:/admin/requests");
  expect(f.state().requests.map(r => r.id)).toEqual(["other"]); expect(f.state().properties).toHaveLength(0);
});
for (const index of [0, 1]) for (const id of ["", "missing"]) test(`ADMIN action ${index} retains missing-id behavior ${id}`, async () => {
  const f = fixture(); const forms = nodes(await f.requests()).filter(n => n.type === "form");
  const form = new FormData(); form.set("id", id); await expect(forms[index].props.action(form)).rejects.toThrow(id ? "Request not found" : "Missing request id");
  expect(f.state().properties).toHaveLength(0); expect(f.state().requests).toHaveLength(1);
});
test("ADMIN missing property retains notFound", async () => {
  const f = fixture(); await expect(f.property({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NOT_FOUND");
});
