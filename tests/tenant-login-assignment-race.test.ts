import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export function load(file: string, imports: Record<string, any>, extra: Record<string, any> = {}, suffix = "") {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8") + suffix, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, Date, Buffer,
    console: { error() {} }, ...extra, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    } });
  return module.exports;
}
export function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((part: any) => matches(row, part));
    if (key === "AND") return value.every((part: any) => matches(row, part));
    if (value && typeof value === "object" && typeof value.getTime !== "function") {
      return Object.entries(value).every(([op, target]: [string, any]) => {
        if (op === "gt") return row[key] != null && row[key] > target;
        if (op === "lte") return row[key] != null && row[key] <= target;
        return matches(row[key], { [op]: target });
      });
    }
    return row[key] === value;
  });
}
export function fixture(role: string | null = "MANAGER") {
  const now = new Date("2026-10-14T17:00:00Z");
  class Clock extends Date {
    constructor(...args: any[]) { super(args.length ? args[0] : now); if (args.length > 1) return Reflect.construct(Date, args); }
    static now() { return now.getTime(); }
  }
  const property = { id: "p", propertyCode: "1234", isActive: true, name: "Property",
    rentFrayStartDate: new Date("2026-01-15T06:00:00Z"), settings: { rentDueDay: 15, gracePeriodDays: 2, lateFeeEnabled: false } };
  const tier = { id: "t", propertyId: "p", rentDueDay: 15, gracePeriodDays: 2, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 };
  let state: any = { unit: { id: "u", propertyId: "p", unitNumber: "1", tierId: "t", tier, property,
    isActive: true, portalActivated: true, tenantPinHash: "hash-A", portalFirstName: "A", portalLastName: "Tenant", activatedAt: now },
    assignments: [{ id: "a", propertyId: "p", unitId: "u", isCurrent: true, moveOutDate: null, firstName: "A", lastName: "Tenant" }], ledger: [], audits: [] };
  const events: any[] = [], tokens: any[] = [], cookies: any[] = [], realtime: any[] = [];
  const controls: any = { validPin: true, onVerify: null, onLock: null, onTransaction: null, failAudit: false, inTransaction: false };
  const unitRead = async (args: any) => {
    events.push(["unit.read", controls.inTransaction]);
    const where = args.where.propertyId_unitNumber ?? args.where;
    if (!matches(state.unit, where)) return null;
    const tenantWhere = args.include?.tenantAssignments?.where ?? {};
    return structuredClone({ ...state.unit, tenantAssignments: state.assignments.filter((a: any) => matches(a, tenantWhere)) });
  };
  const db: any = {
    property: { findUnique: async ({ where }: any) => { events.push(["property.read", controls.inTransaction]); return matches(state.unit.property, where) ? structuredClone(state.unit.property) : null; } },
    unit: { findUnique: unitRead, findFirst: unitRead, update: async ({ where, data }: any) => {
      assert.equal(controls.inTransaction, true); assert.ok(matches(state.unit, where)); events.push(["unit.write"]);
      Object.assign(state.unit, data); return structuredClone(state.unit);
    } },
    tenantAssignment: { findFirst: async ({ where }: any) => {
      events.push(["assignment.read", controls.inTransaction, where.id ?? null]);
      return structuredClone(state.assignments.find((a: any) => matches(a, where)) ?? null);
    }, update: async ({ where, data }: any) => {
      assert.equal(controls.inTransaction, true); events.push(["assignment.write", where.id]);
      const assignment = state.assignments.find((a: any) => matches(a, where)); assert.ok(assignment);
      Object.assign(assignment, data); return structuredClone(assignment);
    } },
    ledgerEntry: { create: async ({ data }: any) => {
      assert.equal(controls.inTransaction, true); events.push(["ledger.write"]);
      const row = { id: "entry-" + state.ledger.length, createdAt: now, ...data }; state.ledger.push(row); return structuredClone(row);
    } },
    auditLog: { create: async ({ data }: any) => {
      assert.equal(controls.inTransaction, true); if (controls.failAudit) throw Error("audit failure");
      state.audits.push(data); return structuredClone(data);
    } },
    $executeRaw: async (parts: any, ...values: any[]) => { assert.equal(controls.inTransaction, true); events.push(["advisory", values.join(":")]); return 1; },
  };
  db.$transaction = async (fn: any) => {
    controls.onTransaction?.(); controls.onTransaction = null;
    let before = structuredClone(state); controls.inTransaction = true; events.push(["begin"]);
    db.$queryRaw = async (parts: any) => {
      const sql = parts.join("?"); events.push(["row", sql]);
      if (controls.onLock) { controls.onLock(); controls.onLock = null; before = structuredClone(state); }
      return [{ id: "locked" }];
    };
    try { const result = await fn(db); events.push(["commit"]); return result; }
    catch (error) { state = before; events.push(["rollback"]); throw error; }
    finally { controls.inTransaction = false; }
  };
  const lockout = load("lib/pinLockout.ts", {}, { Date: Clock });
  const helpers = load("lib/manualFinancialOperations.ts", {});
  const imports: any = {
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }) } },
    "@prisma/client": { Prisma: {} }, "@/lib/prisma": { prisma: db },
    "@/lib/manualFinancialOperations": helpers,
    "@/lib/permissions": { canManageFinancials: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "@/lib/session": { getSession: async () => role ? { role, propertyId: "p", managementUserId: "m" } : null,
      createSessionToken: (payload: any) => { events.push(["token"]); tokens.push(payload); return "token"; },
      setSessionCookie: async (token: string) => { assert.equal(controls.inTransaction, false); events.push(["cookie"]); cookies.push(token); } },
    "@/lib/pin": { verifyPin: async (_pin: string, hash: string) => {
      assert.equal(controls.inTransaction, false); assert.equal(hash, "hash-A"); events.push(["verify"]); controls.onVerify?.(); return controls.validPin;
    } }, "@/lib/pinLockout": Object.fromEntries(["checkPinAllowed", "recordFailedAttempt", "clearPinAttempts"].map(name => [name, (key: string) => {
      events.push([name]); return lockout[name](key);
    }])), "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/realtime": { emitEvent: (...args: any[]) => { assert.equal(controls.inTransaction, false); realtime.push(args); } },
  };
  imports["@/lib/rentDates"] = load("lib/rentDates.ts", {}, { Date: Clock });
  imports["@/lib/billingCalendar"] = load("lib/billingCalendar.ts", imports, { Date: Clock });
  const invoke = (file: string, body: any) => load(file, imports, { Date: Clock }).POST({ headers: { get: () => null }, json: async () => body });
  const login = (body: any = {}) => invoke("app/api/tenant/session/route.ts", { propertyCode: state.unit.property.propertyCode, unitNumber: "1", pin: "1234", ...body });
  const replace = () => { state.assignments[0].isCurrent = false; state.assignments[0].moveOutDate = new Date(0);
    state.assignments.push({ ...state.assignments[0], id: "b", isCurrent: true, moveOutDate: null }); state.unit.tenantPinHash = "hash-B"; };
  return { state: () => state, controls, db, imports, events, tokens, cookies, realtime, lockout, invoke, login, replace, now };
}

