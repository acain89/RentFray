import { callVm, httpFacade, isElement, isRecord, requiredRecord, recordRows } from "../fixture-assertions";
import type { Session } from "../admin-session-revalidation.fixture";
import type { UnitNote } from "@prisma/client";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

const root = resolve(__dirname, "../..");
function load(file:"lib/session.ts",imports:Record<string,unknown>,extras?:Record<string,unknown>):Session;
function load(file:string,imports:Record<string,unknown>,extras?:Record<string,unknown>):ReturnType<typeof httpFacade> & {default(props?:unknown):Promise<unknown>};
function load(file:string,imports:Record<string,unknown>,extras:Record<string,unknown>={}):unknown {
  const fixtureModule: {exports:unknown}={exports:{}};
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module: fixtureModule, exports: fixtureModule.exports, Buffer, Date, URL,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "synthetic-batch1-notes-session-secret-key" } }, console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unexpected import " + name); return imports[name]; }, ...extras });
  const namespace=fixtureModule.exports;return file==="lib/session.ts"?namespace:{...httpFacade(namespace),default:(...args:unknown[])=>callVm(namespace,"default",...args)};
}
function fixture(role = "OWNER") {
  let clock = Date.now(); class Clock extends Date { static now() { return clock; } }
  let token: string | undefined;
  let reads = 0, writes = 0, failWrite = false;
  const events: {type:string;data:Record<string,unknown>}[] = [];
  const units = [{ id: "unit", propertyId: "a" }, { id: "foreign", propertyId: "b" }];
  type Note=Partial<UnitNote>&Pick<UnitNote,"id"|"unitId"|"propertyId"|"content"|"isPinned">;
  const notes: Note[] = [
    { id: "note", unitId: "unit", propertyId: "a", content: "Legitimate note", noteType: "GENERAL", isPinned: false, createdAt: new Date("2026-01-02") },
    { id: "pinned", unitId: "unit", propertyId: "a", content: "Pinned note", noteType: "PAYMENT", isPinned: true, createdAt: new Date("2026-01-01") },
    { id: "foreign-note", unitId: "foreign", propertyId: "b", content: "Protected foreign note", isPinned: false },
    { id: "bad-pair", unitId: "foreign", propertyId: "a", content: "Inconsistent pair", isPinned: false },
    { id: "foreign-property", unitId: "unit", propertyId: "b", content: "Foreign property leak", isPinned: false },
  ];
  function matches(row:unknown,where:unknown={}):boolean {
    return Object.entries(requiredRecord(where)).every(([key,value])=>key==="unit"
      ?matches(units.find(unit=>unit.id===(isRecord(row)?row.unitId:undefined)),requiredRecord(value).is??value)
      :(isRecord(row)?row[key]:undefined)===value);
  }
  type Args={where:Record<string,unknown>;include?:{notes:{where:unknown}};orderBy?:unknown};
  const prisma = {
    adminAccess: { findUnique: async ({ where }: {where:{id:string}}) => where.id === "admin" ? { id: "admin", isActive: true } : null },
    managementUser: { findUnique: async () => ({ id: "user", propertyId: "a", role, isActive: true, passwordHash: "synthetic-credential" }) },
    tenantAssignment: { findUnique: async () => ({ id: "assignment", unitId: "unit", propertyId: "a", isCurrent: true,
      moveOutDate: null, unit: units[0] }) },
    unit: { findFirst: async (args: Args) => { reads++; const unit = units.find(u => matches(u, args.where));
      if (!unit) return null; const include=args.include; if (!include) return unit;
      expect(include.notes.where).toEqual({ propertyId: "a" });
      return { ...unit, unitNumber: "101", isActive: true, tier: null, tenantAssignments: [{ id: "assignment", firstName: "Current", lastName: "Tenant", moveInDate: new Date("2026-01-01") }], ledgerEntries: [], payments: [], recurringFeeItems: [],
        maintenanceRequests: [], property: { id: "a", name: "Property", settings: null },
        notes: notes.filter(n => n.unitId === unit.id && matches(n, include.notes.where)) }; } },
    unitNote: {
      findMany: async (args: Args) => { reads++; expect(args.orderBy).toEqual([{ isPinned: "desc" }, { createdAt: "desc" }]);
        return notes.filter(n => matches(n, args.where)).sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(b.createdAt) - Number(a.createdAt)); },
      findFirst: async (args: Args) => { reads++; return notes.find(n => matches(n, args.where)) ?? null; },
      create: async ({ data }: {data:Omit<Note,"id">}) => { if (failWrite) throw Error("Write failed");
        expect(units.some(u => u.id === data.unitId && u.propertyId === data.propertyId)).toBe(true);
        writes++; const note = { ...data, id: "new", createdAt: new Date() }; notes.push(note); return note; },
      update: async (args: Args&{data:Partial<Note>}) => { if (failWrite) throw Error("Write failed");
        expect(args.where.propertyId).toBe("a"); expect(args.where.unit).toEqual({ propertyId: "a" });
        const note = notes.find(n => matches(n, args.where)); if (!note) throw Error("Not found");
        writes++; Object.assign(note, args.data); return note; },
    },
  };
  const session = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma } }, { Date: Clock });
  if (!["absent", "malformed"].includes(role)) token = session.createSessionToken(role === "ADMIN" || ["signature-invalid", "expired"].includes(role)
    ? { role: "ADMIN", adminAccessId: "admin" } : role === "TENANT" ? { role, propertyId: "a", unitId: "unit", tenantAssignmentId: "assignment" }
    : role === "MAINTENANCE" ? { role, propertyId: "a", maintenanceUserId: "worker" }
    : { role, propertyId: "a", managementUserId: "user", managementCredentialBinding: session.createManagementCredentialBinding("user", "synthetic-credential") });
  if (role === "malformed") token = "broken";
  if (role === "signature-invalid") { const index = token!.lastIndexOf(".") + 1; token = token!.slice(0, index) + (token![index] === "a" ? "b" : "a") + token!.slice(index + 1); }
  if (role === "expired") clock += 8 * 86400000;
  const api = load("app/api/notes/route.ts", { "@/lib/session": session, "@/lib/prisma": { prisma },
    "@/lib/realtime": { emitEvent: (type: string, data: Record<string,unknown>) => events.push({ type, data }) },
    "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number; headers?: HeadersInit }) => ({ body, status: options?.status ?? 200 }) } } });
  const jsx = (type:unknown,props:Record<string,unknown>) => ({ type, props });
  const control = () => null;
  const paymentControl = () => null;
  const chargeControl = () => null;
  const rentControl = () => null;
  const page = load("app/manager/units/[id]/page.tsx", { "@/lib/session": session, "@/lib/prisma": { prisma },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": control,
    "./ManualPaymentForm": paymentControl, "./ManualChargeForm": chargeControl, "./PostRentButton": rentControl,
    "@/lib/unitFinancialState": { getUnitFinancialState: async () => ({
      ledgerBalanceCents: 0, hasPendingPayment: false, daysPastDue: 0,
      ledgerSummary: { totalChargesCents: 0, totalPaidCents: 0, currentCycleRentChargesCents: 0 },
      status: { status: "PAID", label: "Paid", tenantMessage: "Your balance is paid." }, paymentStatus: "PAID",
      effectiveBillingSettings: { dueDay: 1, gracePeriodDays: 0, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 },
      rentDates: { dueDate: "2026-10-01", nextDueDate: "2026-11-01" },
    }) },
  }).default;
  return { api, page, controls: [paymentControl, chargeControl, rentControl], notes, events, counts: () => ({ reads, writes }), fail: () => { failWrite = true; } };
}
const getRequest = (unitId = "unit") => ({ nextUrl: new URL("https://isolated.invalid/api/notes?unitId=" + unitId) });
const postRequest = (body: unknown) => ({ json: async () => body });
for (const role of ["OWNER", "MANAGER", "STAFF", "TENANT", "MAINTENANCE", "ADMIN", "absent", "malformed", "signature-invalid", "expired"]) {
  test(`${role}: GET policy and no rejected disclosure`, async () => {
    const f = fixture(role); const response = await f.api.GET(getRequest());
    const allowed = ["OWNER", "MANAGER", "STAFF"].includes(role);
    expect(response.status).toBe(allowed ? 200 : 401);
    if (allowed) { expect(response.body.ok).toBe(true); expect(recordRows(response.body.data).map(n=>n.id)).toEqual(["pinned", "note"]); }
    else { expect(response.body).toEqual({ ok: false, error: "Unauthorized" }); expect(f.counts()).toEqual({ reads: 0, writes: 0 }); }
  });
  for (const action of ["CREATE", "PIN_TOGGLE"]) test(`${role}: ${action} policy`, async () => {
    const f = fixture(role); const response = await f.api.POST(postRequest({ action, unitId: "unit", noteId: "note", content: " New note " }));
    const allowed = ["OWNER", "MANAGER"].includes(role); expect(response.status).toBe(allowed ? 200 : 401);
    expect(f.counts().writes).toBe(allowed ? 1 : 0); expect(f.events).toHaveLength(allowed ? 1 : 0);
    if (allowed) expect(f.events[0]).toEqual({ type: "admin:notes:update", data: { propertyId: "a", unitId: "unit" } });
    else expect(f.counts().reads).toBe(0);
  });
}
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(`${role}: foreign GET rejects without data`, async () => {
  const f = fixture(role); expect(await f.api.GET(getRequest("foreign"))).toEqual({ status: 404, body: { ok: false, error: "Unit not found" } });
  expect(f.counts()).toEqual({ reads: 1, writes: 0 });
});
for (const role of ["OWNER", "MANAGER"]) {
  test(`${role}: foreign CREATE rejects`, async () => {
    const f = fixture(role); expect((await f.api.POST(postRequest({ unitId: "foreign", content: "x" }))).status).toBe(404);
    expect(f.counts().writes).toBe(0); expect(f.events).toEqual([]);
  });
  for (const noteId of ["foreign-note", "bad-pair", "foreign-property", "missing"]) test(`${role}: rejects ${noteId} pin`, async () => {
    const f = fixture(role); expect((await f.api.POST(postRequest({ action: "PIN_TOGGLE", noteId }))).status).toBe(404);
    expect(f.counts().writes).toBe(0); expect(f.events).toEqual([]);
  });
}
test("supplied mismatching unit rejects pin", async () => {
  const f = fixture(); expect((await f.api.POST(postRequest({ action: "PIN_TOGGLE", noteId: "note", unitId: "foreign" }))).status).toBe(404);
  expect(f.counts().writes).toBe(0); expect(f.events).toEqual([]);
});
test("pin toggles both ways without optional unit ID", async () => {
  const f = fixture(); const req = postRequest({ action: "PIN_TOGGLE", noteId: "note" });
  expect(requiredRecord((await f.api.POST(req)).body.data).isPinned).toBe(true); expect(requiredRecord((await f.api.POST(req)).body.data).isPinned).toBe(false);
});
test("create retains trimming, limit, fallback and response", async () => {
  const f = fixture(); const response = await f.api.POST(postRequest({ unitId: " unit ", content: "  " + "x".repeat(600) + "  ", noteType: "invalid", isPinned: true }));
  expect(response.status).toBe(200); expect(Object.keys(response.body)).toEqual(["ok", "data"]);
  expect(requiredRecord(response.body.data).content).toBe("x".repeat(500)); expect(requiredRecord(response.body.data).noteType).toBe("GENERAL");
  expect(requiredRecord(response.body.data).propertyId).toBe("a"); expect(requiredRecord(response.body.data).unitId).toBe("unit"); expect(requiredRecord(response.body.data).createdBy).toBe("user");
});
for (const action of ["CREATE", "PIN_TOGGLE"]) test(`failed ${action} emits no success`, async () => {
  const f = fixture(); f.fail(); expect((await f.api.POST(postRequest({ action, unitId: "unit", noteId: "note", content: "x" }))).status).toBe(500);
  expect(f.events).toEqual([]); expect(f.counts().writes).toBe(0);
});
for (const role of ["OWNER", "MANAGER", "STAFF"]) test(`${role}: actual UnitDetail excludes inconsistent notes`, async () => {
  const f = fixture(role); const tree = await f.page({ params: Promise.resolve({ id: "unit" }) }); const text = JSON.stringify(tree);
  expect(text).toContain("Legitimate note"); expect(text).not.toContain("Foreign property leak");
  const renderedControls: unknown[] = [];
  function visit(node:unknown): void { if (Array.isArray(node)) { node.forEach(visit); return; }
    if (isElement(node)) { if (f.controls.some(control=>control===node.type)) renderedControls.push(node.type); visit(node.props?.children); } }
  visit(tree);
  if (role === "STAFF") expect(renderedControls).toEqual([]);
  else { expect(renderedControls).toContain(f.controls[0]); expect(renderedControls).toContain(f.controls[1]); }
  expect(f.counts().writes).toBe(0);
});
