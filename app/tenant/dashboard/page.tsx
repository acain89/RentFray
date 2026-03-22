// app/tenant/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PayNowButton from "@/app/components/PayNowButton";

type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  effectiveDate: string;
  memo?: string | null;
};

type DashboardData = {
  ok: true;
  tenantName: string;
  propertyName?: string;
  propertyStatus: string;
  paymentEnabled: boolean;
  unitNumber?: string;
  unitId: string;
  balance: number;
  totalPaid: number;
  isDelinquent: boolean;
  ledger: LedgerEntry[];
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US");
}

export default function TenantDashboard() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/tenant/dashboard", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        const result = await res.json().catch(() => null);

        if (!active) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok || !result?.ok) {
          setError(result?.error || "Failed to load dashboard.");
          return;
        }

        setData(result);
        setAmount(String(Number(result.balance || 0).toFixed(2)));
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
  }, [router]);

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
        <div className="space-y-3 text-center">
          <div className="text-red-600 text-sm">{error || "Error loading."}</div>
          <button
            onClick={() => router.replace("/property-code")}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  const numericAmount = Number(amount || 0);
  const paymentBlocked = !data.paymentEnabled;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md space-y-6">

        {/* HEADER */}
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-slate-700">
            RENTFRAY
          </div>

          <h1 className="mt-3 text-2xl font-semibold">
            {data.tenantName}
          </h1>

          <p className="text-sm text-slate-600 mt-1">
            {data.propertyName} · Unit {data.unitNumber}
          </p>
        </div>

        {/* BALANCE (PRIMARY BLOCK) */}
        <div className="rounded-[28px] border border-sky-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs text-slate-500">Current Balance</p>

          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {money(data.balance)}
          </p>

          <p className="mt-2 text-sm font-medium">
            {data.isDelinquent ? (
              <span className="text-red-600">Past Due</span>
            ) : (
              <span className="text-green-600">Current</span>
            )}
          </p>
        </div>

        {/* PAYMENT */}
        {!paymentBlocked && data.balance > 0 && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm font-semibold">Make a Payment</p>

            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-lg"
            />

            <PayNowButton unitId={data.unitId} amount={numericAmount} />
          </div>
        )}

        {paymentBlocked && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            Payments are currently disabled.
          </div>
        )}

        {/* SECONDARY ACTIONS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/tenant/payment-history")}
            className="rounded-xl border px-4 py-3 text-sm"
          >
            Payments
          </button>

          <button
            onClick={() => router.push("/tenant/maintenance")}
            className="rounded-xl border px-4 py-3 text-sm"
          >
            Maintenance
          </button>
        </div>

        {/* ACTIVITY */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Recent Activity</h2>

          <div className="space-y-2">
            {data.ledger.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border p-3 text-sm"
              >
                <div className="flex justify-between">
                  <span>{entry.type}</span>
                  <span>{money(entry.amount)}</span>
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  {fmtDate(entry.effectiveDate)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}