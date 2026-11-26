import assert from "node:assert/strict";
// Individually reviewed unreferenced local helpers/types; all called financial authorities remain pinned.
const deltas = [
  {
    "file": "app/api/cron/monthly-rent/route.ts",
    "name": "ApiSuccess",
    "reason": "unused type declaration",
    "before": "type ApiSuccess = {\n  ok: true;\n};",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "getCyclePaymentFlags",
    "reason": "uncalled local helper",
    "before": "function getCyclePaymentFlags(payments: DashboardPaymentRow[]): {\n  hasPendingPayment: boolean;\n  hasFailedPayment: boolean;\n  hasReversedPayment: boolean;\n  hasPaidPayment: boolean;\n} {\n  const statuses = payments.map((payment) =>\n    String(payment.status ?? \"\").toUpperCase()\n  );\n\nconst hasPaidPayment = statuses.includes(\"PAID\");\n\nconst hasPendingPayment =\n  !hasPaidPayment && statuses.includes(\"PENDING\");\n\nconst hasFailedPayment =\n  !hasPaidPayment &&\n  !hasPendingPayment &&\n  statuses.includes(\"FAILED\");\n\nconst hasReversedPayment =\n  !hasPaidPayment &&\n  !hasPendingPayment &&\n  statuses.includes(\"REVERSED\");\n\n  return {\n    hasPendingPayment,\n    hasFailedPayment,\n    hasReversedPayment,\n    hasPaidPayment,\n  };\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "buildLedgerSummary",
    "reason": "uncalled local helper",
    "before": "function buildLedgerSummary(input: {\n  entries: DashboardLedgerEntryRow[];\n  rentFrayStartDate: Date | null;\n}): LedgerSummary {\n  let balanceCents = 0;\n  let totalChargesCents = 0;\n  let totalCreditsCents = 0;\n  let totalPaidCents = 0;\n\n  for (const entry of input.entries) {\n    const entryType = normalizeLedgerEntryType(entry.entryType);\n    if (!entryType) continue;\n\n    if (entryType === \"CHARGE\" && input.rentFrayStartDate) {\n      const effectiveDate = toSafeDate(entry.effectiveDate);\n\n      if (effectiveDate && effectiveDate < input.rentFrayStartDate) {\n        continue;\n      }\n    }\n\n    const amountCents = toSafeInteger(entry.amountCents);\n    const paymentStatus = normalizePaymentStatus(entry.payment?.status);\n    const signedImpactCents = getSignedImpactCents({\n      entryType,\n      amountCents,\n      paymentStatus,\n    });\n\n    balanceCents += signedImpactCents;\n\n    if (entryType === \"CHARGE\") {\n      totalChargesCents += Math.abs(amountCents);\n    }\n\n    if (entryType === \"CREDIT\") {\n      totalCreditsCents += Math.abs(amountCents);\n    }\n\n    if (entryType === \"PAYMENT\" && paymentStatus === \"PAID\") {\n      totalPaidCents += Math.abs(amountCents);\n    }\n  }\n\n  return {\n    balanceCents,\n    totalChargesCents,\n    totalCreditsCents,\n    totalPaidCents,\n  };\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "diffDays",
    "reason": "uncalled local helper",
    "before": "function diffDays(later: Date, earlier: Date): number {\n  const msPerDay = 1000 * 60 * 60 * 24;\n\n  return Math.max(\n    0,\n    Math.floor(\n      (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / msPerDay\n    )\n  );\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "parseDateOnly",
    "reason": "uncalled local helper",
    "before": "function parseDateOnly(value: string | null | undefined): Date | null {\n  if (!value) return null;\n\n  const [year, month, day] = value.split(\"-\").map(Number);\n  if (!year || !month || !day) return null;\n\n  const date = new Date(year, month - 1, day);\n  return Number.isNaN(date.getTime()) ? null : date;\n}",
    "after": ""
  },
  {
    "file": "app/api/manual-payments/route.ts",
    "name": "UnitForManualPayment",
    "reason": "unused type declaration",
    "before": "type UnitForManualPayment = {\n  id: string;\n  propertyId: string;\n  unitNumber: string;\n  tier: {\n    rentDueDay: number;\n    gracePeriodDays: number;\n    lateFeeInitialCents: number;\n    lateFeeDailyCents: number;\n    maxLateFeeDays: number;\n  } | null;\n  property: {\n    rentFrayStartDate: Date | null;\n    settings: {\n      rentDueDay: number;\n      gracePeriodDays: number;\n      lateFeeEnabled: boolean;\n      lateFeeFlatCents: number | null;\n    } | null;\n  };\n};",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "getSignedImpactCents",
    "reason": "uncalled local helper",
    "before": "function getSignedImpactCents(input: {\n  entryType: LedgerEntryType;\n  amountCents: number;\n  paymentStatus: PaymentStatus | null;\n}): number {\n  const amountCents = Math.abs(toSafeInteger(input.amountCents));\n\n  if (input.entryType === \"CHARGE\") return amountCents;\n  if (input.entryType === \"PAYMENT\") {\n    return input.paymentStatus === \"PAID\" ? -amountCents : 0;\n  }\n  if (input.entryType === \"CREDIT\") return -amountCents;\n  if (input.entryType === \"ADJUSTMENT\") return toSafeInteger(input.amountCents);\n\n  return 0;\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "toSafeDate",
    "reason": "uncalled local helper",
    "before": "function toSafeDate(value: unknown): Date | null {\n  if (!value) return null;\n\n  const date =\n    value instanceof Date ? value : new Date(value as string | number | Date);\n\n  return Number.isNaN(date.getTime()) ? null : date;\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "normalizePaymentStatus",
    "reason": "uncalled local helper",
    "before": "function normalizePaymentStatus(value: unknown): PaymentStatus | null {\n  const status = String(value ?? \"\").trim().toUpperCase();\n\n  switch (status) {\n    case \"UNPAID\":\n    case \"PENDING\":\n    case \"PAID\":\n    case \"FAILED\":\n    case \"REVERSED\":\n      return status;\n    default:\n      return null;\n  }\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "startOfDay",
    "reason": "uncalled local helper",
    "before": "function startOfDay(date: Date): Date {\n  return new Date(date.getFullYear(), date.getMonth(), date.getDate());\n}",
    "after": ""
  },
  {
    "file": "app/api/manager/dashboard/route.ts",
    "name": "LedgerSummary",
    "reason": "unused type declaration",
    "before": "type LedgerSummary = {\n  balanceCents: number;\n  totalChargesCents: number;\n  totalCreditsCents: number;\n  totalPaidCents: number;\n};",
    "after": ""
  },
  {
    "file": "app/admin/page.tsx",
    "name": "totalOccupiedUnits",
    "before": "const totalOccupiedUnits = useMemo(\n    () => properties.reduce((sum, property) => sum + property.occupiedUnits, 0),\n    [properties]\n  );",
    "after": ""
  },
  {
    "file": "app/api/manager/units/move-tier/route.ts",
    "name": "oldTierRentCents",
    "before": "const oldTierRentCents = Math.max(\n  0,\n  unit.tier?.baseRentCents ?? 0\n);",
    "after": ""
  },
  {
    "file": "lib/proration.ts",
    "name": "month",
    "before": "  const month = moveInDate.getMonth();",
    "after": ""
  },
  {
    "file": "lib/proration.ts",
    "name": "year",
    "before": "  const year = moveInDate.getFullYear();",
    "after": ""
  },
  {
    "file": "scripts/cycle-rollover-test.ts",
    "name": "nextCycle",
    "before": "const nextCycle = \"2026-07\";",
    "after": ""
  },
  {
    "file": "scripts/seed-scale-property.ts",
    "name": "tenantName",
    "before": "    const tenantName = `Tenant ${num}`;",
    "after": ""
  },
  {
    "file": "tests/billing-trigger-audit-semantics.test.ts",
    "name": "monthlyDateHelper",
    "before": "const monthlyDateHelper = \"function businessDateInstant(value: Date): Date {\\n  const day = getBusinessDate(value);\\n  return getBusinessDateInstant(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, \\\"0\\\")}-${String(day.getDate()).padStart(2, \\\"0\\\")}`);\\n}\\n\\n\";",
    "after": ""
  },
  {
    "file": "app/api/admin/properties/[id]/payment-status/route.ts",
    "name": "unused POST request/context parameters",
    "before": "export async function POST(\n  req: Request,\n  { params }: { params: Promise<{ id: string }> }\n) {",
    "after": "export async function POST() {"
  },
  {
    "file": "app/api/admin/properties/[id]/setup/route.ts",
    "name": "unused POST request/context parameters",
    "before": "export async function POST(\n  req: Request,\n  { params }: { params: Promise<{ id: string }> }\n) {",
    "after": "export async function POST() {"
  },
  {
    "file": "app/api/manager/property/set-payment-status/route.ts",
    "name": "unused retired-route request",
    "before": "export async function POST(req: Request) {",
    "after": "export async function POST() {"
  }
] as const;
export function reviewedUnusedDeclarations(file: string, source: string): string {
  let result = source;
  for (const delta of deltas) {
    if (file !== delta.file) continue;
    assert.equal(result.split(delta.before).length, 2, "Exactly one reviewed unused declaration: " + delta.name);
    result = result.replace(delta.before, delta.after);
  }
  return result;
}
