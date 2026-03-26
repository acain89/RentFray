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

type DashboardError = {
  error?: string;
  ok?: false;
};

function money(v: number): string {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US");
}

function normalizeDashboardData(value: unknown): DashboardData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<DashboardData>;

  if (data.ok !== true) {
    return null;
  }

  if (typeof data.tenantName !== "string") {
    return null;
  }

  if (typeof data.propertyStatus !== "string") {
    return null;
  }

  if (typeof data.paymentEnabled !== "boolean") {
    return null;
  }

  if (typeof data.unitId !== "string") {
    return null;
  }

  if (typeof data.balance !== "number") {
    return null;
  }

  if (typeof data.totalPaid !== "number") {
    return null;
  }

  if (typeof data.isDelinquent !== "boolean") {
    return null;
  }

  const ledger: LedgerEntry[] = Array.isArray(data.ledger)
    ? data.ledger
        .filter((entry): entry is LedgerEntry => {
          if (!entry || typeof entry !== "object") {
            return false;
          }

          const candidate = entry as Partial<LedgerEntry>;

          return (
            typeof candidate.id === "string" &&
            typeof candidate.type === "string" &&
            typeof candidate.amount === "number" &&
            typeof candidate.effectiveDate === "string"
          );
        })
        .map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount,
          effectiveDate: entry.effectiveDate,
          memo: entry.memo ?? null,
        }))
    : [];

  return {
    ok: true,
    tenantName: data.tenantName,
    propertyName:
      typeof data.propertyName === "string" ? data.propertyName : undefined,
    propertyStatus: data.propertyStatus,
    paymentEnabled: data.paymentEnabled,
    unitNumber:
      typeof data.unitNumber === "string" ? data.unitNumber : undefined,
    unitId: data.unitId,
    balance: data.balance,
    totalPaid: data.totalPaid,
    isDelinquent: data.isDelinquent,
    ledger,
  };
}

export default function TenantDashboard() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/tenant/dashboard", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        const result: unknown = await res.json().catch(() => null);

        if (!active) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok) {
          const apiError =
            result && typeof result === "object"
              ? (result as DashboardError).error
              : undefined;

          setError(apiError || "Failed to load dashboard.");
          return;
        }

        const normalized = normalizeDashboardData(result);

        if (!normalized) {
          setError("Failed to load dashboard.");
          return;
        }

        setData(normalized);
        setAmount(String(Number(normalized.balance || 0).toFixed(2)));
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
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <div className="text-sm text-red-600">{error || "Error loading."}</div>
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

  const ledger = Array.isArray(data.ledger) ? data.ledger : [];
  const numericAmount = Number(amount || 0);
  const paymentBlocked = !data.paymentEnabled;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-slate-700">
            RENTFRAY
          </div>

          <h1 className="mt-3 text-2xl font-semibold">{data.tenantName}</h1>

          <p className="mt-1 text-sm text-slate-600">
            {data.propertyName || "Property"} · Unit {data.unitNumber || "—"}
          </p>
        </div>

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

        {!paymentBlocked && data.balance > 0 && (
          <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5">
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

        <div>
          <h2 className="mb-2 text-sm font-semibold">Recent Activity</h2>

          <div className="space-y-2">
            {ledger.length === 0 ? (
              <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-500">
                No activity yet.
              </div>
            ) : (
              ledger.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-xl border bg-white p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{entry.type}</span>
                    <span>{money(entry.amount)}</span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {fmtDate(entry.effectiveDate)}
                  </div>

                  {entry.memo ? (
                    <div className="mt-1 text-xs text-slate-500">{entry.memo}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}