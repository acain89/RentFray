import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

export const root = resolve(__dirname, "..");
export function load(file: string, imports: Record<string, any>, extras = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Buffer, Date, URL,
    process: { env: { NODE_ENV: "production", SESSION_SECRET: "isolated-retention" } },
    console: { error() {} }, require(name: string) {
      if (!(name in imports)) throw Error("Unmocked import: " + name);
      return imports[name];
    }, ...extras });
  return module.exports;
}
export const historyModels = ["tenantAssignment", "ledgerEntry", "payment", "maintenanceRequest", "unitNote", "unitRecurringFee", "auditLog"];
export function fixture(role = "ADMIN") {
  const events: string[] = []; let writes = 0, inTransaction = false;
  const unit: any = { id: "unit", propertyId: "a", tierId: "tier", isActive: false,
    portalActivated: false, portalFirstName: null, portalLastName: null, tenantPinHash: null,
    activatedAt: null, activationSource: null };
  const property: any = { id: "a", status: "SETUP", stripeAccountId: null, rentFrayStartDate: null,
    setupCompleteAcknowledgedAt: null, units: [unit], settings: { onboardingComplete: false, setupComplete: false },
    managementUsers: [{ lastLoginAt: null, emailVerifiedAt: null }], maintenanceUsers: [{ lastLoginAt: null }],
    paymentStatus: { processorConnected: false, bankConnected: false, chargesEnabled: false, payoutsEnabled: false,
      onboardingComplete: false, requirementsDue: false, requirementsSummary: null, lastSyncedAt: null, readyForLive: false } };
  const records: Record<string, any[]> = Object.fromEntries(historyModels.map(name => [name, []]));
  function matches(row: any, where: any): boolean {
    return Object.entries(where ?? {}).every(([key, value]: [string, any]) => key === "OR"
      ? value.some((part: any) => matches(row, part)) : value && typeof value === "object" && "contains" in value
      ? typeof row[key] === "string" && row[key].includes(value.contains) : row[key] === value);
  }
  function read(name: string) { assert.equal(inTransaction, true); assert.ok(events[0]?.includes('FROM "Property"')); events.push(name); }
  const write = (name: string) => { assert.equal(inTransaction, true); events.push(name); writes++; };
  const prisma: any = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      assert.equal(inTransaction, true); const sql = strings.join("?"); assert.ok(sql.includes("FOR UPDATE"));
      assert.ok(!sql.includes("a'")); events.push(sql); assert.ok(values.every(v => typeof v === "string")); return [];
    },
    $transaction: async (fn: any, options: any) => { assert.equal(options.isolationLevel, "ReadCommitted"); events.push("transaction"); inTransaction = true;
      // Reads assert the first SQL lock, rather than an earlier out-of-transaction read.
      events.shift(); try { return await fn(prisma); } finally { inTransaction = false; } },
    unit: {
      findFirst: async ({ where, select }: any) => { read("unit.read");
        if (!matches(unit, where)) return null;
        return { ...unit, tenantAssignments: select?.tenantAssignments
          ? records.tenantAssignment.filter(row => matches(row, { unitId: unit.id, ...select.tenantAssignments.where })) : [] }; },
      count: async () => { read("unit.count"); return 0; },
      delete: async ({ where }: any) => { assert.equal(where.id, unit.id); write("unit.delete"); return unit; },
    },
    property: {
      findUnique: async ({ where }: any) => { read("property.read"); return where.id === property.id ? property : null; },
      delete: async ({ where }: any) => { assert.equal(where.id, property.id); write("property.delete"); return property; },
    },
    propertyTier: { update: async ({ data }: any) => { assert.equal(data.activeUnitCount, 0); write("tier.update"); } },
  };
  for (const name of historyModels) prisma[name] = {
    findFirst: async ({ where }: any) => { read(name + ".read"); return records[name].find(row => matches(row, where)) ?? null; },
    deleteMany: async () => { write(name + ".deleteMany"); },
  };
  let token: string | undefined;
  const session = load("lib/session.ts", { crypto, "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "@/lib/prisma": { prisma: { adminAccess: { findUnique: async ({ where }: any) => where.id === "admin" ? { id: "admin", isActive: true } : null }, managementUser: { findUnique: async () => ({ id: "user", propertyId: "a", role, isActive: true }) } } } });
  if (role === "invalid") token = "malformed";
  else if (role !== "absent") token = session.createSessionToken(role === "ADMIN" ? { role, adminAccessId: "admin" } : { role, propertyId: "a", managementUserId: "user" });
  const retention = load("lib/destructiveRetention.ts", {});
  const imports = { "@/lib/prisma": { prisma }, "@/lib/session": session,
    "@/lib/destructiveRetention": retention, "@prisma/client": { Prisma: {} },
    "next/server": { NextResponse: { json: (body: any, options?: any) => ({ body, status: options?.status ?? 200 }) } } };
  const manager = load("app/api/manager/units/delete/route.ts", imports);
  const admin = load("app/api/admin/properties/[id]/units/route.ts", imports);
  const propertyApi = load("app/api/admin/properties/[id]/route.ts", { ...imports,
    "@/lib/billingCalendar": { BillingCalendarError: class extends Error {} } });
  return { unit, property, records, events, retention, prisma, manager, admin, propertyApi, writes: () => writes,
    callUnit: (kind: "manager" | "admin", unitId = "unit", propertyId = "a") => kind === "manager"
      ? manager.POST({ json: async () => ({ unitId }) })
      : admin.DELETE({ json: async () => ({ unitId }) }, { params: Promise.resolve({ id: propertyId }) }),
    callProperty: (id = "a") => propertyApi.DELETE({}, { params: Promise.resolve({ id }) }) };
}
for (const kind of ["manager", "admin"] as const) {
  for (const role of ["absent", "invalid", "STAFF", ...(kind === "manager" ? ["ADMIN"] : ["OWNER", "MANAGER"])])
    test(kind + ": rejects " + role, async () => { const f = fixture(role); assert.equal((await f.callUnit(kind)).status, 401); assert.equal(f.writes(), 0); assert.equal(f.events.length, 0); });
  for (const role of kind === "manager" ? ["OWNER", "MANAGER"] : ["ADMIN"])
    test(kind + ": pristine succeeds for " + role, async () => { const f = fixture(role); const response = await f.callUnit(kind);
      assert.equal(response.status, 200); assert.equal(response.body.ok, true);
      if (kind === "admin") { assert.equal(response.body.data.unitId, "unit"); assert.ok(f.events.includes("tier.update")); }
      else assert.equal(f.writes(), 1); });
  for (const id of ["missing", "foreign"]) test(kind + ": " + id + " scope rejected", async () => {
    const f = fixture(kind === "manager" ? "OWNER" : "ADMIN"); if (id === "foreign") f.unit.propertyId = "b";
    assert.notEqual((await f.callUnit(kind, id === "missing" ? id : "unit")).status, 200); assert.equal(f.writes(), 0);
  });
  for (const [model, extra] of [
    ["tenantAssignment", { isCurrent: true, moveOutDate: null }], ["tenantAssignment", { isCurrent: false }],
    ["tenantAssignment", { isCurrent: true, moveInDate: new Date("2099-01-01"), moveOutDate: new Date("2099-12-31") }],
    ["ledgerEntry", {}], ["ledgerEntry", { amountCents: 0 }], ["ledgerEntry", { voidedAt: new Date() }],
    ...["UNPAID", "PENDING", "FAILED", "PAID", "REVERSED"].map(status => ["payment", { status }]),
    ["payment", { stripeSessionId: "cs_isolated", stripePaymentIntentId: "pi_isolated" }],
    ["maintenanceRequest", {}], ["unitNote", {}], ["unitRecurringFee", {}],
    ["auditLog", { targetId: "unit", action: "UNIT_VACATED" }],
    ["auditLog", { metadataJson: JSON.stringify({ unitId: "unit" }), propertyId: null }],
  ] as [string, any][]) test(kind + ": preserves " + model + " " + JSON.stringify(extra), async () => {
    const f = fixture(kind === "manager" ? "OWNER" : "ADMIN"); f.records[model].push({ id: "history", unitId: "unit", propertyId: "a", ...extra });
    const before = JSON.stringify(f.records); const response = await f.callUnit(kind);
    assert.equal(response.status, 409); assert.match(response.body.error, /history/); assert.equal(f.writes(), 0);
    assert.equal(JSON.stringify(f.records), before); assert.equal(f.unit.isActive, false);
  });
  for (const field of ["portalActivated", "portalFirstName", "portalLastName", "tenantPinHash", "activatedAt", "activationSource"])
    test(kind + ": portal evidence " + field, async () => { const f = fixture(kind === "manager" ? "OWNER" : "ADMIN");
      f.unit[field] = field === "portalActivated" ? true : field === "activatedAt" ? new Date() : "";
      assert.equal((await f.callUnit(kind)).status, 409); assert.equal(f.writes(), 0); });
  test(kind + ": zero net balance remains historical", async () => { const f = fixture(kind === "manager" ? "OWNER" : "ADMIN");
    f.records.ledgerEntry.push({ id: "charge", unitId: "unit", amountCents: 100 }, { id: "credit", unitId: "unit", amountCents: -100 });
    assert.equal((await f.callUnit(kind)).status, 409); assert.equal(f.writes(), 0); });
}
test("manager: active pristine unit still rejected", async () => { const f = fixture("MANAGER"); f.unit.isActive = true;
  assert.equal((await f.callUnit("manager")).status, 404); assert.equal(f.writes(), 0); });
test("admin: URL property scope remains authoritative", async () => { const f = fixture();
  assert.notEqual((await f.callUnit("admin", "unit", "b")).status, 200); assert.equal(f.writes(), 0); });
