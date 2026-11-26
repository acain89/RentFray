import { callVm, httpFacade } from "./fixture-assertions";
import assert from "node:assert/strict";
import * as gracePolicy from "../lib/gracePeriod";


import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Payment, LedgerEntry, AuditLog, TenantAssignment, Unit, PropertyTier, Property, PropertySettings } from "@prisma/client";

export const root = resolve(__dirname, "..");
type Libraries = {
 "lib/authThrottle.ts": typeof import("../lib/authThrottle");
 "lib/rentDates.ts": typeof import("../lib/rentDates");
 "lib/billingCalendar.ts": typeof import("../lib/billingCalendar");
 "lib/billingConfig.ts": typeof import("../lib/billingConfig");
 "lib/ledger.ts": typeof import("../lib/ledger");
 "lib/unitFinancialState.ts": typeof import("../lib/unitFinancialState");
 "lib/unitStatusEngine.ts": typeof import("../lib/unitStatusEngine");
 "lib/manualFinancialOperations.ts": typeof import("../lib/manualFinancialOperations");
 "lib/checkoutCollectibility.ts": typeof import("../lib/checkoutCollectibility");
 "jobs/lateFees.ts": typeof import("../jobs/lateFees");
};
type ActivationInput = { propertyId: string; unitId: string; tenantAssignmentId: string; billingCycle: string; amountCents: number; effectiveDate: Date };
export function load<File extends keyof Libraries>(file: File, imports: Record<string, unknown>, append?: string, extras?: Record<string, unknown>): Libraries[File];
export function load(file: "app/manager/properties/[id]/settings/page.tsx", imports: Record<string, unknown>, append?: string, extras?: Record<string, unknown>): { default(props: unknown): Promise<unknown>; saveSettings(form: { has(key: string): boolean; get(key: string): unknown }): Promise<void> };
export function load(file: `app/${string}.tsx`, imports: Record<string, unknown>, append?: string, extras?: Record<string, unknown>): { default(props: unknown): unknown };
export function load(file: string, imports: Record<string, unknown>, append?: string, extras?: Record<string, unknown>): ReturnType<typeof httpFacade> & { ensureActivationRent(tx: Client, input: ActivationInput): Promise<void> };
export function load(file: string, imports: Record<string, unknown>, append = "", extras: Record<string, unknown> = {}): unknown {
 const fixtureModule: { exports: unknown } = { exports: {} };
 const source = ts.transpileModule(readFileSync(resolve(root,file),"utf8")+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(source,{module: fixtureModule,exports:fixtureModule.exports,Date,Error,Buffer,URL,console:{error(){}},process:{env:{}},require(name:string){ if (name === "@/lib/gracePeriod") return gracePolicy;if(!(name in imports))throw Error("Unmocked import "+name);return imports[name];},...extras});const namespace = fixtureModule.exports;
 if(file.startsWith("lib/")||file.startsWith("jobs/"))return namespace;
 if(file.endsWith(".tsx"))return {default:(props:unknown)=>callVm(namespace,"default",props),saveSettings:async(form:unknown)=>{await callVm(namespace,"saveSettings",form);}};
 return {...httpFacade(namespace),ensureActivationRent:async(tx:Client,input:ActivationInput)=>{await callVm(namespace,"ensureActivationRent",tx,input);}};
}
export const uuid = "11111111-1111-4111-8111-111111111111";
export const second = "22222222-2222-4222-8222-222222222222";
type ReadArgs = { where?: unknown };
type UnitRow = Partial<Unit> & { id: string };
type TierRow = Partial<PropertyTier> & Pick<PropertyTier, "id" | "propertyId" | "name" | "isActive" | "unitCount" | "activeUnitCount" | "baseRentCents" | "rentDueDay">;
type PropertyRow = Partial<Property> & { id: string; settings: Partial<PropertySettings> };
type State = { units: UnitRow[]; tenantAssignment: Partial<TenantAssignment>[]; payment: Partial<Payment>[]; ledgerEntry: Partial<LedgerEntry>[]; auditLog: Partial<AuditLog>[] };
type Table<Row extends object> = {
 findFirst(args: ReadArgs): Promise<Row | null>; findUnique(args: ReadArgs): Promise<Row | null>;
 findMany(args: ReadArgs): Promise<Row[]>; count(args: ReadArgs): Promise<number>;
 create(args: { data: Partial<Row> }): Promise<Row>;
 updateMany(args: { where: unknown; data: Partial<Row> }): Promise<{ count: number }>;
 createMany(args: { data: Partial<Row>[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
 update?: (args: { where: unknown; data: Partial<Row> }) => Promise<Row>;
};
type ExpandedUnit = UnitRow & { tier: TierRow | null; property: PropertyRow; tenantAssignments: Partial<TenantAssignment>[] };
type Client = {
 $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
 $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
 $transaction<Result>(work: (tx: Client) => Promise<Result>, options?: { isolationLevel?: string; maxWait?: number; timeout?: number }): Promise<Result>;
 property: { findUnique(args?: ReadArgs): Promise<(PropertyRow & { tiers: TierRow[] }) | null>; update?: (args: { data: Partial<PropertyRow>; where?: unknown }) => Promise<PropertyRow> };
 paymentConnectionStatus?: { upsert(args: unknown): Promise<unknown> };
 propertyTier: { findFirst(args: ReadArgs): Promise<TierRow | null>; update(args: { where: { id: string }; data: Partial<TierRow> }): Promise<void>; aggregate(): Promise<{ _sum: { unitCount: number } }> };
 unit: { findFirst(args: ReadArgs): Promise<ExpandedUnit | null>; findUnique(args: ReadArgs): Promise<ExpandedUnit | null>; count(args: ReadArgs): Promise<number>; update(args: { where: { id: string }; data: Partial<UnitRow> }): Promise<UnitRow>; create(args: { data: Partial<UnitRow> }): Promise<UnitRow> };
 tenantAssignment: Table<Partial<TenantAssignment>>; payment: Table<Partial<Payment>>; ledgerEntry: Table<Partial<LedgerEntry>>; auditLog: Table<Partial<AuditLog>>;
};
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object"; }
export function matches(row: unknown, where: unknown): boolean {
 if (where === null || where === undefined) return true;
 assert.ok(object(where), "Expected a Prisma where object");
 return Object.entries(where).every(([key, value]) => {
  if (key === "OR" || key === "AND") { assert.ok(Array.isArray(value)); return key === "OR" ? value.some((part: unknown) => matches(row, part)) : value.every((part: unknown) => matches(row, part)); }
  if (key === "NOT") return !matches(row, value);
  assert.ok(object(row), "Expected a stored fixture row"); const field = row[key];
  if (object(value) && !(value instanceof Date)) {
   if ("in" in value) { assert.ok(Array.isArray(value.in)); const choices: unknown[] = value.in; return choices.includes(field); }
   if ("contains" in value) {
    if (field === null || field === undefined) return false;
    if (Array.isArray(field)) { const values: unknown[] = field; return values.includes(value.contains); }
    assert.ok(typeof field === "string" && typeof value.contains === "string"); return field.includes(value.contains);
   }
   if ("gt" in value || "lte" in value) {
    const wanted = "gt" in value ? value.gt : value.lte;
    // Retain the fixture's existing JS range semantics, including nonmatches for undefined.
    if (typeof field === "string" && typeof wanted === "string") return "gt" in value ? field > wanted : field <= wanted;
    const left = Number(field), right = Number(wanted); return "gt" in value ? left > right : left <= right;
   }
   return matches(field ?? {}, value);
  }
  return field === value;
 });
}
export function fixture(role: string | null = "MANAGER") {
 const events:string[]=[];let sequence=0,tail=Promise.resolve();
 const property: PropertyRow={id:"p",isActive:true,propertyCode:"1234",rentFrayStartDate:new Date("2026-01-01"),settings:{rentDueDay:1}};
 const tiers: TierRow[]=[{id:"s",propertyId:"p",name:"Source",isActive:true,unitCount:3,activeUnitCount:1,baseRentCents:10000,rentDueDay:1},{id:"t",propertyId:"p",name:"Target",isActive:true,unitCount:1,activeUnitCount:0,baseRentCents:20000,rentDueDay:1}];
 const state: State={units:[{id:"u",unitNumber:"1",propertyId:"p",tierId:"s",isActive:true}],tenantAssignment:[{id:"a",propertyId:"p",unitId:"u",isCurrent:true,moveInDate:null,moveOutDate:null}],payment:[],ledgerEntry:[],auditLog:[]};
 const controls: { fail: string; onLock: ((sql: string, values: unknown[]) => void | Promise<void>) | null; retries: number; cycle: string }={fail:"",onLock:null,retries:0,cycle:"2026-10"};
 const expand=(row: UnitRow | undefined)=>row?{...row,tier:tiers.find(t=>t.id===row.tierId)??null,property,tenantAssignments:state.tenantAssignment.filter((a)=>a.unitId===row.id&&a.isCurrent)}:null;
 const write=(name:string)=>{events.push(name);if(controls.fail===name)throw Error("injected write failure");};
 const defaults = (model: string) => ({ id: model + (++sequence), createdAt: new Date("2026-10-05"), voidedAt: null });
 const prisma: Client={
  tenantAssignment: table(() => state.tenantAssignment, "tenantAssignment", data => ({ ...defaults("tenantAssignment"), ...data })),
  payment: table(() => state.payment, "payment", data => ({ ...defaults("payment"), ...data })),
  ledgerEntry: table(() => state.ledgerEntry, "ledgerEntry", data => ({ ...defaults("ledgerEntry"), ...data })),
  auditLog: table(() => state.auditLog, "auditLog", data => ({ ...defaults("auditLog"), ...data })),
  $executeRaw:async(strings: TemplateStringsArray,...values: unknown[])=>{events.push("advisory:"+values.join(":"));return 1;},
  $queryRaw:async(strings: TemplateStringsArray,...values: unknown[])=>{const sql=strings.join("?");events.push(sql);if(controls.onLock)await controls.onLock(sql,values);return [];},
  $transaction:async<Result>(fn: (tx: Client) => Promise<Result>, options?: { isolationLevel?: string; maxWait?: number; timeout?: number }): Promise<Result>=>{const previous=tail;let release!: () => void;tail=new Promise<void>(r=>release=r);await previous;const saved=structuredClone({state,tiers});events.push("begin:"+options?.isolationLevel);try{if(controls.retries>0){controls.retries--;throw {code:"P2034"};}return await fn(prisma);}catch(e){Object.assign(state, saved.state);tiers.splice(0,tiers.length,...saved.tiers);events.push("rollback");throw e;}finally{release();}},
  property:{findUnique:async()=>({...property,tiers})},
  propertyTier:{findFirst:async({where}: ReadArgs)=>tiers.find(t=>matches(t,where))??null,update:async({where,data})=>{write("tier.update");const tier = tiers.find(t=>t.id===where.id); assert.ok(tier); Object.assign(tier,data);},aggregate:async()=>({_sum:{unitCount:4}})},
  unit:{findFirst:async({where}: ReadArgs)=>{events.push("unit.read");return expand(state.units.find((u)=>matches(u,where)));},findUnique:async({where}: ReadArgs)=>{ assert.ok(object(where)); return expand(state.units.find((u)=>matches(u,where.propertyId_unitNumber??where))); },count:async({where}: ReadArgs)=>{events.push("capacity.read");return state.units.filter((u)=>matches(u,where)).length;},update:async({where,data})=>{write("unit.update");const row=state.units.find((u)=>u.id===where.id);assert.ok(row);Object.assign(row,data);return {...row};},create:async({data})=>{write("unit.create");const row={id:"new"+(++sequence),...data};state.units.push(row);return row;}},
 };
 function table<Row extends object>(getRows: () => Row[], model: string, make: (data: Partial<Row>) => Row): Table<Row> {
  const delegate: Table<Row> = {
   findFirst: async ({ where }) => getRows().find(row => matches(row, where)) ?? null,
   findUnique: async ({ where }) => getRows().find(row => matches(row, where)) ?? null,
   findMany: async ({ where }) => getRows().filter(row => matches(row, where)),
   count: async ({ where }) => getRows().filter(row => matches(row, where)).length,
   create: async ({ data }) => { write(model + ".create"); const row = make(data); getRows().push(row); return row; },
   updateMany: async ({ where, data }) => { write(model + ".updateMany"); const selected = getRows().filter(row => matches(row, where)); selected.forEach(row => Object.assign(row, data)); return { count: selected.length }; },
   createMany: async ({ data }) => { let count = 0; for (const row of data) { const key: unknown = Reflect.get(row, "idempotencyKey"); if (key && getRows().some(stored => Reflect.get(stored, "idempotencyKey") === key)) continue; await delegate.create({ data: row }); count++; } return { count }; },
  }; return delegate;
 }
 class Known extends Error {code:string;constructor(message:string,{code}: { code: string }){super(message);this.code=code;}}
 const imports:Record<string,unknown>={"next/server":{NextResponse:{json:(body:unknown,options:{ status?: number; headers?: HeadersInit })=>({status:options?.status??200,body:JSON.parse(JSON.stringify(body))})}},"@prisma/client":{Prisma:{PrismaClientKnownRequestError:Known},PaymentStatus:{PAID:"PAID"}},"@/lib/prisma":{prisma},"@/lib/session":{getSession:async()=>role?{role,propertyId:"p",managementUserId:"m"}:null,requireRole:async(required:string)=>{if(role!==required)throw Error("Unauthorized");return {role,propertyId:"p"};},createSessionToken:async()=>"isolated",setSessionCookie:async()=>{}},"@/lib/permissions":{canManageFinancials:(r:string)=>["OWNER","MANAGER"].includes(r)},"@/lib/realtime":{emitEvent:()=>{}},"@/lib/rentDates":{getBusinessDateInstant:load("lib/rentDates.ts",{}).getBusinessDateInstant,resolveEffectiveBillingSettings:()=>({dueDay:1}),getRentDateSummary:()=>({billingCycle:controls.cycle,dueDate:"2026-10-01",hasStarted:true})},"@/lib/billingCalendar":{assertTierBillingCalendar:()=>1,BillingCalendarError:class extends Error {}},"@/lib/pin":{hashPin:async()=>"hash"},"@/jobs/lateFees":{runLateFeesJob:async()=>{}},"@/lib/destructiveRetention":{}};
 imports["@/lib/manualFinancialOperations"]=load("lib/manualFinancialOperations.ts",{});
 imports["@/lib/checkoutCollectibility"]=load("lib/checkoutCollectibility.ts",{stripe:class {} });
 const route=(file:string)=>load(file,imports);
 const pay=async(body: Record<string, unknown>={})=>route("app/api/manual-payments/route.ts").POST({json:async()=>({unitId:"u",tenantAssignmentId:"a",operationId:uuid,amount:123.45,effectiveDate:"2026-10-05",...body})});
 const move=async(body: Record<string, unknown>={})=>route("app/api/manager/units/move-tier/route.ts").POST({json:async()=>({unitId:"u",targetTierId:"t",tenantAssignmentId:"a",expectedSourceTierId:"s",operationId:uuid,...body})});
 return {events,state,tiers,property,controls,prisma,imports,route,pay,move};
}
