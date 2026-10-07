import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// No real Prisma, Next server, or external service is loaded by these fixtures.
class Clock extends Date {
  constructor(...args: any[]) { super(args.length ? Reflect.construct(Date, args).getTime() : new Date("2026-10-07T18:00:00Z").getTime()); }
  static now() { return new Date("2026-10-07T18:00:00Z").getTime(); }
}
function load(file: string, imports: Record<string, any>) {
  const module = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, Date: Clock, Intl, URL, Buffer,
    process: { env: { SESSION_SECRET: "isolated-export-contract", NODE_ENV: "production" } }, console: { error() {} },
    require(name: string) { assert.ok(name in imports, `Unmocked: ${name}`); return imports[name]; } });
  return module.exports;
}
class Reply {
  status: number; body: any;
  constructor(body: any, options: any = {}) { this.body = body; this.status = options.status ?? 200; }
  static json(body: any, options: any = {}) { return new Reply(body, options); }
}
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, value]: any) => {
    if (value === undefined) return true;
    if (key === "OR") return value.some((w: any) => matches(row, w));
    if (value && typeof value === "object") {
      if ("contains" in value) return String(row[key]).toLowerCase().includes(value.contains.toLowerCase());
      if ("lte" in value) return new Date(row[key]).getTime() <= value.lte.getTime();
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
function fixture(role: string | null = "OWNER") {
  const queries: any[] = [], cookies = new Map<string, string>();
  const management: any = { id: "m", propertyId: "p", role, isActive: true, passwordHash: "isolated-hash" };
  const units: any[] = ["101", "102"].map((unitNumber, i) => ({ id: `u${i + 1}`, propertyId: "p", isActive: true, unitNumber,
    property: { name: "Property", propertyCode: "1234", settings: { rentDueDay: 1, gracePeriodDays: 2, lateFeeEnabled: false }, rentFrayStartDate: new Date("2026-01-01T06:00:00Z") },
    tier: { id: "t", name: "Tier", baseRentCents: 1000, rentDueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 0, lateFeeDailyCents: 0, maxLateFeeDays: 0 },
    tenantAssignments: [{ id: `b${i + 1}`, firstName: "Current", lastName: unitNumber, moveInDate: new Date("2026-10-01T05:00:00Z") }] }));
  units.push({ ...units[0], id: "foreign", propertyId: "q", unitNumber: "999" });
  const entries: any[] = [], payments: any[] = [];
  function entry(type: string, amount: number, changes: any = {}) {
    const row = { id: `e${entries.length}`, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", billingCycle: "2026-10", voidedAt: null,
      entryType: type, amountCents: amount, chargeType: "RENT", effectiveDate: new Date("2026-10-01T05:00:00Z"), createdAt: new Date("2026-10-02T18:00:00Z"),
      unit: units[0], property: units[0].property, tenantAssignment: { firstName: "Current", lastName: "101" }, payment: null, ...changes };
    entries.push(row); return row;
  }
  function payment(status: string, changes: any = {}) {
    const row = { id: `p${payments.length}`, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", billingCycle: "2026-10", amountCents: 1000,
      status, processingFeeCents: 50, createdAt: new Date("2026-10-02T18:00:00Z"), unit: units[0], tenantAssignment: { firstName: "Current", lastName: "101" }, ...changes };
    payments.push(row); entry("PAYMENT", -row.amountCents, { ...changes, payment: row }); return row;
  }
  const db = {
    managementUser: { findUnique: async () => management },
    adminAccess: { findUnique: async () => ({ id: "admin", isActive: true }) },
    maintenanceUser: { findUnique: async () => ({ id: "worker", propertyId: "p", isActive: true }) },
    tenantAssignment: { findUnique: async () => ({ id: "b1", propertyId: "p", unitId: "u1", isCurrent: true, moveOutDate: null }) },
    unit: {
      findFirst: async ({ where }: any) => { queries.push({ model: "unit", where }); return units.find(u => matches(u, where)) ?? null; },
      findMany: async ({ where }: any) => { queries.push({ model: "units", where }); return units.filter(u => matches(u, where)); },
    },
    ledgerEntry: { findMany: async (args: any) => { queries.push({ model: "ledger", ...args }); return entries.filter(e => matches(e, args.where)); } },
    payment: { findMany: async (args: any) => { queries.push({ model: "payment", ...args }); return payments.filter(p => matches(p, args.where)); } },
  };
  const session = load("lib/session.ts", { crypto, "@/lib/prisma": { prisma: db }, "next/headers": { cookies: async () => ({ get: (name: string) => cookies.has(name) ? { value: cookies.get(name) } : undefined }) } });
  if (role) cookies.set("rf_session", session.createSessionToken(["OWNER", "MANAGER", "STAFF"].includes(role)
    ? { role, propertyId: "p", managementUserId: "m", managementCredentialBinding: session.createManagementCredentialBinding("m", management.passwordHash) }
    : { role, propertyId: "p", unitId: "u1", tenantAssignmentId: "b1", adminAccessId: "admin", maintenanceUserId: "worker" }));
  const dates = load("lib/rentDates.ts", {});
  const canonical = load("lib/unitFinancialState.ts", {
    "@/lib/ledger": load("lib/ledger.ts", { "@/lib/prisma": { prisma: db } }), "@/lib/rentDates": dates,
    "@/lib/unitStatusEngine": load("lib/unitStatusEngine.ts", {}),
    "@/lib/billingCalendar": load("lib/billingCalendar.ts", { "@/lib/rentDates": dates, "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: {} } }),
    "@/lib/billingConfig": { getProcessingFeeCents: () => 50 },
  });
  const states: any[] = [];
  async function get(route: string, query = "") {
    return load(`app/api/exports/${route}/route.ts`, { "next/server": { NextResponse: Reply }, "@/lib/prisma": { prisma: db }, "@/lib/session": session,
      "@/lib/billingConfig": { formatCentsToDollars: (c: number) => (c / 100).toFixed(2) },
      "@/lib/unitFinancialState": { getUnitFinancialState: async (input: any) => { const state = await canonical.getUnitFinancialState(input); states.push({ input, state }); return state; } },
    }).GET({ url: `https://isolated.invalid/api/exports/${route}?${query}` });
  }
  return { get, units, entries, payments, entry, payment, queries, states, management };
}
function rows(reply: Reply): Record<string, string>[] {
  assert.equal(reply.status, 200);
  const [header, ...lines] = reply.body.split("\n"); if (!header) return [];
  const keys = header.split(",");
  return lines.map((line: string) => Object.fromEntries(line.split(",").map((value: string, i: number) => [keys[i], value])));
}
for (const alias of ["month", "billingCycle", "cycle"]) test(`balances ${alias}: unit search, multiple assignments and distinct totals`, async () => {
  const f = fixture(); f.entry("CHARGE", 1000);
  f.entry("CHARGE", 100000, { tenantAssignmentId: "a", tenantAssignment: { firstName: "Old", lastName: "Tenant" } });
  f.entry("CHARGE", 9000, { billingCycle: "2026-09" });
  f.entry("CHARGE", 7777, { effectiveDate: new Date("2026-10-31T05:00:00Z") });
  const result = rows(await f.get("balances", `${alias}=2026-10&unit=101`));
  assert.equal(result.length, 1); assert.equal(result[0].billingCycle, "2026-10");
  assert.equal(result[0].periodChargesCents, "101000"); assert.equal(result[0].currentBalanceCents, "10000");
  assert.equal(result[0].tenantName, "Current 101");
  const period = f.queries.find(q => q.include?.payment); assert.equal(period.where.tenantAssignmentId, undefined);
  assert.equal(period.include.payment.select.status, true); assert.ok(period.where.effectiveDate.lte);
});
for (const status of ["PAID", "PENDING", "FAILED", "REVERSED"]) test(`period ${status}, credits and signed adjustments; real canonical current state`, async () => {
  const f = fixture(); f.entry("CHARGE", 100000); f.payment(status, { amountCents: 100000 });
  f.entry("CREDIT", 500); f.entry("ADJUSTMENT", -200); f.entry("ADJUSTMENT", 100); f.entry("CHARGE", 99999, { voidedAt: new Date() });
  const row = rows(await f.get("balances", "month=2026-10&unit=101"))[0];
  assert.equal(row.periodPaidCents, status === "PAID" ? "100000" : "0");
  assert.equal(row.periodCreditsCents, "500"); assert.equal(row.periodAdjustmentsCents, "-100");
  assert.equal(Number(row.periodNetCents), 100000 - (status === "PAID" ? 100000 : 0) - 600);
  const state = f.states[0].state; assert.equal(Number(row.currentBalanceCents), state.ledgerBalanceCents);
  assert.equal(row.currentStatus, state.status.status); assert.equal(row.isDelinquent, state.isDelinquent ? "YES" : "NO");
  assert.equal(row.currentPending, state.hasPendingPayment ? "YES" : "NO");
  assert.equal(Number(row.amountDueNowCents), status === "PENDING" ? 0 : state.ledgerBalanceCents);
});
test("canonical grace, prepaid credit and prior-cycle aging", async () => {
  const f = fixture(); f.units[0].tier.gracePeriodDays = 10; f.units[0].property.settings.gracePeriodDays = 10;
  f.entry("CHARGE", 1000);
  let row = rows(await f.get("balances", "unit=101"))[0]; assert.equal(row.currentGrace, "YES");
  f.entry("CREDIT", 2000); row = rows(await f.get("balances", "unit=101"))[0]; assert.equal(row.currentBalanceCents, "0"); assert.equal(row.currentStatus, "PAID");
  const prior = fixture(); prior.entry("CHARGE", 1000, { billingCycle: "2026-09", effectiveDate: new Date("2026-09-01T05:00:00Z") });
  row = rows(await prior.get("balances", "unit=101"))[0]; assert.equal(row.isDelinquent, "YES"); assert.ok(Number(row.daysPastDue) > 30);
});
test("vacancy retains historical unit-period totals, no current financial attribution", async () => {
  const f = fixture(); f.entry("CHARGE", 1000, { tenantAssignmentId: "a" }); f.units[0].tenantAssignments = [];
  const row = rows(await f.get("balances", "month=2026-10&unit=101"))[0];
  assert.equal(row.occupancyStatus, "VACANT"); assert.equal(row.tenantName, ""); assert.equal(row.currentBalanceCents, "0");
  assert.equal(row.currentStatus, "VACANT"); assert.equal(row.periodNetCents, "1000"); assert.equal(f.states.length, 0);
});
for (const route of ["ledger", "payments"]) {
  test(`${route} exact unit and search intersection, historical and NULL attribution`, async () => {
    const f = fixture(); f.payment("PAID", { tenantAssignmentId: "a", tenantAssignment: { firstName: "Old", lastName: "Tenant" } });
    f.payment("PAID", { tenantAssignmentId: null, tenantAssignment: null });
    f.payment("PAID", { unitId: "u2", unit: f.units[1] }); f.payment("PAID", { propertyId: "q", unitId: "foreign", unit: f.units[2] });
    let result = rows(await f.get(route, "unitId=u1")); assert.equal(result.length, 2);
    assert.equal(result[0].tenantName, "Old Tenant"); assert.equal(result[1].tenantName, ""); assert.ok(result.every(r => r.unitNumber === "101"));
    assert.equal(rows(await f.get(route, "unitId=u1&unit=102")).length, 0);
    assert.equal(rows(await f.get(route, "unit=102")).length, 1);
  });
  for (const id of ["foreign", "missing", ""]) test(`${route} invalid exact unit=${id} never falls back`, async () => {
    const f = fixture(); f.payment("PAID"); assert.equal((await f.get(route, `unitId=${id}`)).status, 404);
    assert.ok(!f.queries.some(q => q.model === "ledger" || q.model === "payment"));
  });
}
for (const route of ["balances", "ledger", "payments"]) {
  for (const role of ["OWNER", "MANAGER", "STAFF"]) test(`${route} RF-15 bound ${role} read access and revocation`, async () => {
    const f = fixture(role); f.entry("CHARGE", 1000); assert.equal((await f.get(route)).status, 200);
    f.management.passwordHash = "replacement"; const before = f.queries.length;
    assert.equal((await f.get(route)).status, 401); assert.equal(f.queries.length, before);
  });
  for (const role of [null, "TENANT", "MAINTENANCE", "ADMIN"]) test(`${route} rejects ${role ?? "missing"} before export queries`, async () => {
    const f = fixture(role); assert.equal((await f.get(route)).status, 401); assert.equal(f.queries.length, 0);
  });
  test(`${route} rejects property override and malformed period`, async () => {
    const f = fixture(); assert.equal((await f.get(route, "propertyId=q")).status, 403);
    assert.equal((await f.get(route, "month=bad")).status, 400); assert.equal(f.queries.length, 0);
  });
  test(`${route} read-only and existing CSV formatter retained`, () => {
    const source = readFileSync(`app/api/exports/${route}/route.ts`, "utf8");
    assert.ok(!/prisma\.\w+\.(create|update|delete|upsert)/.test(source));
    assert.ok(source.includes('str.replace(/"/g, \'""\')')); assert.ok(source.includes('"Cache-Control": "no-store"'));
  });
}