test("login captures A before verification, signs A under locks and sets cookie after commit", async () => {
  const f = fixture(); assert.equal((await f.login()).status, 200);
  assert.equal(f.tokens[0].tenantAssignmentId, "a"); assert.equal(f.cookies.length, 1);
  const names = f.events.map(e => e[0]);
  assert.ok(names.indexOf("assignment.read") < names.indexOf("verify"));
  assert.ok(names.indexOf("verify") < names.indexOf("begin"));
  assert.ok(names.indexOf("commit") < names.indexOf("clearPinAttempts"));
  assert.ok(names.indexOf("commit") < names.indexOf("cookie"));
  const rows = f.events.filter(e => e[0] === "row").map(e => e[1]);
  assert.ok(rows[0].includes('FROM "Property"')); assert.ok(rows[1].includes('FROM "TenantAssignment"')); assert.ok(rows[2].includes('FROM "Unit"'));
  assert.equal(f.events.filter(e => e[0] === "advisory").length, 0);
  assert.equal(f.state().ledger.length, 0);
});
for (const change of ["vacated", "replaced", "pin", "portal", "inactive", "property", "unit-property", "assignment-property", "assignment-unit", "expired-departure"]) {
  test("login rejects post-verification " + change + " without clearing failures or issuing authority", async () => {
    const f = fixture(); f.lockout.recordFailedAttempt("u");
    f.controls.onLock = () => {
      if (change === "replaced") f.replace();
      else if (change === "vacated") f.state().assignments[0].isCurrent = false;
      else if (change === "pin") f.state().unit.tenantPinHash = "new-hash";
      else if (change === "portal") f.state().unit.portalActivated = false;
      else if (change === "inactive") f.state().unit.isActive = false;
      else if (change === "property") f.state().unit.property.isActive = false;
      else if (change === "unit-property") f.state().unit.propertyId = "other";
      else if (change === "assignment-property") f.state().assignments[0].propertyId = "other";
      else if (change === "assignment-unit") f.state().assignments[0].unitId = "other";
      else f.state().assignments[0].moveOutDate = new Date(0);
    };
    assert.equal((await f.login()).status, 401); assert.equal(f.tokens.length, 0); assert.equal(f.cookies.length, 0);
    assert.ok(!f.events.some(e => e[0] === "clearPinAttempts"));
    for (let i = 0; i < 4; i++) f.lockout.recordFailedAttempt("u");
    assert.equal(f.lockout.checkPinAllowed("u").ok, false);
  });
}
test("replacement between captured credential and transaction cannot substitute B", async () => {
  const f = fixture(); f.controls.onVerify = f.replace; assert.equal((await f.login()).status, 401); assert.equal(f.tokens.length, 0);
  const finalReads = f.events.filter(e => e[0] === "assignment.read" && e[1]); assert.equal(finalReads[0][2], "a");
});
test("wrong PIN keeps five-failure lockout and avoids locked issuance", async () => {
  const f = fixture(); f.controls.validPin = false;
  for (let i = 0; i < 5; i++) assert.equal((await f.login()).status, 401);
  f.controls.validPin = true; assert.equal((await f.login()).status, 429);
  assert.equal(f.tokens.length, 0); assert.ok(!f.events.some(e => e[0] === "begin"));
});
for (const code of ["1234", "12345", "0123", "01234"]) test("exact property code preserved " + code, async () => {
  const f = fixture(); f.state().unit.property.propertyCode = code; assert.equal((await f.login()).status, 200);
});
