import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const pageFile = "app/manager/units/[id]/page.tsx";
export function detailFixture(status = "PAID", role = "OWNER", authority?: (input: any) => Promise<any>) {
  const calls: any[] = [], controls = [() => null, () => null, () => null];
  const state: any = {
    ledgerBalanceCents: 12345, tenantTotalDueCents: status === "PENDING" ? 0 : 12600,
    ledgerSummary: { balanceCents: 12345, totalChargesCents: 23456, totalPaidCents: 11111, currentCycleRentChargesCents: 5000 },
    status: { status, color: "blue", label: `Canonical ${status}`, tenantMessage: `Authority ${status}` },
    isDelinquent: status === "PAST_DUE", isWithinGracePeriod: status === "GRACE", hasPendingPayment: status === "PENDING",
    daysPastDue: 47, dueDate: "2026-10-01", graceEndsOn: "2026-10-03",
    effectiveBillingSettings: { dueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 700, lateFeeDailyCents: 200, maxLateFeeDays: 10 },
    rentDates: { dueDate: "2026-10-01", nextDueDate: "2026-11-01" },
  };
  const unit: any = { id: "u", propertyId: "p", unitNumber: "101", tier: { lateFeeType: "FLAT", processingFeeCents: 20 },
    property: { id: "p", name: "Property", settings: null },
    tenantAssignments: [{ id: "b", firstName: "Replacement", lastName: "Tenant", moveInDate: new Date("2026-09-01") }],
    ledgerEntries: [], payments: [], notes: [], maintenanceRequests: [] };
  const jsx = (type: any, props: any) => ({ type, props }); const module = { exports: {} as any };
  const imports: any = { "@/lib/session": { requireManagementSession: async () => ({ role, propertyId: "p" }) },
    "@/lib/prisma": { prisma: { unit: { findFirst: async (args: any) => {
      assert.equal(args.where.propertyId, "p"); assert.equal(args.include.tenantAssignments.where.moveOutDate, null);
      return args.where.id === "u" ? unit : null; } } } },
    "@/lib/unitFinancialState": { getUnitFinancialState: async (input: any) => { calls.push(input); return authority ? authority(input) : state; } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": () => null,
    "./ManualPaymentForm": controls[0], "./ManualChargeForm": controls[1], "./PostRentButton": controls[2] };
  runInNewContext(ts.transpileModule(readFileSync(pageFile, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, Date, require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
  return { unit, state, calls, controls, render: (id = "u") => module.exports.default({ params: Promise.resolve({ id }) }) };
}
export function nodes(node: any): any[] {
  if (node == null) return []; if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node]; return [node, ...nodes(node.props?.children)];
}
export const textOf = (tree: any) => nodes(tree).filter(n => typeof n === "string" || typeof n === "number").join(" ");
for (const status of ["PENDING", "FAILED", "PAID", "GRACE", "PAST_DUE"]) test(`detail consumes canonical ${status}`, async () => {
  const f = detailFixture(status); const text = textOf(await f.render());
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].tenantAssignmentId, "b");
  assert.equal(f.calls[0].propertyId, "p"); assert.equal(f.calls[0].unitId, "u");
  assert.match(text, /\$123\.45/); assert.match(text, /\$234\.56/); assert.match(text, /\$111\.11/);
  assert.ok(text.includes(`Canonical ${status}`)); assert.ok(text.includes(`Authority ${status}`));
  assert.ok(text.includes("47")); assert.ok(text.includes("10/1/2026")); assert.ok(text.includes("10/3/2026"));
  assert.ok(text.includes("Already posted")); assert.ok(text.includes("\$7.00"));
  if (status === "PENDING") assert.ok(text.includes("\$0.00"));
  assert.ok(!text.includes("Eligible to post late fee")); assert.ok(!text.includes("based on current delinquency timing"));
});
test("vacancy and STAFF read/mutation boundaries preserved", async () => {
  const f = detailFixture("PAID", "STAFF"); const tree = await f.render();
  assert.equal(nodes(tree).filter(n => f.controls.includes(n.type)).length, 0);
  f.unit.tenantAssignments = []; const text = textOf(await f.render()); assert.match(text, /VACANT/);
  assert.equal(f.calls.length, 1); assert.ok(!text.includes("\$123.45"));
});
test("no competing status, balance or late-fee calculator", () => {
  const source = readFileSync(pageFile, "utf8");
  for (const forbidden of ["resolveStatus", "getUnitDelinquencySummary", "getUnitLedgerSummary", "recommendedLateFeeCents", "runningBalanceCents"]) assert.ok(!source.includes(forbidden), forbidden);
  assert.ok(source.includes("getUnitFinancialState")); assert.ok(source.includes("applied automatically"));
});

test("real canonical financial authority preserves null accounting and prior-cycle FIFO aging", async () => {
  function load(file: string, imports: any) {
    const module = { exports: {} as any };
    runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText, { module, exports: module.exports, Date, Intl,
      require: (name: string) => { assert.ok(name in imports, name); return imports[name]; } });
    return module.exports;
  }
  const ledger = load("lib/ledger.ts", { "@/lib/prisma": { prisma: {
    ledgerEntry: { findMany: async ({ where }: any) => {
      assert.equal(where.unitId, "u"); assert.equal(where.OR[0].tenantAssignmentId, "b");
      assert.equal(where.OR[1].tenantAssignmentId, null);
      return [{ id: "current", amountCents: 10000, entryType: "CHARGE", chargeType: "RENT",
        billingCycle: "2026-09", effectiveDate: new Date("2026-09-01"), createdAt: new Date("2026-09-01"), payment: null },
      { id: "unassigned", amountCents: 700, entryType: "CHARGE", chargeType: "LATE_FEE",
        billingCycle: "2026-09", effectiveDate: new Date("2026-09-03"), createdAt: new Date("2026-09-03"), payment: null }];
    } }, payment: { findMany: async () => [] },
  } } });
  const dates = load("lib/rentDates.ts", {});
  const status = load("lib/unitStatusEngine.ts", {});
  const canonical = load("lib/unitFinancialState.ts", {
    "@/lib/ledger": ledger, "@/lib/rentDates": dates, "@/lib/unitStatusEngine": status,
    "@/lib/billingConfig": { getProcessingFeeCents: () => 0 },
    "@/lib/billingCalendar": { assertTierBillingCalendar: () => 1 },
  });
  let result: any;
  const f = detailFixture("PAID", "OWNER", async input => {
    result = await canonical.getUnitFinancialState({ ...input, now: new Date("2026-10-05T18:00:00Z") }); return result;
  });
  f.unit.tier = { rentDueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 700, lateFeeDailyCents: 200, maxLateFeeDays: 10 };
  f.unit.property.rentFrayStartDate = new Date("2026-01-01T18:00:00Z");
  const text = textOf(await f.render()); assert.equal(result.ledgerBalanceCents, 10700);
  assert.equal(result.status.status, "PAST_DUE"); assert.ok(result.daysPastDue > 30);
  assert.ok(text.includes("$107.00")); assert.ok(text.includes(String(result.daysPastDue)));
  assert.ok(text.includes(result.status.label));
});
