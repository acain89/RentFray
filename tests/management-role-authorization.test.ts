import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export function load(file: string, imports: Record<string, any>, append = "") {
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), "utf8") + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, Date, URL, Buffer,
    process: { env: { NEXT_PUBLIC_BASE_URL: "https://isolated.invalid", NODE_ENV: "test" } },
    console: { error() {} },
    require(name: string) { if (!(name in imports)) throw Error("Unmocked import: " + name); return imports[name]; },
  });
  return module.exports;
}
export const request = (body: any = {}) => ({ json: async () => body, headers: { get: () => null } });
export const context = (id = "p") => ({ params: Promise.resolve({ id }) });
export function fixture(role: string | null = "OWNER") {
  const calls: any[] = [];
  const session = role ? { role, propertyId: "p", managementUserId: "caller" } : null;
  const db: any = {};
  const imports: any = {
    "next/server": { NextResponse: { json: (body: any, options: any = {}) => ({ body, status: options.status ?? 200 }),
      redirect: (url: any) => ({ url: String(url), status: 307 }) } },
    "@/lib/session": { getSession: async () => session, refreshSessionCookie: async () => {},
      requireManagerLevelSession: async () => { if (!session || !["OWNER", "MANAGER"].includes(session.role)) throw Error("Forbidden"); return session; },
      requireManagementSession: async () => { if (!session || !["OWNER", "MANAGER", "STAFF"].includes(session.role)) throw Error("Forbidden"); return session; },
      createSessionToken: (input: any) => { calls.push(["session", input]); return "isolated-cookie"; },
      setSessionCookie: async () => {}, clearSessionCookie: async () => {} },
    "@/lib/permissions": { isManagementRole: (r: string) => ["OWNER", "MANAGER", "STAFF"].includes(r),
      canManageFinancials: (r: string) => ["OWNER", "MANAGER"].includes(r), canManageMaintenancePins: (r: string) => ["OWNER", "MANAGER"].includes(r) },
    "@/lib/prisma": { prisma: db },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {}, TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "bcryptjs": { hash: async () => "bcrypt-isolated", compare: async () => true },
    "@/lib/email": { sendVerificationEmail: async (input: any) => { calls.push(["email", input]); },
      hashEmailVerificationToken: () => "hashed-token", sendWelcomeEmail: async () => {} },
    "@/lib/managementAuth": { verifyManagementPassword: async () => true },
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "next/navigation": { redirect: (url: string) => { throw Error("redirect:" + url); } },
    "react/jsx-runtime": { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) },
    "@/lib/pin": { hashPin: async () => "pin-isolated", isValidFourDigitPin: () => true },
    "@/lib/billingCalendar": { lockBillingCalendar: async () => { throw Error("Unexpected calendar write"); }, BillingCalendarError: class extends Error {} },
    "@/lib/destructiveRetention": { assertPristineProperty: async () => { throw Error("Unexpected deletion"); }, lockRetentionProperty: async () => {}, DestructiveRetentionError: class extends Error {} },
  };
  for (const model of ["property", "propertySettings", "unit", "propertyTier", "propertyTierCharge", "managementUser", "maintenanceRequest", "auditLog", "tenantAssignment", "paymentConnectionStatus", "emailVerificationToken"]) {
    db[model] = {};
    for (const method of ["findMany", "findFirst", "findUnique", "create", "update", "updateMany", "upsert", "delete", "count", "aggregate"]) {
      db[model][method] = async (args: any) => { calls.push([model + "." + method, args]);
        if (method === "findMany") return [];
        if (method === "count") return 0;
        if (method === "updateMany") return { count: 1 };
        if (method === "aggregate") return { _sum: { unitCount: 2 } };
        if (method === "findFirst") return null;
        return { id: "p", propertyCode: "1234", settings: {}, tiers: [], ...args?.data };
      };
    }
  }
  db.$queryRaw = async () => []; db.$executeRaw = async () => 0;
  db.$transaction = async (fn: any) => typeof fn === "function" ? fn(db) : Promise.all(fn);
  return { imports, db, calls, session };
}

