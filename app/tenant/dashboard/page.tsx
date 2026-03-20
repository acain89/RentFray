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
        setLoading(true);
        setError("");

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
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="text-sm text-neutral-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8 space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
          <button
            onClick={() => router.replace("/property-code")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            Back to Login
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="text-sm text-neutral-600">No dashboard data found.</div>
        </div>
      </main>
    );
  }

  const numericAmount = Number(amount || 0);
  const paymentBlocked = !data.paymentEnabled;

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.tenantName}
          </h1>
          {(data.propertyName || data.unitNumber) && (
            <div className="mt-2 text-sm text-neutral-600">
              {data.propertyName ? data.propertyName : ""}
              {data.propertyName && data.unitNumber ? " · " : ""}
              {data.unitNumber ? `Unit ${data.unitNumber}` : ""}
            </div>
          )}
        </div>

        {paymentBlocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Payments are currently disabled for this property preview.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Balance</div>
            <div className="text-lg font-semibold">{money(data.balance)}</div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Total Paid</div>
            <div className="text-lg font-semibold">{money(data.totalPaid)}</div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Status</div>
            <div className="text-lg font-semibold">
              {data.isDelinquent ? "DELINQUENT" : "CURRENT"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push("/tenant/payment-history")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            View Payment History
          </button>

          <button
            onClick={() => router.push("/tenant/maintenance")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            Maintenance
          </button>

          <button
            onClick={() => router.push("/tenant/balance")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            View Balance Detail
          </button>
        </div>

        {data.balance > 0 && data.paymentEnabled ? (
          <div className="space-y-2 rounded-xl border border-neutral-200 p-4">
            <div className="text-sm font-medium">Make a Payment</div>

            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-black"
            />

            <PayNowButton unitId={data.unitId} amount={numericAmount} />
          </div>
        ) : null}

        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>

          <div className="space-y-2">
            {data.ledger.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
                No activity yet.
              </div>
            ) : (
              data.ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-4"
                >
                  <div>
                    <div className="text-xs text-neutral-500">Type</div>
                    <div className="font-medium">{entry.type}</div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Date</div>
                    <div>{fmtDate(entry.effectiveDate)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Memo</div>
                    <div>{entry.memo || "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Amount</div>
                    <div className="font-medium">{money(entry.amount)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}