// app/property-code/role/RoleSelectClient.tsx

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function buttonPrimary() {
  return "w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800";
}

function buttonSecondary() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900";
}

export default function RoleSelectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get("code") || "";

  useEffect(() => {
    if (!code) {
      router.replace("/property-code");
    }
  }, [code, router]);

  if (!code) return null;

  function goTo(role: "manager" | "tenant" | "maintenance") {
    router.push(`/${role}/login?code=${encodeURIComponent(code)}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <div className="mb-8 text-xs font-semibold tracking-[0.2em] text-slate-700">
          RENTFRAY
        </div>

        {/* CARD */}
        <section className="rounded-[28px] border border-sky-200 bg-white/95 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Select how you want to continue
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Property code:{" "}
              <span className="font-mono font-semibold text-slate-900">
                {code}
              </span>
            </p>
          </div>

          <div className="space-y-3">

            {/* PRIMARY (most common) */}
            <button
              type="button"
              onClick={() => goTo("tenant")}
              className={buttonPrimary()}
            >
              Tenant
            </button>

            {/* SECONDARY */}
            <button
              type="button"
              onClick={() => goTo("manager")}
              className={buttonSecondary()}
            >
              Manager
            </button>

            <button
              type="button"
              onClick={() => goTo("maintenance")}
              className={buttonSecondary()}
            >
              Maintenance
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}