const reads = ["manager/property/qr", "manager/units/inactive", "admin/properties/[id]/charges",
  "admin/properties/[id]/management-users", "admin/properties/[id]", "manager/onboarding/property", "manager/property/payment-status"];
for (const route of reads) for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " reads " + route, async () => {
  const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).GET(request(), context());
  assert.equal(result.status, 200);
  for (const [operation, args] of f.calls) if (operation.endsWith("findMany") || operation.endsWith("findUnique")) {
    assert.ok(args.where.propertyId === "p" || args.where.id === "p", operation + " must be property scoped");
  }
});
for (const route of ["admin/properties/[id]", "admin/properties/[id]/charges", "admin/properties/[id]/management-users"])
  for (const role of ["OWNER", "MANAGER", "STAFF"]) test(role + " foreign read denied " + route, async () => {
    const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).GET(request(), context("foreign"));
    assert.ok([401, 403].includes(result.status)); assert.equal(f.calls.length, 0);
  });
for (const [route, method] of [["manager/maintenance/update", "POST"], ["manager/account/change-login", "POST"],
  ["manager/units/toggle-active", "POST"], ["admin/properties/[id]/charges", "POST"],
  ["admin/properties/[id]", "PATCH"], ["manager/onboarding/property", "PATCH"]]) test("STAFF denied " + route, async () => {
    const f = fixture("STAFF"); const result = await load("app/api/" + route + "/route.ts", f.imports)[method](request(), context());
    assert.ok(result.status >= 400); assert.equal(f.calls.length, 0);
  });
for (const role of ["OWNER", "MANAGER", "MAINTENANCE"]) for (const instruction of [{ status: "COMPLETE" }, { action: "DELETE" }]) test(role + " maintenance " + JSON.stringify(instruction), async () => {
  const f = fixture(role); f.db.maintenanceRequest.findFirst = async (args: any) => {
    assert.equal(args.where.propertyId, "p"); return { id: "request", status: "OPEN", unit: { unitNumber: "1" } };
  };
  const result = await load("app/api/manager/maintenance/update/route.ts", f.imports).POST(request({ requestId: "request", ...instruction }));
  assert.equal(result.status, 200); assert.ok(f.calls.some(c => c[0] === ("action" in instruction ? "maintenanceRequest.delete" : "maintenanceRequest.update")));
});
for (const role of ["OWNER", "MANAGER"]) {
  test(role + " changes own credentials", async () => {
    const f = fixture(role); let reads = 0;
    f.db.managementUser.findUnique = async (args: any) => { assert.equal(args.where.id, "caller"); return { id: "caller", email: "old@isolated.invalid", username: "old@isolated.invalid", isActive: true, passwordHash: "hash" }; };
    f.db.managementUser.findFirst = async () => { reads++; return null; };
    const result = await load("app/api/manager/account/change-login/route.ts", f.imports).POST(request({ currentLogin: "old@isolated.invalid", currentPassword: "oldpassword", newEmail: "new@isolated.invalid", newPassword: "password123", confirmPassword: "password123" }));
    assert.equal(result.status, 200); assert.equal(reads, 1); assert.equal(f.calls.find(c => c[0] === "managementUser.update")[1].where.id, "caller");
  });
  test(role + " toggles scoped unit", async () => {
    const f = fixture(role); f.db.unit.findFirst = async (args: any) => { assert.equal(args.where.propertyId, "p"); return { id: "unit", tenantAssignments: [], tierId: null }; };
    const result = await load("app/api/manager/units/toggle-active/route.ts", f.imports).POST(request({ unitId: "unit", makeActive: true }));
    assert.equal(result.status, 200); assert.equal(f.calls.find(c => c[0] === "unit.update")[1].data.isActive, true);
  });
  for (const route of ["manager/maintenance/update", "manager/units/toggle-active"]) test(role + " foreign resource rejected " + route, async () => {
    const f = fixture(role); const result = await load("app/api/" + route + "/route.ts", f.imports).POST(request({ requestId: "foreign", status: "COMPLETE", unitId: "foreign", makeActive: false }));
    assert.ok(result.status >= 400); assert.ok(!f.calls.some(c => /\.(update|delete|create)$/.test(c[0])));
  });
}
