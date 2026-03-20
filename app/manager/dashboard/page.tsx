// app/manager/dashboard/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardSummary from "@/app/components/manager/DashboardSummary";
import StatusCounts from "@/app/components/manager/StatusCounts";
import ExpectedVsCollected from "@/app/components/manager/ExpectedVsCollected";
import UnitSearchBar from "@/app/components/manager/UnitSearchBar";

type UnitRow = {
  unitId: string;
  unitNumber: string;
  tenantName: string | null;
  balance: number;
  isDelinquent: boolean;
  daysPastDue: number;
};

type DashboardData = {
  ok: true;
  property: {
    id: string;
    name: string;
    code: string;
  };
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    delinquentUnits: number;
  };
  financials: {
    expected: number;
    collected: number;
    collectionRate: number;
  };
  units: UnitRow[];
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/manager/dashboard", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json();

        if (!active) return;

        if (!res.ok) {
          setData(null);
          setError(json?.error || "Failed to load dashboard.");
          setLoading(false);
          return;
        }

        setData(json);
        setLoading(false);
      } catch {
        if (!active) return;
        setData(null);
        setError("Failed to load dashboard.");
        setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const filteredUnits = useMemo(() => {
    if (!data) return [];

    const q = query.trim().toLowerCase();

    if (!q) return data.units;

    return data.units.filter((unit) => {
      return (
        unit.unitNumber.toLowerCase().includes(q) ||
        (unit.tenantName || "").toLowerCase().includes(q)
      );
    });
  }, [data, query]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-sm text-neutral-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Failed to load dashboard."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.property.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Property Code: {data.property.code}
          </p>
        </div>

        <div className="mb-6">
          <DashboardSummary
            totalUnits={data.summary.totalUnits}
            occupiedUnits={data.summary.occupiedUnits}
            vacantUnits={data.summary.vacantUnits}
            delinquentUnits={data.summary.delinquentUnits}
          />
        </div>

        <div className="mb-6">
          <StatusCounts
            occupiedUnits={data.summary.occupiedUnits}
            vacantUnits={data.summary.vacantUnits}
            delinquentUnits={data.summary.delinquentUnits}
          />
        </div>

        <div className="mb-6">
          <ExpectedVsCollected
            expected={data.financials.expected}
            collected={data.financials.collected}
            collectionRate={data.financials.collectionRate}
          />
        </div>

        <div className="mb-6">
          <UnitSearchBar value={query} onChange={setQuery} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {filteredUnits.length === 0 ? (
            <div className="p-6 text-sm text-neutral-600">No units found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-sm">
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Tenant</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Days Past Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((unit) => (
                    <tr key={unit.unitId} className="border-b border-neutral-100">
                      <td className="px-4 py-3 text-sm">{unit.unitNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        {unit.tenantName || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{money(unit.balance)}</td>
                      <td className="px-4 py-3 text-sm">
                        {unit.isDelinquent ? "Delinquent" : "Current"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {unit.daysPastDue || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}