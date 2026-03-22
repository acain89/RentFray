// app/page.tsx

"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        
        {/* HEADER */}
        <div className="mb-10 text-xs font-semibold tracking-[0.2em] text-[#0f172a]/70">
          RENTFRAY
        </div>

        {/* HERO */}
        <section className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Recurring payments + account handling. Simplified.
          </h1>

          <p className="text-base text-[#475569] sm:text-lg">
            Track, manage, and collect — all in one place.
          </p>

          {/* MICRO TRUST LINE */}
          <p className="text-base font-semibold text-[#1e3a5f] sm:text-lg">
            Always free. No trial period. No contracts.
          </p>
        </section>

        {/* PRIMARY ACTION PANEL */}
        <section className="mt-10 rounded-[28px] border border-[#334155] bg-[#233143] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
          <button
             onClick={() => router.push("/admin/properties/new")}
            className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-[#0f172a] transition hover:opacity-90"
          >
            Complete your account right here
          </button>

          <p className="mt-4 text-center text-sm text-[#c8d2dd]">
            100% online. Done in minutes. Go live instantly.
          </p>
        </section>

        {/* TRUST BLOCKS */}
        <section className="mt-8 grid grid-cols-2 gap-4">
          {["Fast", "Clear", "Simple", "Unified"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[#cbd5e1] bg-white/80 px-4 py-5 text-center text-lg font-semibold"
            >
              {item}
            </div>
          ))}
        </section>

        {/* SECONDARY ACTIONS */}
        <section className="mt-10 space-y-4">

          {/* Existing Members */}
          <div>
            <button
              onClick={() => router.push("/property-code")}
              className="w-full rounded-2xl bg-[#0f172a] px-5 py-4 text-sm font-semibold text-white"
            >
              Enter your property
            </button>
            <p className="mt-2 text-center text-xs text-[#475569]">
              Already have a property code?
            </p>
          </div>

          {/* Request Setup */}
          <div>
            <button
              onClick={() => router.push("/request-illustration")}
              className="w-full rounded-2xl border border-[#94a3b8] bg-white px-5 py-4 text-sm font-semibold text-[#0f172a]"
            >
              Request account setup
            </button>
            <p className="mt-2 text-center text-xs text-[#475569]">
              Want us to do it for you?
            </p>
          </div>

          {/* Admin */}
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="w-full rounded-2xl border border-[#cbd5e1] bg-[#edf2f7] px-5 py-4 text-sm font-semibold text-[#0f172a]"
            >
              Admin access
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}