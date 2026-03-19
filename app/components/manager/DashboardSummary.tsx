"use client";

type DashboardSummaryData = {
  paidSinceClose: number;
  newPayments: number;
  delinquentUnits: number;
  openMaintenance: number;
  vacantUnits: number;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function DashboardSummary({
  summary,
}: {
  summary: DashboardSummaryData;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <SummaryCard
        label="Paid Since Close"
        value={money(summary.paidSinceClose)}
      />
      <SummaryCard
        label="New Payments"
        value={String(summary.newPayments)}
      />
      <SummaryCard
        label="Delinquent Units"
        value={String(summary.delinquentUnits)}
      />
      <SummaryCard
        label="Open Maintenance"
        value={String(summary.openMaintenance)}
      />
      <SummaryCard
        label="Vacant Units"
        value={String(summary.vacantUnits)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}