import { isRecord } from "./fixture-assertions";
import type { PropertyTier } from "@prisma/client";
type FinancialInput = Parameters<typeof import("../lib/unitFinancialState").getUnitFinancialState>[0];

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";


export const pageFile = "app/manager/units/[id]/page.tsx";
export function detailFixture(status = "PAID", role = "OWNER", authority?: (input: FinancialInput) => Promise<unknown>) {
  const calls: FinancialInput[] = [], controls = [() => null, () => null, () => null];
  const state = {
    ledgerBalanceCents: 12345, tenantTotalDueCents: status === "PENDING" ? 0 : 12600,
    ledgerSummary: { balanceCents: 12345, totalChargesCents: 23456, totalPaidCents: 11111, currentCycleRentChargesCents: 5000 },
    status: { status, color: "blue", label: `Canonical ${status}`, tenantMessage: `Authority ${status}` },
    isDelinquent: status === "PAST_DUE", isWithinGracePeriod: status === "GRACE", hasPendingPayment: status === "PENDING",
    daysPastDue: 47, dueDate: "2026-10-01", graceEndsOn: "2026-10-03",
    effectiveBillingSettings: { dueDay: 1, gracePeriodDays: 2, lateFeeInitialCents: 700, lateFeeDailyCents: 200, maxLateFeeDays: 10 },
    rentDates: { dueDate: "2026-10-01", nextDueDate: "2026-11-01" },
  };
  const unit: { id: string; propertyId: string; unitNumber: string; tier: Partial<PropertyTier>; property: { id: string; name: string; settings: null; rentFrayStartDate?: Date }; tenantAssignments: { id: string; firstName: string; lastName: string; moveInDate: Date }[]; ledgerEntries: unknown[]; payments: unknown[]; notes: unknown[]; maintenanceRequests: unknown[] } = { id: "u", propertyId: "p", unitNumber: "101", tier: { lateFeeType: "FLAT", processingFeeCents: 20 },
    property: { id: "p", name: "Property", settings: null },
    tenantAssignments: [{ id: "b", firstName: "Replacement", lastName: "Tenant", moveInDate: new Date("2026-09-01") }],
    ledgerEntries: [], payments: [], notes: [], maintenanceRequests: [] };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props }); const fixtureModule: { exports: unknown } = { exports: {} };
  const imports = { "@/lib/session": { requireManagementSession: async () => ({ role, propertyId: "p" }) },
    "@/lib/prisma": { prisma: { unit: { findFirst: async (args: { where: { id: string; propertyId: string }; include: { tenantAssignments: { where: { moveOutDate: null } } } }) => {
      assert.equal(args.where.propertyId, "p"); assert.equal(args.include.tenantAssignments.where.moveOutDate, null);
      return args.where.id === "u" ? unit : null; } } } },
    "@/lib/unitFinancialState": { getUnitFinancialState: async (input: FinancialInput) => { calls.push(input); return authority ? authority(input) : state; } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": () => null,
    "./ManualPaymentForm": controls[0], "./ManualChargeForm": controls[1], "./PostRentButton": controls[2] };
  runInNewContext(ts.transpileModule(readFileSync(pageFile, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module: fixtureModule, exports: fixtureModule.exports, Date, require: (name: string) => { assert.ok(name in imports, name); const value: unknown = Reflect.get(imports, name); return value; } });
  const namespace = fixtureModule.exports; assert.ok(isRecord(namespace));
  const component = namespace.default; assert.ok(typeof component === "function");
  return { unit, state, calls, controls, render: async (id = "u"): Promise<unknown> => Reflect.apply(component, namespace, [{ params: Promise.resolve({ id }) }]) };
}
export function nodes(node: unknown): unknown[] {
  if (node == null) return []; if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== "object") return [node]; return [node, ...nodes(isRecord(node) && isRecord(node.props) ? node.props.children : undefined)];
}
export const textOf = (tree: unknown) => nodes(tree).filter(n => typeof n === "string" || typeof n === "number").join(" ");
