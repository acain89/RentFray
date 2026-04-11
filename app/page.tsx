// app/page.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const slides: Slide[] = [
  {
    id: "panel1",
    eyebrow: "No contracts. No trial periods. Rentfray is completely free for businesses.",
    title: "Set up your entire business in under 5 minutes.",
    subtitle:
      "Complete the 4-step setup, connect your account, and print the Tenant Instruction Sheet. That's it.",
  },
  {
    id: "panel2",
    eyebrow: "Activate the Property",
    title: "Your system starts running the moment tenants pay.",
    subtitle:
      "Write the Tier number and Property Code, hand it to the tenant, and your dashboard builds itself. Tenants enter code + unit + PIN — no manager input needed.",
  },
  {
    id: "panel3",
    eyebrow: "Set Your Controls",
    title: "Run everything from your phone.",
    subtitle:
      "Add managers or leasing staff anytime, set a maintenance PIN, and control operations without office work, paperwork, or back-and-forth.",
  },
  {
    id: "panel4",
    eyebrow: "Run the Business",
    title: "Know exactly what’s happening at all times.",
    subtitle:
      "No spreadsheets. No chasing. No guesswork.",
  },
];

function SlideDots({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      {slides.map((slide, index) => (
        <button
          key={slide.id}
          type="button"
          aria-label={`Go to slide ${index + 1}`}
          onClick={() => onSelect(index)}
          className={`h-2.5 rounded-full transition-all ${
            activeIndex === index ? "w-8 bg-[#0f172a]" : "w-2.5 bg-[#cbd5e1]"
          }`}
        />
      ))}
    </div>
  );
}

