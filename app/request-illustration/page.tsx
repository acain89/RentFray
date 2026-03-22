"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestIllustrationPage() {
  const router = useRouter();

  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    propertyName: "",
    propertyType: "",
    address: "",
    name: "",
    contact: "",
    units: "",
    notes: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto max-w-5xl px-8 py-10 lg:px-12 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
          
          {/* LEFT */}
          <section>
            <div className="mb-6 text-xs font-semibold tracking-[0.24em] text-[#c28a12]">
              RENTFRAY
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">
              Request your
              <br />
              account setup.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Send over the basics and we’ll handle everything for you.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-sky-50 p-5 shadow-sm">
                <div className="text-lg font-semibold">Fast review</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Share the basics. We’ll know what we need immediately.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-sky-50 p-5 shadow-sm">
                <div className="text-lg font-semibold">Clean setup</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Built correctly from day one.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-sky-50 p-5 shadow-sm">
                <div className="text-lg font-semibold">No cost</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Property owners will never be charged. It&apos;s free.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-sky-50 p-5 shadow-sm">
                <div className="text-lg font-semibold">Built to run</div>
                <p className="mt-3 text-sm text-[#475569]">
                  Payments, balances, and operations in one system.
                </p>
              </div>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="flex items-center justify-center">
            <div className="w-full max-w-sm rounded-[26px] border border-[#334155] bg-[#233143] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              
              <div className="rounded-[20px] border border-white/10 bg-sky-50 p-5 min-h-[420px] flex flex-col">
                
                {!submitted ? (
                  <>
                    <div className="text-xs uppercase tracking-[0.22em] text-[#b6c2cf]">
                      Property Intake
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold">
                      Tell us about the property
                    </h2>

                    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                      
                      <input
                        placeholder="Property Name"
                        value={form.propertyName}
                        onChange={(e) => update("propertyName", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                        required
                      />

                      <select
                        value={form.propertyType}
                        onChange={(e) => update("propertyType", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                        required
                      >
                        <option value="" className="bg-[#233143] text-white">
                          Property Type
                        </option>
                        <option className="bg-[#233143] text-white">Apartment</option>
                        <option className="bg-[#233143] text-white">Condo</option>
                        <option className="bg-[#233143] text-white">Mobile Home</option>
                        <option className="bg-[#233143] text-white">RV Park</option>
                      </select>

                      <input
                        placeholder="Address"
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                        required
                      />

                      <input
                        placeholder="Your Name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                        required
                      />

                      <input
                        placeholder="Contact (Email or Phone)"
                        value={form.contact}
                        onChange={(e) => update("contact", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                        required
                      />

                      <input
                        placeholder="Unit Count"
                        value={form.units}
                        onChange={(e) => update("units", e.target.value)}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                      />

                      <textarea
                        placeholder="Notes (optional)"
                        value={form.notes}
                        onChange={(e) => update("notes", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 outline-none"
                      />

                      <button className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0f172a]">
                        Submit
                      </button>
                    </form>

                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => router.push("/")}
                        className="text-sm text-white/70 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <div className="text-xl font-semibold">Thanks!</div>

                    <p className="mt-2 text-sm text-[#cbd5e1]">
                      We&apos;ll be in touch shortly.
                    </p>

                    <button
                      onClick={() => router.push("/")}
                      className="mt-5 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-[#0f172a]"
                    >
                      Exit
                    </button>
                  </div>
                )}

              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}