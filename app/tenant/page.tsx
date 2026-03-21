// app/tenant/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BalanceData = {
  ok: true;
  propertyName: string;
  unitNumber: string;
  balance: number;
  delinquent: boolean;
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function TenantDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/tenant/balance");

        if (res.status === 401) {
          router.replace("/property-code");
          return;
        }

        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to load");
        }

        if (active) {
          setData(json);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Something went wrong");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-black px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tenant Portal
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-sm text-neutral-500">Loading...</div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        {data && (
          <>
            <div className="rounded-2xl border border-neutral-200 p-5">
              <div className="text-sm text-neutral-500">
                {data.propertyName}
              </div>

              <div className="mt-1 text-lg font-medium">
                Unit {data.unitNumber}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-5">
              <div className="text-sm text-neutral-500">
                Current Balance
              </div>

              <div className="mt-2 text-3xl font-semibold">
                {money(data.balance)}
              </div>

              <div
                className={`mt-2 text-sm ${
                  data.delinquent
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {data.delinquent ? "Past due" : "Current"}
              </div>
            </div>

            <button
              onClick={() => alert("Payments flow next")}
              className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              Make Payment
            </button>
          </>
        )}
      </div>
    </main>
  );
}