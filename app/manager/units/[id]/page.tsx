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

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US");
}

export default async function UnitDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    return <div className="p-6">Unit not found</div>;
  }

  type ActiveAssignment = (typeof unit.assignments)[number];
  type LedgerEntry = (typeof unit.ledgerEntries)[number];

  const activeAssignment: ActiveAssignment | null = unit.assignments[0] ?? null;
  const tenant = activeAssignment?.tenant ?? null;

  const summary = await getUnitLedgerSummary(unit.id);
  const delinquency = await getUnitDelinquencySummary(unit.id);
  const settings = await getPropertySettings(unit.propertyId);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unit {unit.unitNumber}</h1>

          <a
            href={`/manager/units/${id}/history`}
            style={{
              display: "inline-block",
              marginTop: 8,
              marginBottom: 12,
              padding: "6px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            View History
          </a>

          <div className="mt-2 space-y-1">
            <div>Tenant: {tenant?.name || "Vacant"}</div>
            <div>Rent: {money(Number(unit.marketRent || 0))}</div>
            <div>Status: {unit.occupancyStatus}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {tenant ? (
            <Link
              href={`/manager/units/${unit.id}/move-out`}
              className="inline-block rounded border px-4 py-2 text-sm font-medium"
            >
              Move Out Tenant
            </Link>
          ) : null}

          {tenant ? (
            <Link
              href={`/manager/units/${unit.id}/tenant`}
              className="inline-block rounded border px-4 py-2 text-sm font-medium"
            >
              Tenant Details
            </Link>
          ) : null}

          <a
            href={`/api/exports/ledger?unitId=${unit.id}`}
            className="inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Export Ledger CSV
          </a>

          <a
            href={`/api/exports/payments?unitId=${unit.id}`}
            className="inline-block rounded border px-4 py-2 text-sm font-medium"
          >
            Export Payments CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Current Balance</div>
          <div className="text-lg font-semibold">{money(summary.balance)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Charges</div>
          <div className="text-lg font-semibold">{money(summary.totalCharges)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Paid</div>
          <div className="text-lg font-semibold">{money(summary.totalPaid)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Last Payment Date</div>
          <div className="text-lg font-semibold">
            {summary.lastPaymentDate ? fmtDate(summary.lastPaymentDate) : "—"}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Last Payment Amount</div>
          <div className="text-lg font-semibold">
            {summary.lastPaymentDate && summary.lastPaymentAmount !== null
              ? money(summary.lastPaymentAmount)
              : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Due Date</div>
          <div className="text-lg font-semibold">{fmtDate(delinquency.dueDate)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Grace Ends</div>
          <div className="text-lg font-semibold">{fmtDate(delinquency.graceEndsOn)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Amount Due Now</div>
          <div className="text-lg font-semibold">{money(delinquency.amountDueNow)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Delinquency</div>
          <div className="text-lg font-semibold">
            {delinquency.isDelinquent ? "DELINQUENT" : "CURRENT"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Late Fee Type</div>
          <div className="text-lg font-semibold">{settings.lateFeeType}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Late Fee Value</div>
          <div className="text-lg font-semibold">
            {settings.lateFeeType === "PERCENT"
              ? `${Number(settings.lateFeeValue || 0)}%`
              : money(Number(settings.lateFeeValue || 0))}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Late Fee Status</div>
          <div className="text-lg font-semibold">
            {lateFeePreview.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Recommended Late Fee</div>
          <div className="text-lg font-semibold">
            {money(lateFeePreview.recommendedLateFee)}
          </div>
        </div>
      </div>

      <div className="rounded border p-3 space-y-2">
        <div className="text-xs text-gray-500">Late Fee Reason</div>
        <div className="text-sm">{lateFeePreview.reason}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Billing Day</div>
          <div className="text-lg font-semibold">{settings.billingDay}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Cycle Start</div>
          <div className="text-lg font-semibold">{fmtDate(rentPreview.cycleStart)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Next Rent Date</div>
          <div className="text-lg font-semibold">{fmtDate(rentPreview.nextBillingDate)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Rent Status</div>
          <div className="text-lg font-semibold">
            {rentPreview.hasChargeThisCycle ? "ALREADY POSTED" : "READY TO POST"}
          </div>
        </div>
      </div>

      <div className="rounded border p-3 space-y-2">
        <div className="text-xs text-gray-500">Upcoming Rent Charge</div>
        <div className="text-sm">
          {rentPreview.upcomingCharge
            ? `${money(rentPreview.upcomingCharge.amount)} scheduled for ${fmtDate(
                rentPreview.upcomingCharge.effectiveDate
              )}`
            : "Already charged this cycle"}
        </div>
      </div>

      {tenant ? (
        <>
          <div className="flex flex-wrap gap-3">
            <PostRentButton unitId={unit.id} />
            <PostLateFeeButton unitId={unit.id} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ManualChargeForm
              propertyId={unit.propertyId}
              unitId={unit.id}
              tenantId={tenant.id}
              defaultRent={Number(unit.marketRent || 0)}
            />

            <ManualPaymentForm
              propertyId={unit.propertyId}
              unitId={unit.id}
              tenantId={tenant.id}
            />
          </div>
        </>
      ) : (
        <div className="rounded border p-4 text-sm text-gray-600">
          Unit is vacant. Current tenant-facing balance and ledger view are reset
          until a new tenant is assigned.
        </div>
      )}

      <div>
        <h2 className="mb-2 font-semibold">Ledger</h2>

        <div className="space-y-2">
          {ledgerRows.length === 0 ? (
            <div className="text-sm text-gray-500">No current tenant ledger entries.</div>
          ) : (
            ledgerRows
              .slice()
              .reverse()
              .map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-5"
                >
                  <div>
                    <div className="text-xs text-gray-500">Type</div>
                    <div className="font-medium">{entry.type}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Effective Date</div>
                    <div>{fmtDate(entry.effectiveDate)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Memo</div>
                    <div>{entry.memo || "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div>{money(Number(entry.amount || 0))}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Running Balance</div>
                    <div className="font-medium">{money(entry.runningBalance)}</div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}