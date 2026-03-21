// app/page.tsx

"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto min-h-screen max-w-7xl px-8 py-10 lg:px-12 lg:py-14">
        <div className="grid min-h-[82vh] items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          {/* LEFT */}
          <section className="space-y-7">
            <div className="text-xs font-semibold tracking-[0.24em] text-[#c28a12]">
              RENTFRAY
            </div>

            <div className="max-w-3xl">
              <h1 className="text-5xl font-semibold leading-[0.94] tracking-tight lg:text-7xl">
                Modern property
                <br />
                operations without
                <br />
                the usual mess.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#475569] lg:text-xl">
                One clean system for balances, online payments, maintenance,
                and day-to-day property control.
              </p>

              <p className="mt-4 text-xl font-semibold leading-8 text-[#1e3a5f] lg:text-2xl">
                Oh yeah... and it&apos;s free for the property owner.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <button
                onClick={() => router.push("/property-code")}
                className="rounded-2xl bg-[#0f172a] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
              >
                Existing Members
              </button>

              <button
                onClick={() => router.push("/request-illustration")}
                className="rounded-2xl border border-[#94a3b8] bg-white/80 px-7 py-3.5 text-sm font-semibold text-[#0f172a] shadow-sm transition hover:bg-white"
              >
                Request Your Property Setup
              </button>

              <button
                onClick={() => router.push("/admin")}
                className="rounded-2xl border border-[#7c8da1] bg-[#edf2f7] px-4 py-3.5 text-sm font-semibold text-[#0f172a] shadow-sm transition hover:bg-white"
              >
                Admin
              </button>
            </div>

            <div className="grid gap-4 pt-2 md:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                <div className="text-lg font-semibold text-[#0f172a]">
                  Managers
                </div>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  Track balances, vacancies, fees, maintenance, and daily
                  operations in one place.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                <div className="text-lg font-semibold text-[#0f172a]">
                  Tenants
                </div>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  View balance. Pay online. Submit maintenance requests.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-[#eef3f7] p-5 shadow-sm">
                <div className="text-lg font-semibold text-[#0f172a]">
                  Maintenance
                </div>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  Get live, instant work orders on your mobile device.
                </p>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-[30px] border border-[#334155] bg-[#233143] p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] lg:p-8">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 lg:p-7">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#b6c2cf]">
                  Live Overview
                </div>

                <span className="rounded-full bg-[#c28a12]/15 px-3 py-1 text-xs font-semibold text-[#f2cf77]">
                  Active
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight">
                Built for real property workflows
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#c8d2dd]">
                Simple for tenants. Clear for maintenance. Powerful for property
                owners and operators.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9fb0c2]">
                    Tenant Access
                  </div>
                  <div className="mt-2 text-4xl font-semibold">Fast</div>
                  <p className="mt-2 text-sm leading-6 text-[#d3dbe4]">
                    Simple property code flow with role-based entry.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9fb0c2]">
                    Maintenance
                  </div>
                  <div className="mt-2 text-4xl font-semibold">Clear</div>
                  <p className="mt-2 text-sm leading-6 text-[#d3dbe4]">
                    Open requests, live status updates, and clean handoff.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9fb0c2]">
                    Collections
                  </div>
                  <div className="mt-2 text-4xl font-semibold">Visible</div>
                  <p className="mt-2 text-sm leading-6 text-[#d3dbe4]">
                    Dashboard-first visibility into balances and delinquency.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9fb0c2]">
                    Operations
                  </div>
                  <div className="mt-2 text-4xl font-semibold">Unified</div>
                  <p className="mt-2 text-sm leading-6 text-[#d3dbe4]">
                    One system for managers, tenants, and maintenance.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}