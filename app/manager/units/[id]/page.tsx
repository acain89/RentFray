import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUnitLedgerSummary } from "@/lib/ledger";
import { getUnitDelinquencySummary } from "@/lib/delinquency";
import { getPropertySettings } from "@/lib/propertySettings";
import { getLateFeePreview } from "@/lib/lateFees";
import { getRentPreview } from "@/lib/rentPreview";
import ManualPaymentForm from "./ManualPaymentForm";
import ManualChargeForm from "./ManualChargeForm";
import PostRentButton from "./PostRentButton";
import PostLateFeeButton from "./PostLateFeeButton";
import UnitNotes from "@/app/components/UnitNotes";

function money(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US");
}

function formatDayLabel(days: number): string {
  if (days <= 0) return "Current";
  if (days === 1) return "1 day past due";
  return `${days} days past due`;
}

type UnitStatus = "PAID" | "PARTIAL" | "GRACE" | "DELINQUENT" | "VACANT";

function resolveStatus(
  balance: number,
  isDelinquent: boolean,
  hasTenant: boolean,
  daysPastDue: number
): UnitStatus {
  if (!hasTenant) return "VACANT";
  if (balance <= 0) return "PAID";
  if (isDelinquent) return "DELINQUENT";
  if (daysPastDue > 0) return "GRACE";
  return "PARTIAL";
}

