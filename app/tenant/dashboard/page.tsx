"use client";

import { useEffect, useState } from "react";
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    async function load() {
      const unitId = localStorage.getItem("unitId");

      if (!unitId) {
        window.location.href = "/tenant";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/tenant/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId }),
        });

        const result = await res.json();

        if (!res.ok) {
          setError(result?.error || "Failed to load dashboard.");
          return;
        }

        setData(result);
        setAmount(String(Number(result.balance || 0).toFixed(2)));
      } catch {
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-red-600">{error}</div>
        <button
          onClick={() => {
            localStorage.removeItem("unitId");
            window.location.href = "/tenant";
          }}
          className="rounded border px-4 py-2 text-sm"
        >
          Back to Login
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-6">No dashboard data found.</div>;

  const numericAmount = Number(amount || 0);
  const paymentBlocked = !data.paymentEnabled;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">{data.tenantName}</h1>
        {(data.propertyName || data.unitNumber) && (
          <div className="text-sm text-gray-600">
            {data.propertyName ? data.propertyName : ""}
            {data.propertyName && data.unitNumber ? " · " : ""}
            {data.unitNumber ? `Unit ${data.unitNumber}` : ""}
          </div>
        )}
      </div>

      {paymentBlocked && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Payments are currently disabled for this property preview.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Balance</div>
          <div className="text-lg font-semibold">{money(data.balance)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Paid</div>
          <div className="text-lg font-semibold">{money(data.totalPaid)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Status</div>
          <div className="text-lg font-semibold">
            {data.isDelinquent ? "DELINQUENT" : "CURRENT"}
          </div>
        </div>
      </div>

     <button
  type="button"
  onClick={() => {
    window.location.href = "/tenant/payment-history";
  }}
  className="rounded border px-4 py-2 text-sm"
>
  View Payment History
</button>

     <button
  type="button"
  onClick={() => {
    window.location.href = "/tenant/maintenance";
  }}
  className="rounded border px-4 py-2 text-sm"
>
  Maintenance
</button>

      {data.balance > 0 && data.paymentEnabled && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Make a Payment</div>

          <input
            type="number"
            step="0.01"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />

          <PayNowButton unitId={data.unitId} amount={numericAmount} />
        </div>
      )}

      <button
  type="button"
  onClick={() => {
    window.location.href = "/tenant/balance";
  }}
  className="rounded border px-4 py-2 text-sm"
>
  View Balance Detail
</button>

      <div>
        <h2 className="mb-2 font-semibold">Recent Activity</h2>

        <div className="space-y-2">
          {data.ledger.length === 0 ? (
            <div className="rounded border p-3 text-sm text-gray-500">
              No activity yet.
            </div>
          ) : (
            data.ledger.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-4"
              >
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="font-medium">{entry.type}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Date</div>
                  <div>{fmtDate(entry.effectiveDate)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Memo</div>
                  <div>{entry.memo || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Amount</div>
                  <div className="font-medium">{money(entry.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}