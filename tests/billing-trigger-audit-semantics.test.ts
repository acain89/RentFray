import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { source, response, root } from "./required-audit-atomicity.test";
import { assertApprovedMonthlyChange, assertApprovedSchemaChange } from "./recurring-charge-boundaries-schema.test";


// Permit exact RF-05 date changes; the remaining source stays byte-identical.
const monthlyDateHelper = "function businessDateInstant(value: Date): Date {\n  const day = getBusinessDate(value);\n  return getBusinessDateInstant(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, \"0\")}-${String(day.getDate()).padStart(2, \"0\")}`);\n}\n\n";
const webhookDateHelper = "function businessDateInstant(): Date {\n  const day = getBusinessDate();\n  return getBusinessDateInstant(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, \"0\")}-${String(day.getDate()).padStart(2, \"0\")}`);\n}\n\n";
function approvedDateChange(file: string, before: string): string {
  if (file === "lib/unitFinancialState.ts") return before
    .replace('function startOfDay(\n  date: Date\n): Date {\n  return new Date(', 'function calendarOrdinal(\n  date: Date\n): number {\n  return Date.UTC(')
    .replace('startOfDay(later).getTime()', 'calendarOrdinal(later)')
    .replace('startOfDay(earlier).getTime()', 'calendarOrdinal(earlier)');
  if (file === "app/api/stripe/webhook/route.ts") return before
    .replace('import { getBusinessDate } from "@/lib/rentDates";', 'import { getBusinessDate, getBusinessDateInstant } from "@/lib/rentDates";')
    .replace('export const runtime', webhookDateHelper + 'export const runtime')
    .replaceAll('effectiveDate: getBusinessDate()', 'effectiveDate: businessDateInstant()');
  return before;
}

for (const [file, action, posted] of [["app/api/ledger/post-rent/route.ts", "RENT_POSTED", 3],
  ["app/api/ledger/post-recurring-fees/route.ts", "RECURRING_FEES_POSTED", 4]] as const) {
  for (const mode of ["job-fail", "job-throw", "success", "audit-fail"] as const) test(action + ": " + mode, async () => {
    let jobs = 0, audits = 0; const logs: any[][] = [];
    const result = { ok: mode !== "job-fail", processedUnits: 10, dueUnits: 7, rentChargesCreated: 3, recurringFeeChargesCreated: 4,
      existingChargesSkipped: 2, skippedNoTenant: 1, skippedNotDue: 2, skippedMoveInAfterDue: 1, failedUnits: 0 };
    const api = source(file, { "next/server": response,
      "@/lib/session": { getSession: async () => ({ role: "OWNER", propertyId: "p", managementUserId: "caller" }) },
      "@/lib/permissions": { canManageFinancials: () => true },
      "@/jobs/monthlyRent": { runMonthlyRentJob: async (date: any, propertyId: string) => { jobs++; assert.ok(date instanceof Date); assert.equal(propertyId, "p");
        if (mode === "job-throw") throw Error("job failure"); return result; } },
      "@/lib/prisma": { prisma: { auditLog: { create: async ({ data }: any) => { audits++; assert.equal(data.action, action);
        if (mode === "audit-fail") throw Error("SECRET audit exception must not be logged"); return data; } } } },
    }, "", { console: { error: (...args: any[]) => logs.push(args) } });
    const res = await api.POST(); assert.equal(jobs, 1);
    if (mode.startsWith("job")) { assert.equal(res.status, 500); assert.equal(audits, 0); }
    else { assert.equal(res.status, 200); assert.equal(res.body.ok, true); assert.equal(res.body.data.posted, posted); assert.equal(res.body.data.skipped, 6); assert.equal(audits, 1); }
    if (mode === "audit-fail") { assert.equal(logs.length, 1); assert.match(String(logs[0]), /summary audit failed/); assert.ok(!String(logs[0]).includes("SECRET")); }
  });
}
test("canonical job, identities, advisory locks and duplicate suppression remain unchanged", () => {
  const file = "jobs/monthlyRent.ts";
  const before = execFileSync("git", ["show", "5da580d96891dabaa4926e661d6f44b23f7a5ae8:" + file], { cwd: root, encoding: "utf8" });
  const after = readFileSync(resolve(root, file), "utf8"); assertApprovedMonthlyChange(before.replace(/\r\n/g, "\n"), after.replace(/\r\n/g, "\n")
    .replace(monthlyDateHelper, "")
    .replace("const assignmentStart = businessDateInstant(", "const assignmentStart = getBusinessDate(")
    .replace("const feeStartDate = businessDateInstant(fee.createdAt);", "const feeStartDate = getBusinessDate(fee.createdAt);"));
  assert.ok(after.replace(/\r\n/g, "\n").includes(monthlyDateHelper));
  assert.ok(after.includes("const assignmentStart = businessDateInstant("));
  assert.ok(after.includes("const feeStartDate = businessDateInstant(fee.createdAt);"));
  assert.ok(after.includes("pg_try_advisory_lock")); assert.ok(after.includes("skipDuplicates: true"));
});
test("protected financial, session, Stripe reconciliation and D6/D8 authorities are unchanged", () => {
  for (const file of ["prisma/schema.prisma", "lib/session.ts", "lib/ledger.ts", "lib/unitFinancialState.ts", "lib/billingCalendar.ts",
    "lib/rentDates.ts", "lib/manualFinancialOperations.ts", "lib/paymentStatus.ts", "jobs/lateFees.ts", "app/api/stripe/webhook/route.ts",
    "app/api/payments/create-session/route.ts", "app/api/stripe/connect/route.ts", "app/api/stripe/onboard/route.ts",
    "app/api/manager/dashboard/route.ts", "lib/realtime.ts", "app/api/stream/route.ts", "app/manager/units/[id]/page.tsx"]) {
    const baseline = file === "app/api/payments/create-session/route.ts" ? "79a3bd5ebcc2e6149f7c9de168d3c43ef5af0eea" : "5da580d96891dabaa4926e661d6f44b23f7a5ae8";
    const before = execFileSync("git", ["show", baseline + ":" + file], { cwd: root, encoding: "utf8" });
    const after = readFileSync(resolve(root, file), "utf8");
    if (file === "prisma/schema.prisma") assertApprovedSchemaChange(before.replace(/\r\n/g, "\n"), after.replace(/\r\n/g, "\n"));
    else assert.equal(after.replace(/\r\n/g, "\n"), approvedDateChange(file, before.replace(/\r\n/g, "\n")), file);
  }
});