function Bubble({
  className,
  children,
}: {
  className: string;
  children: string;
}) {
  return (
    <div
      className={`absolute max-w-[240px] rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 text-left text-sm font-medium leading-6 text-[#0f172a] shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

function MockGetStartedPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[920px] rounded-[28px] border border-[#1e293b] bg-[#0f172a] p-3 shadow-[0_30px_90px_rgba(15,23,42,0.32)]">
      <div className="rounded-[24px] border border-[#1f3b62] bg-gradient-to-br from-[#0f172a] via-[#13233a] to-[#1d4ed8] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
              RentFray Setup
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              No phone calls. No emails. You can create your account right here, right now.
            </div>
            <div className="mt-2 max-w-xl text-sm text-sky-100/90">
              Create your property, tiers, and billing rules. Connect your bank.
              Print the instruction sheet. Done.
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20">
            Under 5 minutes
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Complete the 4-step setup",
              text: "Create your property, tiers, and billing rules.",
            },
            {
              step: "2",
              title: "Tap “ACCT” and connect your bank",
              text: "Secure payouts through Stripe.",
            },
            {
              step: "3",
              title: "Print your Tenant Instruction Sheet",
              text: "This is all your tenants need to get started. Takes less than 30 seconds to hand off.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-400 text-sm font-bold text-[#0f172a]">
                {item.step}
              </div>
              <div className="mt-3 text-base font-semibold">{item.title}</div>
              <div className="mt-2 text-sm text-sky-100/85">{item.text}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white p-4 text-[#0f172a]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              4-step setup
            </div>
            <div className="mt-3 space-y-2">
              {[
                "Create login",
                "Add property",
                "Set tiers",
                "Save billing rules",
              ].map((row) => (
                <div
                  key={row}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium"
                >
                  {row}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white p-4 text-[#0f172a]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              ACCT
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold">Bank account</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  Routing Number
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  Account Number
                </div>
                <div className="rounded-xl bg-[#0f172a] px-3 py-2 text-center text-sm font-semibold text-white">
                  Connect Account
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white p-4 text-[#0f172a]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Tenant Instruction Sheet
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold">Tenant Instructions</div>
              <div className="mt-2 text-xs text-slate-500">Property Code: 4821</div>
              <div className="mt-1 text-xs text-slate-500">Tier Number: 2</div>
              <div className="mt-3 space-y-2">
                {[
                  "Enter property code",
                  "Select your unit",
                  "Create PIN",
                  "Pay from your phone",
                ].map((row) => (
                  <div key={row} className="text-sm text-slate-700">
                    • {row}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
    </div>
  );
}

function MockActivatePanel() {
  return (
    <div className="relative mx-auto w-full max-w-[920px] rounded-[28px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[24px] border border-[#d8e4ee] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              Activate the Property
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">
              Your dashboard builds itself as tenants pay.
            </div>
            <div className="mt-2 max-w-2xl text-sm text-[#475569]">
              Write the Tier number and Property Code on the sheet, hand it to the
              tenant, and that’s it. Their first payment onboards them automatically.
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white">
            No manager input needed
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Sheet with Code + Tier
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Tenant Instruction Sheet
              </div>
              <div className="mt-2 text-sm text-[#475569]">Property Code: 4821</div>
              <div className="text-sm text-[#475569]">Tier Number: 2</div>
              <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                Hand to tenant
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              First Payment / Activation
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-semibold tracking-[0.22em] text-[#64748b]">
                RENTFRAY
              </div>
              <div className="mt-3 text-lg font-semibold text-[#0f172a]">
                Activate Unit
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "Property Code",
                  "Unit Number",
                  "Create 4-digit PIN",
                  "Pay Now",
                ].map((row) => (
                  <div
                    key={row}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Live Dashboard Begins Filling
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Oak Grove Apartments
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["Units", "48"],
                  ["Payments", "3"],
                  ["Collected", "$2,285"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "Unit 102 — Payment posted",
                  "Unit 205 — Payment posted",
                  "Unit 301 — Pending",
                ].map((row) => (
                  <div
                    key={row}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Bubble className="right-[345px] top-[120px]">
        The system starts becoming useful immediately instead of “after setup someday.”
      </Bubble>
    </div>
  );
}

function MockControlsPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[920px] rounded-[28px] border border-[#dbe4ee] bg-[#f3f7fb] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[24px] border border-[#d8e4ee] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              Set Your Controls
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">
              Run the day-to-day operation from your phone.
            </div>
            <div className="mt-2 max-w-2xl text-sm text-[#475569]">
              All incoming information can be exported with a click. Set a maintenance PIN so
              requests go straight from the tenant to your team. Don't play phone-tag.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["+", "Rent", "GP&LF", "Mngr", "Accnt", "Info", "Maint"].map(
              (label) => (
                <div
                  key={label}
                  className="rounded-2xl bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white"
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Top Controls
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Rent", "GP&LF", "Mngr", "Maint"].map((label) => (
                <div
                  key={label}
                  className="rounded-xl bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm text-slate-600">
              Fast access to the handful of things owners actually need.
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Add Manager / Staff
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Management Users
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "Email Address",
                  "Password",
                  "Role: STAFF",
                  "Create User",
                ].map((row) => (
                  <div
                    key={row}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbfd] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Maintenance PIN / Requests
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Maintenance
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                Set PIN: ****
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "Unit 102 — Leak under sink",
                  "Unit 201 — AC not cooling",
                ].map((row) => (
                  <div
                    key={row}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Bubble className="left-[510px] top-[120px]">
        Key controls stay one tap away instead of buried in menus.
      </Bubble>
    </div>
  );
}

function MockRunBusinessPanel() {
  const units = [
    ["101", "Smith", "$0.00", "Current", "bg-emerald-500"],
    ["102", "Johnson", "$245.00", "Grace", "bg-amber-400"],
    ["103", "Brown", "$780.00", "Past Due", "bg-red-500"],
    ["104", "-", "-", "Vacant", "bg-slate-400"],
    ["201", "Davis", "$0.00", "Current", "bg-emerald-500"],
    ["202", "Miller", "$125.00", "Balance Due", "bg-emerald-500"],
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-[920px] rounded-[28px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[24px] border border-[#d8e4ee] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              Run the Business
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">
              See who paid, who has not paid, and which units are vacant.
            </div>
            <div className="mt-2 max-w-2xl text-sm text-[#475569]">
              Everything after setup is basic, routine, and fast. Payments,
              balances, and late fees take care of themselves.
            </div>
          </div>

          <div className="rounded-2xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white">
            No spreadsheets needed
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["Total Units", "48"],
            ["Occupied", "42"],
            ["Vacant", "6"],
            ["Collected", "$18,640"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#dbe4ee] bg-[#f8fbfd] px-4 py-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#0f172a]">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[24px] border border-[#dbe4ee] bg-white p-3">
            <div className="mb-3 px-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Unit Status
            </div>

            <div className="space-y-2">
              {units.map(([unit, last, balance, status, dot]) => (
                <div
                  key={unit}
                  className="rounded-[20px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-3.5 w-3.5 rounded-full ${dot}`} />
                      <span className="font-bold text-[#00b8e6]">{unit}</span>
                      <span className="min-w-[70px] truncate text-sm text-[#334155]">
                        {last}
                      </span>
                      <span className="min-w-[90px] text-sm font-semibold text-[#0f172a]">
                        {balance}
                      </span>
                      <span className="text-xs text-[#64748b]">{status}</span>
                    </div>

                    <div className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]">
                      MP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[24px] border border-[#dbe4ee] bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Revenue Snapshot
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ["Expected", "$24,300"],
                  ["Collected", "$18,640"],
                  ["Outstanding", "$5,660"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#dbe4ee] bg-white p-4">
              <div className="text-sm font-semibold text-[#0f172a]">
                Mobile-Friendly
              </div>
              <div className="mt-3 rounded-[24px] border border-slate-200 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 p-4">
                <div className="text-[10px] font-semibold tracking-[0.22em] text-[#64748b]">
                  RENTFRAY
                </div>
                <div className="mt-3 text-lg font-semibold text-[#0f172a]">
                  Current Balance
                </div>
                <div className="mt-1 text-3xl font-semibold text-[#0f172a]">
                  $1,229.95
                </div>
                <div className="mt-3 rounded-2xl bg-[#0f172a] px-4 py-3 text-center text-sm font-semibold text-white">
                  Pay Now
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Bubble className="left-[18px] top-[320px]">
        Color-coded status gives instant clarity without digging through reports.
      </Bubble>

      <Bubble className="right-[32px] top-[340px]">
        Owners can run the business from a phone instead of from a desk.
      </Bubble>
    </div>
  );
}

function SlidePreview({ slideId }: { slideId: string }) {
  switch (slideId) {
    case "panel1":
      return <MockGetStartedPanel />;
    case "panel2":
      return <MockActivatePanel />;
    case "panel3":
      return <MockControlsPanel />;
    case "panel4":
      return <MockRunBusinessPanel />;
    default:
      return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [openDemo, setOpenDemo] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const currentSlide = useMemo(
    () => slides[activeSlide] ?? slides[0],
    [activeSlide]
  );

  function nextSlide(): void {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  }

  function prevSlide(): void {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }

  function openAt(index: number): void {
    setActiveSlide(index);
    setOpenDemo(true);
  }

  return (
    <>
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
              Set up your property, automate payments, and track everything — in
              minutes. No spreadsheets. No confusion. Just a system that works.
            </p>

            <p className="text-base font-semibold text-[#1e3a5f] sm:text-lg">
              Always free. Full instant access. No hidden fees, contracts, or
              trials.
            </p>
          </section>

          <section className="mt-10 rounded-[32px] border border-[#1e293b] bg-[#0f172a] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
            <button
              onClick={() => router.push("/setup")}
              className="w-full rounded-2xl bg-gradient-to-r from-[#38bdf8] to-[#6366f1] px-6 py-5 text-base font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(99,102,241,0.4)] active:scale-[0.99] sm:text-lg"
            >
              Start 4-step setup →
            </button>

            <p className="mt-4 text-center text-sm text-[#cbd5f5]">
              Getting paid shouldn't be complicated.
            </p>
          </section>

          <section className="mt-10 rounded-[32px] border border-[#cbd5e1] bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                See how it works
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[#475569] sm:text-base">
                This is exactly how owners start — step by step.
              </p>
            </div>

            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Click to view each page.
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {slides.map((slide, index) => {
                const bgClass =
                  slide.id === "panel1"
                    ? "bg-[#eff6ff]"
                    : slide.id === "panel2"
                    ? "bg-[#f8fafc]"
                    : slide.id === "panel3"
                    ? "bg-[#f5f3ff]"
                    : "bg-[#f0fdf4]";

                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => openAt(index)}
                    className={`rounded-[24px] border border-[#dbe4ee] ${bgClass} px-4 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-md`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                      {slide.eyebrow}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#0f172a]">
                      {slide.title}
                    </div>
                    <div className="mt-2 text-sm text-[#475569]">
                      {slide.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mb-4 mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            What happens next
          </div>

          <section className="mt-10 grid gap-4">
            {[
              "Create your full property setup in under 5 minutes.",
              "Everything in one place — no spreadsheets needed.",
              "No manual data entry — tenants onboard themselves.",
              "Payments, balances, and billing — fully automated.",
            ].map((text) => (
              <div
                key={text}
                className="rounded-[24px] border border-[#bfe8cd] bg-[#e8f7ee] px-5 py-5 text-[#0f172a] shadow-sm transition hover:shadow-md"
              >
                <div className="text-base font-semibold leading-snug sm:text-lg">
                  {text}
                </div>
              </div>
            ))}
          </section>

          <section className="mt-10 rounded-[32px] border border-[#0f172a] bg-[#0f172a] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
            <div className="space-y-3 text-center">
              <div className="text-lg font-semibold">
                Run your entire property from your phone.
              </div>
              <div className="text-sm text-[#cbd5f5]">
                Completely free for owners.
              </div>
              <div className="text-sm text-[#cbd5f5]">
                If you are currently paying debit or processing fees, RentFray
                saves that money instead of adding another bill.
              </div>
              <div className="text-base font-semibold text-white">
                If your tenants can pay, your system runs.
              </div>
            </div>
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
                onClick={() => router.push("/login/admin")}
                className="w-full rounded-2xl border border-[#cbd5e1] bg-[#edf2f7] px-5 py-4 text-sm font-semibold text-[#0f172a]"
              >
                Admin access
              </button>
            </div>
          </section>
        </div>
        {/* Footer */}
<footer className="mt-16 border-t border-[#cbd5e1] px-6 py-8 text-center">
  <div className="space-y-2 text-sm text-[#475569]">
    <div>
      Questions?{" "}
      <a
        href="mailto:helpdesk@rentfray.com"
        className="font-semibold text-[#0f172a] hover:underline"
      >
        helpdesk@rentfray.com
      </a>
    </div>

    <div>
      <button
        onClick={() => router.push("/faq")}
        className="font-semibold text-[#0f172a] hover:underline"
      >
        View FAQ
      </button>
    </div>
  </div>
</footer>
      </main>

      {openDemo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-3 py-4 backdrop-blur-sm sm:px-6">
          <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-visible rounded-[32px] border border-[#cbd5e1] bg-white shadow-[0_35px_120px_rgba(2,6,23,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  {currentSlide.eyebrow}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">
                  {currentSlide.title}
                </div>
                <div className="mt-2 max-w-2xl text-sm text-[#475569]">
                  {currentSlide.subtitle}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpenDemo(false)}
                className="rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible bg-[#f8fbfd] px-3 py-6 sm:px-6 sm:py-8">
              <SlidePreview slideId={currentSlide.id} />
            </div>

            <div className="border-t border-[#e2e8f0] bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="rounded-2xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={nextSlide}
                    className="rounded-2xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e293b]"
                  >
                    Next
                  </button>
                </div>

                <div className="text-sm text-[#64748b]">
                  Slide {activeSlide + 1} of {slides.length}
                </div>
              </div>

              <SlideDots activeIndex={activeSlide} onSelect={setActiveSlide} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}