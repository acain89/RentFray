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

    async function load() {
      try {
        const res = await fetch("/api/manager/dashboard", {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json();

        if (!active) return;

        if (!res.ok) {
          setError(json?.error || "Failed to load dashboard.");
          return;
        }

        setData(json);
      } catch {
        if (!active) return;
        setError("Failed to load dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredUnits = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();

    return data.units.filter(
      (u) =>
        u.unitNumber.toLowerCase().includes(q) ||
        (u.tenantName || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-slate-600">
        Loading...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-sm text-red-600">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* HEADER */}
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-slate-700">
            RENTFRAY
          </div>

          <h1 className="mt-3 text-2xl font-semibold">
            {data.property.name}
          </h1>

          <p className="text-sm text-slate-600 mt-1">
            Property Code:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {data.property.code}
            </span>
          </p>
        </div>

        {/* SUMMARY */}
        <div className="rounded-[28px] border border-sky-200 bg-white p-5">
          <DashboardSummary
            totalUnits={data.summary.totalUnits}
            occupiedUnits={data.summary.occupiedUnits}
            vacantUnits={data.summary.vacantUnits}
            delinquentUnits={data.summary.delinquentUnits}
          />
        </div>

        {/* STATUS */}
        <div className="rounded-[28px] border border-sky-200 bg-white p-5">
          <StatusCounts
            occupiedUnits={data.summary.occupiedUnits}
            vacantUnits={data.summary.vacantUnits}
            delinquentUnits={data.summary.delinquentUnits}
          />
        </div>

        {/* FINANCIALS */}
        <div className="rounded-[28px] border border-sky-200 bg-white p-5">
          <ExpectedVsCollected
            expected={data.financials.expected}
            collected={data.financials.collected}
            collectionRate={data.financials.collectionRate}
          />
        </div>

        {/* SEARCH */}
        <div className="rounded-[28px] border border-sky-200 bg-white p-4">
          <UnitSearchBar value={query} onChange={setQuery} />
        </div>

        {/* UNITS */}
        <div className="space-y-3">
          {filteredUnits.length === 0 ? (
            <div className="rounded-2xl border p-4 text-sm text-slate-600">
              No units found.
            </div>
          ) : (
            filteredUnits.map((unit) => (
              <div
                key={unit.unitId}
                className="rounded-2xl border bg-white p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      Unit {unit.unitNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {unit.tenantName || "Vacant"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">
                      {money(unit.balance)}
                    </div>
                    <div className="text-xs">
                      {unit.isDelinquent ? (
                        <span className="text-red-600">
                          {unit.daysPastDue} days late
                        </span>
                      ) : (
                        <span className="text-green-600">Current</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}