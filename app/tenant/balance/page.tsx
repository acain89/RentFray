"use client";

import { useEffect, useState } from "react";

type BalanceRow = {
  id: string;
  type: string;
  label: string;
  amount: number;
  effectiveDate: string;
  memo?: string | null;
};

type BalanceData = {
  ok: true;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  unitId: string;
  balance: number;
  totalCharges: number;
  totalPaid: number;
  charges: BalanceRow[];
  payments: BalanceRow[];
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US");
}

export default function TenantBalancePage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

        const res = await fetch("/api/tenant/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId }),
        });

        const result = await res.json();

        if (!res.ok) {
          setError(result?.error || "Failed to load balance detail.");
          return;
        }

        setData(result);
      } catch {
        setError("Failed to load balance detail.");
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
          onClick={() => (window.location.href = "/tenant/dashboard")}
          className="rounded border px-4 py-2 text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-6">No balance data found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Balance Detail</h1>
        <div className="text-sm text-gray-600">
          {data.propertyName} · Unit {data.unitNumber}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Charges</div>
          <div className="text-lg font-semibold">{money(data.totalCharges)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Paid</div>
          <div className="text-lg font-semibold">{money(data.totalPaid)}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Current Balance</div>
          <div className="text-lg font-semibold">{money(data.balance)}</div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Charges</h2>
        <div className="space-y-2">
          {data.charges.length === 0 ? (
            <div className="rounded border p-3 text-sm text-gray-500">
              No charges found.
            </div>
          ) : (
            data.charges.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-4"
              >
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="font-medium">{row.label}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Date</div>
                  <div>{fmtDate(row.effectiveDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Memo</div>
                  <div>{row.memo || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Amount</div>
                  <div className="font-medium">{money(row.amount)}</div>
                </div>
              </div>
            ))
          )}
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

      <div>
        <h2 className="mb-2 font-semibold">Payments / Credits</h2>
        <div className="space-y-2">
          {data.payments.length === 0 ? (
            <div className="rounded border p-3 text-sm text-gray-500">
              No payments found.
            </div>
          ) : (
            data.payments.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-4"
              >
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="font-medium">{row.label}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Date</div>
                  <div>{fmtDate(row.effectiveDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Memo</div>
                  <div>{row.memo || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Amount</div>
                  <div className="font-medium">{money(row.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}