// app/request-illustration/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestSetupResponse = {
  ok?: boolean;
  error?: string;
  request?: {
    id: string;
    propertyName: string;
    status: string;
  };
};

export default function RequestIllustrationPage() {
  const router = useRouter();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  setErrorMessage("");

  try {
    const res = await fetch("/api/request-setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyName: form.propertyName,
        propertyType: form.propertyType,
        address: form.address,
        contactName: form.name,
        contactInfo: form.contact,
        unitCount: Number(form.units || 0),
        notes: form.notes,
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    let data: RequestSetupResponse | null = null;
    let rawText = "";

    if (contentType.includes("application/json")) {
      data = (await res.json()) as RequestSetupResponse;
    } else {
      rawText = await res.text();
    }

    if (!res.ok) {
      if (data?.error) {
        throw new Error(data.error);
      }

      if (rawText.includes("<!DOCTYPE")) {
        throw new Error(
          "Request was redirected or returned an HTML page instead of API JSON."
        );
      }

      throw new Error("Unable to submit request.");
    }

    if (!data?.ok) {
      throw new Error(data?.error || "Unable to submit request.");
    }

    setSubmitted(true);
  } catch (error) {
    console.error(error);
    setErrorMessage(
      error instanceof Error ? error.message : "Something went wrong."
    );
  } finally {
    setSubmitting(false);
  }
}

  const benefitCards = [
    {
      title: "Fast review",
      body: "Share the basics. We’ll know what we need immediately.",
    },
    {
      title: "Clean setup",
      body: "Built correctly from day one.",
    },
    {
      title: "No cost",
      body: "Property owners will never be charged. It’s free.",
    },
    {
      title: "Built to run",
      body: "Payments, balances, and operations in one system.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#dfe7ee] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <section>
            <div className="mb-6 text-xs font-semibold tracking-[0.24em] text-[#c28a12]">
              RENTFRAY
            </div>

            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight lg:text-6xl">
              Request your
              <br />
              account setup.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 lg:text-lg lg:leading-8">
              Send over the basics and we’ll handle everything for you.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefitCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-3xl border border-slate-200 bg-white/70 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                >
                  <div className="text-base font-semibold text-slate-900">
                    {card.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-[30px] border border-slate-300/70 bg-[#223249] p-4 shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
              <div className="rounded-[24px] border border-white/10 bg-[#f7fafc] p-6 shadow-inner">
                {!submitted ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Property Intake
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                          Tell us about the property
                        </h2>
                      </div>

                      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                        2 min
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          Property Name
                        </label>
                        <input
                          placeholder="Stonebrook Apartments"
                          value={form.propertyName}
                          onChange={(e) =>
                            update("propertyName", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          Property Type
                        </label>
                        <select
                          value={form.propertyType}
                          onChange={(e) =>
                            update("propertyType", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          required
                        >
                          <option value="">Select property type</option>
                          <option>Apartment</option>
                          <option>Condo</option>
                          <option>Mobile Home</option>
                          <option>RV Park</option>
                          <option>Storage</option>
                          <option>Other</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          Address
                        </label>
                        <input
                          placeholder="123 Main St"
                          value={form.address}
                          onChange={(e) => update("address", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                          required
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Your Name
                          </label>
                          <input
                            placeholder="Andrew Cain"
                            value={form.name}
                            onChange={(e) => update("name", e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Unit Count
                          </label>
                          <input
                            placeholder="48"
                            value={form.units}
                            onChange={(e) => update("units", e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          Contact
                        </label>
                        <input
                          placeholder="Email or phone"
                          value={form.contact}
                          onChange={(e) => update("contact", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          Notes
                        </label>
                        <textarea
                          placeholder="Anything we should know before setup?"
                          value={form.notes}
                          onChange={(e) => update("notes", e.target.value)}
                          rows={4}
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
                        />
                      </div>

                      {errorMessage ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {errorMessage}
                        </div>
                      ) : null}

                      <button
                        className="w-full rounded-2xl bg-[#0f172a] py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px] hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={submitting}
                      >
                        {submitting ? "Submitting..." : "Submit request"}
                      </button>
                    </form>

                    <div className="mt-5 flex items-center justify-between text-sm">
                      <button
                        onClick={() => router.push("/")}
                        className="text-slate-500 transition hover:text-slate-900"
                        type="button"
                      >
                        Back
                      </button>

                      <div className="text-slate-400">
                        We’ll follow up quickly
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[460px] flex-col items-center justify-center text-center">
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Submitted
                    </div>

                    <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
                      Thanks
                    </div>

                    <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                      We received your request and will be in touch shortly to
                      get your property set up.
                    </p>

                    <button
                      onClick={() => router.push("/")}
                      className="mt-6 rounded-2xl bg-[#0f172a] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px] hover:bg-[#162033]"
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