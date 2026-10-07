import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export function load(file: string, imports: Record<string, any>, clock: { new (): Date; now(): number } = Date) {
  const module = { exports: {} as any };
  const output = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(output, { module, exports: module.exports, Date: clock,
    console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    } });
  return module.exports;
}
export function fixture(code = "1234", realLockout = false) {
  let now = Date.now(); class Clock extends Date { static now() { return now; } }
  const events: any[] = [];
  const controls = { property: true, propertyActive: true, unit: true, unitActive: true,
    activated: true, hash: true, assignment: true, validPin: true, ipAllowed: true, staleAfterVerify: false };
  let inTransaction = false;
  const helper = realLockout ? load("lib/pinLockout.ts", {}, Clock) : {
    checkPinAllowed: () => ({ ok: true }), recordFailedAttempt() {}, clearPinAttempts() {},
  };
  const lockout = Object.fromEntries(["checkPinAllowed", "recordFailedAttempt", "clearPinAttempts"].map(name => [name, (key: string) => {
    events.push([name, key]); return helper[name](key);
  }]));
  const imports = {
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/prisma": { prisma: {
      property: { findUnique: async (args: any) => { events.push(["property", args]); return controls.property && args.where.propertyCode === code ? { id: "p", isActive: controls.propertyActive } : null; } },
      unit: { findUnique: async (args: any) => { events.push(["unit", args]); assert.equal(args.where.propertyId_unitNumber.propertyId, "p");
        return controls.unit && args.where.propertyId_unitNumber.unitNumber === "1" ? { id: "u", isActive: controls.unitActive, portalActivated: controls.activated, tenantPinHash: controls.hash ? "hash" : null } : null; } },
      tenantAssignment: { findFirst: async (args: any) => { events.push(["assignment", args]); assert.equal(args.where.propertyId, "p"); assert.equal(args.where.unitId, "u");
        assert.equal(args.where.isCurrent, true); assert.equal(args.where.OR[0].moveOutDate, null); assert.ok(args.where.OR[1].moveOutDate.gt instanceof Clock);
        return controls.assignment ? { id: "assignment" } : null; } },
    } },
    "@/lib/pin": { verifyPin: async () => { assert.equal(inTransaction, false); events.push(["verify"]); return controls.validPin; } },
    "@/lib/session": { createSessionToken: (input: any) => { events.push(["session", input]); return "mock-session"; }, setSessionCookie: async () => { events.push(["cookie"]); } },
    "@/lib/pinLockout": lockout,
    "@/lib/rateLimit": { checkRateLimit: (key: string, limit: number, window: number) => { events.push(["ip", key, limit, window]); return { ok: controls.ipAllowed }; } },
  };
  const locking = load("lib/manualFinancialOperations.ts", { "@prisma/client": {} }, Clock);
  (imports as Record<string, any>)["@/lib/manualFinancialOperations"] = locking;
  const db = imports["@/lib/prisma"].prisma as any;
  db.$transaction = async (fn: any) => {
    events.push(["transaction.begin"]); inTransaction = true;
    try {
      return await fn({
        $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          assert.equal(inTransaction, true); events.push(["lock", strings.join("?"), values]); return [{ id: values[0] }];
        },
        property: { findUnique: async ({ where }: any) => {
          assert.equal(where.id, "p"); events.push(["property.revalidate"]); return { isActive: controls.propertyActive };
        } },
        unit: { findFirst: async ({ where }: any) => {
          assert.equal(where.id, "u"); assert.equal(where.propertyId, "p");
          assert.equal(where.isActive, true); assert.equal(where.portalActivated, true); events.push(["unit.revalidate"]);
          return controls.unitActive && controls.activated ? { tenantPinHash: controls.hash ? "hash" : null } : null;
        } },
        tenantAssignment: { findFirst: async ({ where }: any) => {
          assert.equal(where.id, "assignment"); assert.equal(where.propertyId, "p"); assert.equal(where.unitId, "u");
          assert.equal(where.isCurrent, true); assert.equal(where.OR[0].moveOutDate, null);
          assert.ok(where.OR[1].moveOutDate.gt instanceof Clock); events.push(["assignment.revalidate"]);
          return controls.assignment && !controls.staleAfterVerify ? { id: "assignment" } : null;
        } },
      });
    } finally { inTransaction = false; events.push(["transaction.end"]); }
  };
  const route = load("app/api/tenant/session/route.ts", imports, Clock);
  const login = (body: any = {}) => route.POST({ headers: { get: (key: string) => key === "x-forwarded-for" ? "test-ip" : null },
    json: async () => ({ propertyCode: code, unitNumber: "1", pin: "1234", ...body }) });
  return { controls, events, helper, login, advance: (ms: number) => { now += ms; } };
}
for (const code of ["1234", "12345", "0123", "01234"]) test("valid exact string code " + code, async () => {
  const f = fixture(code); assert.equal((await f.login()).status, 200);
  assert.equal(f.events.find(e => e[0] === "property")[1].where.propertyCode, code);
  assert.deepEqual(JSON.parse(JSON.stringify(f.events.find(e => e[0] === "session")[1])), { role: "TENANT", propertyId: "p", unitId: "u", tenantAssignmentId: "assignment" });
});
for (const code of ["1234", "12345"]) test("unknown valid code " + code, async () => {
  const f = fixture(code); f.controls.property = false; assert.equal((await f.login()).status, 401);
  assert.ok(f.events.some(e => e[0] === "property")); assert.ok(!f.events.some(e => e[0] === "verify" || e[0] === "session"));
});
for (const code of ["123", "123456", "ABCD", "12A4", "", "1234.0"]) test("malformed code rejects before lookup " + code, async () => {
  const f = fixture(); assert.equal((await f.login({ propertyCode: code })).status, 400); assert.deepEqual(f.events.map(e => e[0]), ["ip"]);
});
test("whitespace trim and unit normalization", async () => {
  const f = fixture("01234"); assert.equal((await f.login({ propertyCode: " 01234 ", unitNumber: " 1 ", pin: " 1234 " })).status, 200);
  assert.equal(f.events.find(e => e[0] === "property")[1].where.propertyCode, "01234");
});
for (const condition of ["propertyActive", "unitActive", "activated", "hash", "assignment", "validPin"] as const) test("existing eligibility denied " + condition, async () => {
  const f = fixture("12345"); f.controls[condition] = false; assert.ok((await f.login()).status >= 400); assert.ok(!f.events.some(e => e[0] === "session"));
});
test("foreign unit and submitted identity cannot substitute", async () => {
  const f = fixture(); assert.equal((await f.login({ unitNumber: "foreign", propertyId: "other", unitId: "other", tenantAssignmentId: "other" })).status, 401);
  assert.ok(!f.events.some(e => e[0] === "verify" || e[0] === "session"));
});
test("submitted IDs ignored on legitimate login", async () => {
  const f = fixture(); assert.equal((await f.login({ propertyId: "other", unitId: "other", tenantAssignmentId: "other" })).status, 200);
  assert.equal(f.events.find(e => e[0] === "session")[1].tenantAssignmentId, "assignment");
});
