"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  ok: true;
  cutoff: string;
  summary: {
    paidSinceClose: number;
    newPayments: number;
    delinquentUnits: number;
    openMaintenance: number;
    vacantUnits: number;
  };
  counts: {
    paid: number;
    grace: number;
    partial: number;
    delinquent: number;
    vacant: number;
  };
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("en-US");
}

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/dashboard", {
        credentials: "include",
      });
      const json = await res.json();
      if (json?.ok) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="p-6">Failed to load dashboard</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
        <div className="text-sm text-gray-500">
          Since Last Office Close: {fmtDateTime(data.cutoff)}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card title="Paid Since Close" value={money(data.summary.paidSinceClose)} />
        <Card title="New Payments" value={data.summary.newPayments} />
        <Card title="Delinquent Units" value={data.summary.delinquentUnits} />
        <Card title="Open Maintenance" value={data.summary.openMaintenance} />
        <Card title="Vacant Units" value={data.summary.vacantUnits} />
      </div>

      {/* Status Counts */}
      <div>
        <h2 className="text-lg font-medium mb-2">Unit Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card title="Paid" value={data.counts.paid} />
          <Card title="Grace" value={data.counts.grace} />
          <Card title="Partial" value={data.counts.partial} />
          <Card title="Delinquent" value={data.counts.delinquent} />
          <Card title="Vacant" value={data.counts.vacant} />
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}