function statusPillClasses(status: UnitStatus): string {
  switch (status) {
    case "DELINQUENT":
      return "border-red-200 bg-red-50 text-red-700";
    case "GRACE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "PARTIAL":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "VACANT":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function balanceToneClasses(status: UnitStatus, balance: number): string {
  if (status === "DELINQUENT") return "text-red-600";
  if (status === "GRACE") return "text-amber-600";
  if (status === "PAID" || balance <= 0) return "text-emerald-600";
  if (status === "VACANT") return "text-slate-500";
  return "text-slate-900";
}

function paymentStatusClasses(status: string | null): string {
  switch (status) {
    case "PROCESSING":
      return "bg-blue-50 border-blue-200 text-blue-700";
    case "PENDING":
      return "bg-slate-100 border-slate-200 text-slate-700";
    case "FAILED":
      return "bg-red-50 border-red-200 text-red-700";
    case "REFUNDED":
      return "bg-purple-50 border-purple-200 text-purple-700";
    case "PAID":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function sectionCardClasses(emphasis = false): string {
  return [
    "rounded-3xl border shadow-sm",
    emphasis
      ? "border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
      : "border-slate-200/80 bg-white",
  ].join(" ");
}

type PageParams = Promise<{ id: string }> | { id: string };

export default async function UnitDetail({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await Promise.resolve(params);

  if (!id) {
    throw new Error("Missing unit id");
  }

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { moveOut: null },
        orderBy: { moveIn: "desc" },
        include: { tenant: true },
      },
      ledgerEntries: {
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!unit) {
    return (
      <div className="min-h-[50vh] bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">
              Unit not found
            </div>
            <div className="mt-2 text-sm text-slate-600">
              The requested unit could not be located.
            </div>
            <Link
              href="/manager/units"
              className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to units
            </Link>
          </div>
        </div>
      </div>
    );
  }

  type ActiveAssignment = (typeof unit.assignments)[number];
  type LedgerEntry = (typeof unit.ledgerEntries)[number];

  const activeAssignment: ActiveAssignment | null = unit.assignments[0] ?? null;
  const tenant = activeAssignment?.tenant ?? null;

  const summary = await getUnitLedgerSummary(unit.id);
  const latestPayment = await prisma.payment.findFirst({
  where: { unitId: unit.id },
  orderBy: { createdAt: "desc" },
});

  const delinquency = await getUnitDelinquencySummary(unit.id);
  const settings = await getPropertySettings(unit.propertyId);

  const status = resolveStatus(
    summary.balance,
    delinquency.isDelinquent,
    Boolean(tenant),
    delinquency.daysPastDue || 0
  );

  const currentLedgerEntries: LedgerEntry[] = activeAssignment
    ? unit.ledgerEntries.filter((entry: LedgerEntry) => {
        const entryDate = new Date(entry.effectiveDate).getTime();
        const moveInDate = new Date(activeAssignment.moveIn).getTime();
        const sameTenantOrUnitLevel =
          !entry.tenantId || entry.tenantId === activeAssignment.tenantId;

        return entryDate >= moveInDate && sameTenantOrUnitLevel;
      })
    : [];

  const lateFeePreview = getLateFeePreview({
    balance: summary.balance,
    isDelinquent: delinquency.isDelinquent,
    settings,
  });

  const rentPreview = getRentPreview({
    billingDay: settings.billingDay,
    marketRent: Number(unit.marketRent || 0),
    ledgerEntries: currentLedgerEntries.map((entry: LedgerEntry) => ({
      type: entry.type,
      effectiveDate: entry.effectiveDate,
      amount: Number(entry.amount || 0),
    })),
  });

  let runningBalance = 0;
  const ledgerRows = currentLedgerEntries.map((entry: LedgerEntry) => {
    runningBalance += Number(entry.amount || 0);
    return {
      ...entry,
      runningBalance,
    };
  });

  const amountDueNow = Number(delinquency.amountDueNow || 0);
  const daysPastDue = Number(delinquency.daysPastDue || 0);
  const hasBalance = Number(summary.balance || 0) > 0;

  const attentionMessage =
    status === "DELINQUENT"
      ? `Immediate action recommended. This unit is delinquent and ${formatDayLabel(
          daysPastDue
        ).toLowerCase()}.`
      : status === "GRACE"
      ? `Payment window is active. This unit is in grace and ${formatDayLabel(
          daysPastDue
        ).toLowerCase()}.`
      : status === "PARTIAL"
      ? "A balance remains on this unit. Review payment activity and next recommended action."
      : status === "PAID"
      ? "This unit is currently clear with no outstanding balance."
      : "This unit is vacant. Tenant-facing ledger activity is inactive until a new tenant is assigned.";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/manager/units"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Back to units
              </Link>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${statusPillClasses(
                  status
                )}`}
              >
                {status}
              </span>
              {tenant ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  Active tenant
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  No active tenant
                </span>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Unit {unit.unitNumber}
              </h1>
              <div className="mt-2 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <span>
                  Tenant:{" "}
                  <span className="font-semibold text-slate-900">
                    {tenant?.name || "Vacant"}
                  </span>
                </span>
                <span>
                  Market rent:{" "}
                  <span className="font-semibold text-slate-900">
                    {money(Number(unit.marketRent || 0))}
                  </span>
                </span>
                <span>
                  Move-in:{" "}
                  <span className="font-semibold text-slate-900">
                    {fmtDate(activeAssignment?.moveIn)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/manager/units/${unit.id}/history`}
              className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              View history
            </Link>

            {tenant && (
              <>
                <Link
                  href={`/manager/units/${unit.id}/tenants`}
                  className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Tenant details
                </Link>
                <Link
                  href={`/manager/units/${unit.id}/move-out`}
                  className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Move out
                </Link>
              </>
            )}

            <a
              href={`/api/exports/ledger?unitId=${unit.id}`}
              className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Export ledger
            </a>

            <a
              href={`/api/exports/payments?unitId=${unit.id}`}
              className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Export payments
            </a>
          </div>
        </div>

        <section className={`${sectionCardClasses(true)} overflow-hidden`}>
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Current balance
                </div>
                {status === "DELINQUENT" && (
                  <span className="inline-flex rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-200">
                    Urgent
                  </span>
                )}
                {status === "GRACE" && (
                  <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                    Grace period
                  </span>
                )}
              </div>

              <div
                className={`mt-5 text-4xl font-bold tracking-tight sm:text-5xl ${
                  status === "DELINQUENT"
                    ? "text-red-300"
                    : status === "GRACE"
                    ? "text-amber-200"
                    : status === "PAID"
                    ? "text-emerald-300"
                    : status === "VACANT"
                    ? "text-slate-300"
                    : "text-white"
                }`}
              >
                {money(summary.balance)}
              </div>

              <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {attentionMessage}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Amount due now
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {money(amountDueNow)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Days past due
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {daysPastDue > 0 ? daysPastDue : 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Last payment
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {summary.lastPaymentAmount !== null
                      ? money(summary.lastPaymentAmount)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Action center
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Prioritize the next move fast. High-value actions stay visible
                first.
              </div>

              {tenant ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="mb-3 text-sm font-semibold text-slate-900">
                      Primary actions
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <PostRentButton unitId={unit.id} />
                      <PostLateFeeButton unitId={unit.id} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Payment status
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        {hasBalance
                          ? "Outstanding balance remains"
                          : "No outstanding balance"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Use manual payment or rent posting tools below to update
                        the ledger.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Late fee status
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        {lateFeePreview.eligible
                          ? "Eligible to post late fee"
                          : "Not currently eligible"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Recommended amount:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(lateFeePreview.recommendedLateFee)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Secondary actions
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        href={`/manager/units/${unit.id}/history`}
                        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Review history
                      </Link>
                      <Link
                        href={`/manager/units/${unit.id}/tenants`}
                        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Open tenant record
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-900">
                    Vacant unit
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    Tenant-facing balance and current-occupancy ledger views are
                    inactive until a new tenant is assigned.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

<section className={sectionCardClasses(true)}>
  <div className="border-b border-slate-200 px-6 py-5">
    <div className="text-lg font-semibold text-slate-950">
      Payment activity
    </div>
    <div className="mt-1 text-sm text-slate-600">
      Latest payment lifecycle status and recent activity.
    </div>
  </div>

  <div className="p-6">
    {!latestPayment ? (
      <div className="text-sm text-slate-500">
        No recent payment activity.
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">
              Latest payment
            </div>
            <div className="text-lg font-semibold text-slate-950">
              {money(latestPayment.amountCents / 100)}
            </div>
          </div>

          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${paymentStatusClasses(
              latestPayment.status
            )}`}
          >
            {latestPayment.status}
          </div>
        </div>

        <div className="text-sm text-slate-600">
          {latestPayment.status === "PROCESSING" &&
            "Payment is currently processing through ACH."}
          {latestPayment.status === "PENDING" &&
            "Payment session created. Awaiting completion."}
          {latestPayment.status === "FAILED" &&
            "Payment failed. Retry may be required."}
          {latestPayment.status === "REFUNDED" &&
            "Payment was refunded and reversed."}
          {latestPayment.status === "PAID" &&
            "Payment successfully completed and recorded."}
        </div>

        <div className="text-xs text-slate-500">
          Created: {fmtDate(latestPayment.createdAt)}
        </div>
      </div>
    )}
  </div>
</section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-lg font-semibold text-slate-950">
                  Financial snapshot
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Core balance, charges, payments, and timeline at a glance.
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Current balance
                  </div>
                  <div
                    className={`mt-2 text-2xl font-bold ${balanceToneClasses(
                      status,
                      summary.balance
                    )}`}
                  >
                    {money(summary.balance)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Total charges
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {money(summary.totalCharges)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Total paid
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {money(summary.totalPaid)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Last payment date
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {summary.lastPaymentDate
                      ? fmtDate(summary.lastPaymentDate)
                      : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Last payment amount
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {summary.lastPaymentAmount !== null
                      ? money(summary.lastPaymentAmount)
                      : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Occupancy status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {tenant ? "Occupied" : "Vacant"}
                  </div>
                </div>
              </div>
            </section>

            {tenant && (
              <section className={sectionCardClasses()}>
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="text-lg font-semibold text-slate-950">
                    Ledger actions
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Post charges and record payments without leaving the unit.
                  </div>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Add charge
                    </div>
                    <ManualChargeForm
                      propertyId={unit.propertyId}
                      unitId={unit.id}
                      tenantId={tenant.id}
                      defaultRent={Number(unit.marketRent || 0)}
                    />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Record payment
                    </div>
                    <ManualPaymentForm
                      propertyId={unit.propertyId}
                      unitId={unit.id}
                      tenantId={tenant.id}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      Ledger
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Current-occupancy ledger entries with running balance.
                    </div>
                  </div>
                  <a
                    href={`/api/exports/ledger?unitId=${unit.id}`}
                    className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Export ledger
                  </a>
                </div>
              </div>

              <div className="p-6">
                {ledgerRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                    No current tenant ledger entries.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ledgerRows
                      .slice()
                      .reverse()
                      .map((entry) => {
                        const entryAmount = Number(entry.amount || 0);
                        const isCredit = entryAmount < 0;

                        return (
                          <div
                            key={entry.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-950">
                                    {entry.type}
                                  </span>
                                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                    {fmtDate(entry.effectiveDate)}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-slate-600">
                                  {entry.memo || "—"}
                                </div>
                              </div>

                              <div className="sm:text-right">
                                <div
                                  className={`text-lg font-bold ${
                                    isCredit
                                      ? "text-emerald-600"
                                      : "text-slate-950"
                                  }`}
                                >
                                  {money(entryAmount)}
                                </div>
                                <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                  Running balance: {money(entry.runningBalance)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-lg font-semibold text-slate-950">
                  Delinquency
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Due dates, grace timing, and urgency signals.
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Due date
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {fmtDate(delinquency.dueDate)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Grace ends
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {fmtDate(delinquency.graceEndsOn)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Amount due now
                  </div>
                  <div className="mt-2 text-lg font-semibold text-red-600">
                    {money(delinquency.amountDueNow)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {delinquency.isDelinquent ? "Delinquent" : "Current"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {formatDayLabel(daysPastDue)}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-lg font-semibold text-slate-950">
                  Rent cycle
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Current billing position and upcoming charge timing.
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Billing day
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {settings.billingDay}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Cycle start
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {fmtDate(rentPreview.cycleStart)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Next rent date
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {fmtDate(rentPreview.nextBillingDate)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Rent status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {rentPreview.hasChargeThisCycle
                      ? "Already posted"
                      : "Ready to post"}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Upcoming rent charge
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {rentPreview.upcomingCharge
                      ? `${money(
                          rentPreview.upcomingCharge.amount
                        )} scheduled for ${fmtDate(
                          rentPreview.upcomingCharge.effectiveDate
                        )}`
                      : "Already charged this cycle"}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-lg font-semibold text-slate-950">
                  Late fee guidance
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Current rule set and posting recommendation.
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Late fee type
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {settings.lateFeeType}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Late fee value
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {settings.lateFeeType === "PERCENT"
                      ? `${Number(settings.lateFeeValue || 0)}%`
                      : money(Number(settings.lateFeeValue || 0))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Eligibility
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {lateFeePreview.eligible ? "Eligible" : "Not eligible"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recommended late fee
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {money(lateFeePreview.recommendedLateFee)}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Reason
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {lateFeePreview.reason}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionCardClasses()}>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-lg font-semibold text-slate-950">
                  Notes
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Shared operational context for this unit.
                </div>
              </div>

              <div className="p-6">
                <UnitNotes unitId={unit.id} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}