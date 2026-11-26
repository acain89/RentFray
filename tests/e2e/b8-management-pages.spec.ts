import { callVm, httpFacade, requiredRecord, requiredArray, requiredText, requiredValue, isRecord, isElement, invokeEvent } from "../fixture-assertions";
import type { Session } from "../admin-session-revalidation.fixture";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

const root = resolve(__dirname, "../..");
const tenantFile = "app/manager/units/[id]/tenants/page.tsx";
const historyFile = "app/manager/units/[id]/history/page.tsx";
const lifecycleFile = "app/api/admin/properties/[id]/lifecycle/route.ts";
function load(file:"lib/session.ts",imports:Record<string,unknown>,extras?:Record<string,unknown>):Session;
function load(file:"lib/pin.ts",imports:Record<string,unknown>,extras?:Record<string,unknown>):typeof import("../../lib/pin");
function load(file:"lib/liveGating.ts",imports:Record<string,unknown>,extras?:Record<string,unknown>):typeof import("../../lib/liveGating");
function load(file:string,imports:Record<string,unknown>,extras?:Record<string,unknown>):ReturnType<typeof httpFacade> & {default(props?:unknown):Promise<unknown>};
function load(file: string, imports: Record<string, unknown>, extras: Record<string, unknown> = {}):unknown {
  const fixtureModule: {exports:unknown} = {exports:{}};
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "synthetic-b8-isolated-secret-session-secret-key" } },
    console: { error() {} },
    require(name: string) { if (!(name in imports)) throw new Error("Unexpected import " + name); return imports[name]; },
    ...extras,
  });
  const namespace=fixtureModule.exports; return file.startsWith("lib/")?namespace:{...httpFacade(namespace),default:(...args:unknown[])=>callVm(namespace,"default",...args)};
}
// Validate executed query keys against schema source, independently of the weak global Prisma typing.
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const models: Record<string, Record<string, string>> = {};
for (const match of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
  models[match[1]] = Object.fromEntries([...match[2].matchAll(/^\s+(\w+)\s+(\w+)/gm)].map(m => [m[1], m[2]]));
}
function whereKeys(model:string,where:unknown={}) {
 for(const [key,value] of Object.entries(requiredRecord(where))) {
  if(["AND","OR","NOT"].includes(key)) { const parts:unknown[]=Array.isArray(value)?value:[value]; for(const part of parts)whereKeys(model,part); }
  else { expect(models[model]).toHaveProperty(key);const relation=models[model][key];if(models[relation]&&isRecord(value))whereKeys(relation,value.some??value.is??value.every??value.none??value); }
 }
}
function queryKeys(model:string,args:unknown={}) {
 const query=requiredRecord(args);whereKeys(model,query.where);
 for(const selection of [query.select,query.include])for(const [key,value] of Object.entries(requiredRecord(selection??{}))) {expect(models[model]).toHaveProperty(key);if(isRecord(value))queryKeys(models[model][key],value);}
 const orders:unknown[]=Array.isArray(query.orderBy)?query.orderBy:[query.orderBy];
 for(const order of orders)for(const key of Object.keys(requiredRecord(order??{})))expect(models[model]).toHaveProperty(key);
 for(const key of Object.keys(requiredRecord(query.data??{})))expect(models[model]).toHaveProperty(key);
}
function matches(row:unknown,where:unknown={}):boolean {
 return Object.entries(requiredRecord(where)).every(([key,value])=>{
  if(key==="OR")return requiredArray(value).some(part=>matches(row,part));
  const field=requiredRecord(row)[key];
  if(isRecord(value)&&!(value instanceof Date)) {
   if("some" in value)return requiredArray(field??[]).some(part=>matches(part,value.some));
   if("gt" in value) {const [left,right]=typeof field==="string"&&typeof value.gt==="string"?[field,value.gt]:[Number(field),Number(value.gt)];return field!==null&&left>right;}
  }
  return field===value;
 });
}
type Args={where:unknown;include?:{tenantAssignments?:{where:unknown}};data?:unknown};
function fixture(role: string = "OWNER") {
  let clock = Date.now();
  class Clock extends Date { static now() { return clock; } }
  const initialState = {
    property: { id: "property", name: "Test Property", propertyCode: "CODE", status: "TEST",
      settings: {}, units: [{ id: "unit" }], paymentStatus: { processorConnected: true,
        chargesEnabled: true, payoutsEnabled: true, onboardingComplete: true } },
    unit: { id: "unit", propertyId: "property", unitNumber: "101", tenantPinHash: "old-hash",
      property: { name: "Test Property", propertyCode: "CODE" }, tenantAssignments: [
        { id: "assignment", propertyId: "property", unitId: "unit", firstName: "Current", lastName: "Tenant",
          email: "tenant@isolated.invalid", phone: "555", isCurrent: true,
          moveInDate: new Date("2026-01-01"), moveOutDate: null, createdAt: new Date("2026-01-01") },
        { id: "past", propertyId: "property", unitId: "unit", firstName: "Previous", lastName: "Tenant",
          isCurrent: false, moveInDate: new Date("2025-01-01"), moveOutDate: new Date("2025-12-31") },
      ] },
    management: { id: "user", propertyId: "property", role, isActive: true, passwordHash: "synthetic-credential" }, audits: [] as Partial<import("@prisma/client").AuditLog>[], failAudit: false,
  };
  let state: Omit<typeof initialState,"management"> & {management:typeof initialState.management|null}=initialState;
  let inTransaction = false; let reads = 0;
  const delegates = {
    adminAccess: { findUnique: async ({ where }: {where:{id:string}}) => where.id === "admin" ? { id: "admin", isActive: true } : null },
    maintenanceUser: { findUnique: async ({ where }: {where:{id:string}}) => where.id === "maintenance" ? { id: "maintenance", propertyId: "property", isActive: true } : null },
    managementUser: { findUnique: async () => structuredClone(state.management) },
    tenantAssignment: { findUnique: async () => ({ ...structuredClone(state.unit.tenantAssignments[0]),
      unit: { id: state.unit.id, propertyId: state.unit.propertyId } }) },
    property: {
      findUnique: async (args: Args) => { reads++; queryKeys("Property", args); return matches(state.property, args.where) ? structuredClone(state.property) : null; },
      update: async (args: Args) => { expect(inTransaction).toBe(true); queryKeys("Property", args);
        if (!matches(state.property, args.where)) throw new Error("Status changed concurrently");
        Object.assign(state.property, args.data);
        return { id: state.property.id, name: state.property.name, propertyCode: state.property.propertyCode, status: state.property.status };
      },
    },
    unit: {
      findFirst: async (args: Args) => { reads++; queryKeys("Unit", args);
        if (!matches(state.unit, args.where)) return null;
        const unit = structuredClone(state.unit);
        const selection = args.include?.tenantAssignments;
        if (selection) unit.tenantAssignments = unit.tenantAssignments.filter((a) => matches(a, selection.where));
        return unit;
      },
      update: async (args: Args) => { expect(inTransaction).toBe(true); queryKeys("Unit", args);
        if (!matches(state.unit, args.where)) throw new Error("Assignment no longer current");
        Object.assign(state.unit, args.data); return structuredClone(state.unit);
      },
    },
    auditLog: { create: async (args: Args) => { expect(inTransaction).toBe(true); queryKeys("AuditLog", args);
      if (state.failAudit) throw new Error("Audit failed");
      state.audits.push(structuredClone(requiredRecord(args.data))); return args.data;
    } },
  };
  const prisma={...delegates,$transaction:async <Result>(fn:(tx:typeof delegates)=>Promise<Result>):Promise<Result> => { const snapshot = structuredClone(state); inTransaction = true;
      try { return await fn(prisma); } catch (error) { state = snapshot; throw error; } finally { inTransaction = false; }
    },
  };
  let token: string | undefined;
  const session = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({
    get: () => token ? { value: token } : undefined, set() { throw new Error("Unexpected session write"); },
  }) }, "@/lib/prisma": { prisma } }, { Date: Clock });
  token = session.createSessionToken({ role, ...(role === "ADMIN" ? { adminAccessId: "admin" } : {}), propertyId: "property", managementUserId: "user",
    ...(["OWNER", "MANAGER", "STAFF"].includes(role) ? { managementCredentialBinding: session.createManagementCredentialBinding("user", requiredValue(state.management).passwordHash) } : {}),
    ...(role === "TENANT" ? { unitId: "unit", tenantAssignmentId: "assignment" } : {}),
    ...(role === "MAINTENANCE" ? { maintenanceUserId: "maintenance" } : {}),
  });
  const pin = load("lib/pin.ts", { crypto });
  const readiness = load("lib/liveGating.ts", {});
  const jsx = (type:unknown,props:Record<string,unknown>) => ({ type, props });
  const imports = {
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma }, "@/lib/session": session,
    "@/lib/pin": pin, "@/lib/liveGating": readiness,
    "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number; headers?: HeadersInit }) => ({ body, status: options?.status ?? 200 }) } },
    "next/navigation": { notFound() { throw new Error("Not found"); }, redirect(url: string) { throw new Error("Redirect:" + url); } },
    "next/link": (props:Record<string,unknown>) => jsx("a", props), "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
  };
  return { state: () => state, reads: () => reads, session, pin, readiness,
    page: (file: string) => load(file, imports),
    params: (id = "unit") => ({ params: Promise.resolve({ id }) }),
    lifecycle: () => load(lifecycleFile, imports),
    post: (status: string) => ({ json: async () => ({ status, reason: "isolated" }) }),
    token: (value?: string) => { token = value; },
    expire: () => { clock += 366 * 24 * 60 * 60 * 1000; },
  };
}
function nodes(node:unknown):{type:unknown;props:Record<string,unknown>}[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isElement(node)) return [];
  if (typeof node.type === "function") return nodes(Reflect.apply(node.type,node,[node.props]));
  return [node, ...nodes(node.props?.children)];
}
function text(node:unknown): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if(!isElement(node))return "";
  if (typeof node.type === "function") return text(Reflect.apply(node.type,node,[node.props]));
  return text(node.props?.children);
}
const roles = ["OWNER", "MANAGER", "STAFF"];
for (const role of roles) {
  test(`${role} sees same-property current tenant and history`, async () => {
    const f = fixture(role);
    const tenant = await f.page(tenantFile).default(f.params());
    expect(text(tenant)).toContain("Current Tenant"); expect(text(tenant)).toContain("CODE");
    const actions = nodes(tenant).filter(n => n.type === "form");
    expect(actions.length).toBe(role === "STAFF" ? 0 : 1);
    const history = await f.page(historyFile).default(f.params());
    expect(text(history)).toContain("Previous Tenant"); expect(text(history)).toContain("101");
  });
}
for (const file of [tenantFile, historyFile]) {
  test(`${file} rejects foreign and missing units`, async () => {
    const f = fixture(); f.state().unit.propertyId = "foreign";
    await expect(f.page(file).default(f.params())).rejects.toThrow("Not found");
    await expect(f.page(file).default(f.params("missing"))).rejects.toThrow("Not found");
  });
  for (const role of ["ADMIN", "TENANT", "MAINTENANCE"]) {
    test(`${file} rejects ${role}`, async () => {
      const f = fixture(role); await expect(f.page(file).default(f.params())).rejects.toThrow("Forbidden");
      expect(f.reads()).toBe(0);
    });
  }
}
test("history and tenant page preserve a future scheduled departure", async () => {
  const f = fixture(); f.state().unit.tenantAssignments[0].moveOutDate = new Date(Date.now() + 86400000);
  expect(text(await f.page(historyFile).default(f.params()))).toContain("Scheduled move-out:");
  expect(text(await f.page(tenantFile).default(f.params()))).toContain("Current Tenant");
});
async function pinAction(f: ReturnType<typeof fixture>) {
  const page = await f.page(tenantFile).default(f.params());
  const form=requiredValue(nodes(page).find(n=>n.type==="form"));return (data:unknown)=>Promise.resolve(invokeEvent(form,"action",data));
}
const pinForm = { get: (name: string) => name === "pin" ? "1234" : null };
for (const role of ["OWNER", "MANAGER"]) {
  test(`${role} PIN action updates current Unit PIN and audit atomically`, async () => {
    const f = fixture(role); const reset = await pinAction(f); await reset(pinForm);
    expect(f.pin.verifyPin("1234", f.state().unit.tenantPinHash)).toBe(true);
    expect(f.state().audits).toHaveLength(1);
    expect(JSON.parse(requiredText(f.state().audits[0].metadataJson)).tenantAssignmentId).toBe("assignment");
  });
}
test("rendered PIN action revalidates STAFF authority on direct invocation", async () => {
  const f = fixture(); const reset = await pinAction(f);
  requiredValue(f.state().management).role = "STAFF";
  f.token(f.session.createSessionToken({ role: "STAFF", propertyId: "property", managementUserId: "user", managementCredentialBinding: f.session.createManagementCredentialBinding("user", requiredValue(f.state().management).passwordHash) }));
  await expect(reset(pinForm)).rejects.toThrow("Forbidden");
  expect(f.state().unit.tenantPinHash).toBe("old-hash"); expect(f.state().audits).toEqual([]);
});
for (const change of ["replaced", "vacated", "foreign-unit", "foreign-session"]) {
  test(`PIN action rejects ${change} identity`, async () => {
    const f = fixture(); const reset = await pinAction(f);
    if (change === "replaced") f.state().unit.tenantAssignments[0].id = "replacement";
    if (change === "vacated") f.state().unit.tenantAssignments[0].moveOutDate = new Date("2000-01-01");
    if (change === "foreign-unit") f.state().unit.propertyId = "foreign";
    if (change === "foreign-session") {
      requiredValue(f.state().management).propertyId = "foreign";
      f.token(f.session.createSessionToken({ role: "OWNER", propertyId: "foreign", managementUserId: "user", managementCredentialBinding: f.session.createManagementCredentialBinding("user", requiredValue(f.state().management).passwordHash) }));
    }
    await expect(reset(pinForm)).rejects.toThrow();
    expect(f.state().unit.tenantPinHash).toBe("old-hash"); expect(f.state().audits).toEqual([]);
  });
}
test("PIN audit failure rolls back the update", async () => {
  const f = fixture(); const reset = await pinAction(f); f.state().failAudit = true;
  await expect(reset(pinForm)).rejects.toThrow("Audit failed");
  expect(f.state().unit.tenantPinHash).toBe("old-hash");
});
for (const role of ["OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE"]) {
  test(`lifecycle GET/POST reject ${role} before property access`, async () => {
    const f = fixture(role); const route = f.lifecycle();
    expect((await route.GET({}, f.params("property"))).status).toBe(401);
    expect((await route.POST(f.post("READY"), f.params("property"))).status).toBe(401);
    expect(f.reads()).toBe(0);
  });
}
test("ADMIN lifecycle GET uses current schema and actual readiness SSOT", async () => {
  const f = fixture("ADMIN"); const response = await f.lifecycle().GET({}, f.params("property"));
  expect(response.status).toBe(200); expect(response.body.readiness).toEqual(f.readiness.getLiveReadiness(f.state().property));
  expect(requiredRecord(response.body.readiness).chargesEnabled).toBe(true);
  expect(requiredRecord(requiredRecord(response.body.property).paymentStatus).processorConnected).toBe(true);
});
test("ADMIN allowed transition writes status and current audit", async () => {
  const f = fixture("ADMIN"); const response = await f.lifecycle().POST(f.post("READY"), f.params("property"));
  expect(response.status).toBe(200); expect(f.state().property.status).toBe("READY");
  expect(f.state().audits[0].actorType).toBe("ADMIN"); expect(response.body.previousStatus).toBe("TEST");
});
test("ADMIN disallowed transition changes nothing", async () => {
  const f = fixture("ADMIN"); f.state().property.status = "LIVE";
  expect((await f.lifecycle().POST(f.post("SETUP"), f.params("property"))).status).toBe(400);
  expect(f.state().property.status).toBe("LIVE"); expect(f.state().audits).toEqual([]);
});
for (const ready of [false, true]) {
  test(`LIVE gating follows actual readiness ${ready}`, async () => {
    const f = fixture("ADMIN"); f.state().property.status = "READY";
    f.state().property.paymentStatus.payoutsEnabled = ready;
    const response = await f.lifecycle().POST(f.post("LIVE"), f.params("property"));
    expect(response.status).toBe(ready ? 200 : 400);
    expect(f.state().property.status).toBe(ready ? "LIVE" : "READY");
  });
}
test("lifecycle audit failure rolls back property status", async () => {
  const f = fixture("ADMIN"); f.state().failAudit = true;
  expect((await f.lifecycle().POST(f.post("READY"), f.params("property"))).status).toBe(500);
  expect(f.state().property.status).toBe("TEST"); expect(f.state().audits).toEqual([]);
});
const redirects = [
  ["app/manager/properties/[id]/page.tsx", "/manager/dashboard"],
  ["app/manager/properties/[id]/units/new/page.tsx", "/manager/dashboard?panel=rent"],
  ["app/manager/properties/new/page.tsx", "/manager/dashboard"],
];
for (const [file, destination] of redirects) {
  for (const role of roles) {
    test(`${file} redirects authorized ${role} without database mutation`, async () => {
      const f = fixture(role);
      await expect(f.page(file).default(f.params("property"))).rejects.toThrow("Redirect:" + destination);
      expect(f.reads()).toBe(0); expect(f.state().audits).toEqual([]);
    });
  }
  test(`${file} rejects non-management`, async () => {
    const f = fixture("ADMIN"); await expect(f.page(file).default(f.params("property"))).rejects.toThrow("Forbidden");
  });
  if (file.includes("[id]")) {
    test(`${file} rejects foreign property rather than forwarding it`, async () => {
      const f = fixture(); await expect(f.page(file).default(f.params("foreign"))).rejects.toThrow("Not found");
    });
  }
  test(`${file} retains no server creation action and does not target itself`, () => {
    const source = readFileSync(resolve(root, file), "utf8");
    expect(source).not.toContain('"use server"'); expect(source).not.toContain("prisma");
    expect(destination).not.toContain("/manager/properties");
  });
}
for (const invalid of ["missing", "malformed", "expired", "disabled", "deleted", "demoted", "moved"]) {
  test(`B4b current session authority rejects ${invalid} management cookie`, async () => {
    const f = fixture();
    if (invalid === "missing") f.token();
    if (invalid === "malformed") f.token("invalid");
    if (invalid === "expired") f.expire();
    if (invalid === "disabled") requiredValue(f.state().management).isActive = false;
    if (invalid === "deleted") f.state().management = null;
    if (invalid === "demoted") requiredValue(f.state().management).role = "STAFF";
    if (invalid === "moved") requiredValue(f.state().management).propertyId = "other";
    expect(await f.session.getSession()).toBeNull();
  });
}
for (const change of ["valid", "vacated", "replaced", "foreign-unit", "unit-only-cookie"]) {
  test(`B4a assignment binding remains authoritative: ${change}`, async () => {
    const f = fixture("TENANT");
    if (change === "vacated") f.state().unit.tenantAssignments[0].isCurrent = false;
    if (change === "replaced") f.state().unit.tenantAssignments[0].unitId = "other";
    if (change === "foreign-unit") f.state().unit.propertyId = "other";
    if (change === "unit-only-cookie") {
      const payload = { role: "TENANT", propertyId: "property", unitId: "unit",
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = crypto.createHmac("sha256", "synthetic-b8-isolated-secret-session-secret-key").update(encoded).digest("base64url");
      f.token(encoded + "." + signature);
    }
    expect(Boolean(await f.session.getSession())).toBe(change === "valid");
  });
}

test("missing ADMIN session rejects lifecycle reads and writes", async () => {
  const f = fixture("ADMIN"); f.token(); const route = f.lifecycle();
  expect((await route.GET({}, f.params("property"))).status).toBe(401);
  expect((await route.POST(f.post("READY"), f.params("property"))).status).toBe(401);
  expect(f.reads()).toBe(0);
});
test("missing lifecycle property returns 404 without audit", async () => {
  const f = fixture("ADMIN"); const route = f.lifecycle();
  expect((await route.GET({}, f.params("missing"))).status).toBe(404);
  expect((await route.POST(f.post("READY"), f.params("missing"))).status).toBe(404);
  expect(f.state().audits).toEqual([]);
});
test("invalid lifecycle status is rejected before querying property", async () => {
  const f = fixture("ADMIN");
  expect((await f.lifecycle().POST(f.post("ARBITRARY"), f.params("property"))).status).toBe(400);
  expect(f.reads()).toBe(0); expect(f.state().audits).toEqual([]);
});
test("PIN action rejects invalid PIN without mutation", async () => {
  const f = fixture(); const reset = await pinAction(f);
  await expect(reset({ get: () => "12345" })).rejects.toThrow("exactly 4 digits");
  expect(f.state().unit.tenantPinHash).toBe("old-hash"); expect(f.state().audits).toEqual([]);
});
test("vacant unit retains view but has no PIN reset control", async () => {
  const f = fixture(); f.state().unit.tenantAssignments = [];
  const page = await f.page(tenantFile).default(f.params());
  expect(text(page)).toContain("No active tenant");
  expect(nodes(page).some(n => n.type === "form")).toBe(false);
});
