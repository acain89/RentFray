// app/page.tsx

"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <div className="mb-10 text-xs font-semibold tracking-[0.2em] text-[#0f172a]/70">
          RENTFRAY
        </div>

        <section className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Recurring payments. Account tracking. Simplified. 
          </h1>

          <p className="text-base text-[#475569] sm:text-lg">
            Set up your property, automate payments, and track everything — in minutes.
            
            No spreadsheets. No confusion. Just a system that works.
          </p>

          <p className="text-base font-semibold text-[#1e3a5f] sm:text-lg">
            Always free. Full instant access. No hidden fees, contracts, or trials.
          </p>
        </section>

        <section className="mt-10 rounded-[32px] border border-[#1e293b] bg-[#0f172a] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.45)]">

  <button
    onClick={() => router.push("/setup")}
    className="w-full rounded-2xl bg-gradient-to-r from-[#38bdf8] to-[#6366f1] px-6 py-5 text-base sm:text-lg font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(99,102,241,0.4)] active:scale-[0.99]"
  >
    Start 4-step setup →
  </button>

  <p className="mt-4 text-center text-sm text-[#cbd5f5]">
    No banking required. Done in minutes.
  </p>

</section>

<div className="mt-10 mb-4 text-xs font-semibold tracking-[0.18em] text-[#64748b] uppercase">
  What happens next
</div>

        <section className="mt-10 grid gap-4">

  {[
    "Create your full property setup in under 2 minutes.",
    "Every unit auto-generated — no manual setup.",
    "No manual client data entry. Clients onboard themselves.",
    "Payments, balances, billing, and tracking — fully automated."
  ].map((text) => (
    <div
      key={text}
className="rounded-[24px] border border-[#bfe8cd] bg-[#e8f7ee] px-5 py-5 text-[#0f172a] shadow-sm hover:shadow-md transition"
    >
<div className="text-base sm:text-lg font-semibold leading-snug">
        {text}
      </div>
    </div>
  ))}


</section>

        <section className="mt-10 space-y-4">
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