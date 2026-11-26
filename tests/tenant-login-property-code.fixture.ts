import { httpFacade } from "./fixture-assertions";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";


type Modules = {
 "lib/pinLockout.ts": typeof import("../lib/pinLockout");
 "lib/manualFinancialOperations.ts": typeof import("../lib/manualFinancialOperations");
 "app/api/tenant/session/route.ts": ReturnType<typeof httpFacade>;
};
export function load<File extends keyof Modules>(file: File, imports: Record<string, unknown>, clock?: {new(): Date; now(): number}): Modules[File];
export function load(file: keyof Modules, imports: Record<string, unknown>, clock: { new (): Date; now(): number } = Date): unknown {
  const fixtureModule: { exports: unknown } = { exports: {} };
  const output = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(output, { module: fixtureModule, exports: fixtureModule.exports, Date: clock,
    console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    } });
  return file.startsWith("app/api/") ? httpFacade(fixtureModule.exports) : fixtureModule.exports;
}
type AssignmentWhere = { id?: string; propertyId: string; unitId: string; isCurrent: boolean; OR: [{ moveOutDate: null }, { moveOutDate: { gt: Date } }] };
export function fixture(code = "1234", realLockout = false) {
  let now = Date.now(); class Clock extends Date { static now() { return now; } }
  const events: [string, ...unknown[]][] = [];
  const controls = { property: true, propertyActive: true, unit: true, unitActive: true,
    activated: true, hash: true, assignment: true, validPin: true, ipAllowed: true, staleAfterVerify: false };
  let inTransaction = false;
  const helper = realLockout ? load("lib/pinLockout.ts", {}, Clock) : {
    checkPinAllowed: () => ({ ok: true }), recordFailedAttempt() {}, clearPinAttempts() {},
  };
  const lockout = Object.fromEntries((["checkPinAllowed", "recordFailedAttempt", "clearPinAttempts"] as const).map(name => [name, (key: string) => {
    events.push([name, key]); return helper[name](key);
  }]));
  const imports = {
    "next/server": { NextResponse: { json: (body: unknown, options: { status?: number; headers?: HeadersInit } = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/prisma": { prisma: {
      property: { findUnique: async (args: { where: { propertyCode: string } }) => { events.push(["property", args]); return controls.property && args.where.propertyCode === code ? { id: "p", isActive: controls.propertyActive } : null; } },
      unit: { findUnique: async (args: { where: { propertyId_unitNumber: { propertyId: string; unitNumber: string } } }) => { events.push(["unit", args]); assert.equal(args.where.propertyId_unitNumber.propertyId, "p");
        return controls.unit && args.where.propertyId_unitNumber.unitNumber === "1" ? { id: "u", isActive: controls.unitActive, portalActivated: controls.activated, tenantPinHash: controls.hash ? "hash" : null } : null; } },
      tenantAssignment: { findFirst: async (args: { where: AssignmentWhere }) => { events.push(["assignment", args]); assert.equal(args.where.propertyId, "p"); assert.equal(args.where.unitId, "u");
        assert.equal(args.where.isCurrent, true); assert.equal(args.where.OR[0].moveOutDate, null); assert.ok(args.where.OR[1].moveOutDate.gt instanceof Clock);
        return controls.assignment ? { id: "assignment" } : null; } },
    } },
    "@/lib/pin": { verifyPin: async () => { assert.equal(inTransaction, false); events.push(["verify"]); return controls.validPin; } },
    "@/lib/session": { createSessionToken: (input: Parameters<typeof import("../lib/session").createSessionToken>[0]) => { events.push(["session", input]); return "mock-session"; }, setSessionCookie: async () => { events.push(["cookie"]); } },
    "@/lib/pinLockout": lockout,
    "@/lib/rateLimit": { checkRateLimit: (key: string, limit: number, window: number) => { events.push(["ip", key, limit, window]); return { ok: controls.ipAllowed }; } },
  };
  const locking = load("lib/manualFinancialOperations.ts", { "@prisma/client": {} }, Clock);
  Object.assign(imports, { "@/lib/manualFinancialOperations": locking });
  const db = imports["@/lib/prisma"].prisma;
  const tx = {
        $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
          assert.equal(inTransaction, true); events.push(["lock", strings.join("?"), values]); return [{ id: values[0] }];
        },
        property: { findUnique: async ({ where }: { where: { id: string } }) => {
          assert.equal(where.id, "p"); events.push(["property.revalidate"]); return { isActive: controls.propertyActive };
        } },
        unit: { findFirst: async ({ where }: { where: { id: string; propertyId: string; isActive: boolean; portalActivated: boolean } }) => {
          assert.equal(where.id, "u"); assert.equal(where.propertyId, "p");
          assert.equal(where.isActive, true); assert.equal(where.portalActivated, true); events.push(["unit.revalidate"]);
          return controls.unitActive && controls.activated ? { tenantPinHash: controls.hash ? "hash" : null } : null;
        } },
        tenantAssignment: { findFirst: async ({ where }: { where: AssignmentWhere }) => {
          assert.equal(where.id, "assignment"); assert.equal(where.propertyId, "p"); assert.equal(where.unitId, "u");
          assert.equal(where.isCurrent, true); assert.equal(where.OR[0].moveOutDate, null);
          assert.ok(where.OR[1].moveOutDate.gt instanceof Clock); events.push(["assignment.revalidate"]);
          return controls.assignment && !controls.staleAfterVerify ? { id: "assignment" } : null;
        } },
      };
  Object.assign(db, { $transaction: async <Result>(fn: (client: typeof tx) => Promise<Result>): Promise<Result> => {
    events.push(["transaction.begin"]); inTransaction = true;
    try { return await fn(tx); } finally { inTransaction = false; events.push(["transaction.end"]); }
  } });
  const route = load("app/api/tenant/session/route.ts", imports, Clock);
  const login = (body: Record<string, unknown> = {}) => route.POST({ headers: { get: (key: string) => key === "x-forwarded-for" ? "test-ip" : null },
    json: async () => ({ propertyCode: code, unitNumber: "1", pin: "1234", ...body }) });
  return { controls, events, helper, login, advance: (ms: number) => { now += ms; } };
}
