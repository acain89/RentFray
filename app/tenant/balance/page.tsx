// app/tenant/balance/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BalanceData = {
  ok: true;
  balanceCents: number;
  chargesCents: number;
  paymentsCents: number;
  lastPaymentDate?: string | null;
  lastPaymentAmountCents?: number | null;
};

function isBalanceData(value: unknown): value is BalanceData {
  if (!value || typeof value !== "object" || !("ok" in value) || value.ok !== true) return false;
  if (!("balanceCents" in value) || typeof value.balanceCents !== "number" || !Number.isSafeInteger(value.balanceCents) ||
      !("chargesCents" in value) || typeof value.chargesCents !== "number" || !Number.isSafeInteger(value.chargesCents) ||
      !("paymentsCents" in value) || typeof value.paymentsCents !== "number" || !Number.isSafeInteger(value.paymentsCents)) return false;
  if ("lastPaymentDate" in value && value.lastPaymentDate !== null && value.lastPaymentDate !== undefined &&
      (typeof value.lastPaymentDate !== "string" || !Number.isFinite(new Date(value.lastPaymentDate).getTime()))) return false;
  return !("lastPaymentAmountCents" in value) || value.lastPaymentAmountCents === null ||
    value.lastPaymentAmountCents === undefined ||
    (typeof value.lastPaymentAmountCents === "number" && Number.isSafeInteger(value.lastPaymentAmountCents));
}

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US");
}

export default function TenantBalancePage() {
  const router = useRouter();

  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/tenant/balance", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const result: unknown = await res.json().catch(() => null);

        if (!active) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok || !isBalanceData(result)) {
          setError(result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error : "Failed to load balance detail. Invalid balance data.");
          return;
        }

        setData(result);
      } catch {
        if (!active) return;
        setError("Failed to load balance detail.");
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
            onClick={() => router.push("/tenant/dashboard")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="text-sm text-neutral-600">No balance data found.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Balance Detail
          </h1>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Total Charges</div>
            <div className="text-lg font-semibold">
              {money(data.chargesCents / 100)}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Total Paid</div>
            <div className="text-lg font-semibold">
              {money(data.paymentsCents / 100)}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Current Balance</div>
            <div className="text-lg font-semibold">
              {money(data.balanceCents / 100)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Last Payment Date</div>
            <div className="text-sm font-medium">
              {fmtDate(data.lastPaymentDate)}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs text-neutral-500">Last Payment Amount</div>
            <div className="text-sm font-medium">
              {data.lastPaymentAmountCents == null ? "—" : money(data.lastPaymentAmountCents / 100)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/tenant/payment-history")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            View Payment History
          </button>

          <button
            type="button"
            onClick={() => router.push("/tenant/dashboard")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}