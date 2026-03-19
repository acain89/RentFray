"use client";

import { useEffect, useState } from "react";

type PaymentRow = {
  id: string;
  type: string;
  label: string;
  amount: number;
  effectiveDate: string;
  memo?: string | null;
  source?: string | null;
};

type PaymentHistoryData = {
  ok: true;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  payments: PaymentRow[];
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US");
}

export default function TenantPaymentHistoryPage() {
  const [data, setData] = useState<PaymentHistoryData | null>(null);
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

        const res = await fetch("/api/tenant/payment-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId }),
        });

        const result = await res.json();

        if (!res.ok) {
          setError(result?.error || "Failed to load payment history.");
          return;
        }

        setData(result);
      } catch {
        setError("Failed to load payment history.");
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
          type="button"
          onClick={() => {
            window.location.href = "/tenant/dashboard";
          }}
          className="rounded border px-4 py-2 text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  if (!data) return <div className="p-6">No payment history found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Payment History</h1>
        <div className="text-sm text-gray-600">
          {data.propertyName} · Unit {data.unitNumber}
        </div>
      </div>

      <div className="space-y-2">
        {data.payments.length === 0 ? (
          <div className="rounded border p-3 text-sm text-gray-500">
            No payments found.
          </div>
        ) : (
          data.payments.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-5"
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
                <div className="text-xs text-gray-500">Source</div>
                <div>{row.source || "—"}</div>
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
  );
}