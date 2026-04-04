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
    id: "sv",
    eyebrow: "Simple View",
    title: "See payments roll in without the clutter.",
    subtitle:
      "A clean summary for owners who want fast visibility into what RentFray handled this cycle.",
  },
  {
    id: "fv",
    eyebrow: "Full View",
    title: "Manage units, balances, and actions from one screen.",
    subtitle:
      "The richer management view shows status, balances, and quick actions for day-to-day operations.",
  },
  {
    id: "tenant",
    eyebrow: "Tenant Portal",
    title: "Tenants see exactly what they owe and can pay in seconds.",
    subtitle:
      "Balance, charges, late fees, and payment flow are all in one clean mobile-first screen.",
  },
  {
    id: "maintenance",
    eyebrow: "Maintenance Portal",
    title: "Requests stay organized without back-and-forth confusion.",
    subtitle:
      "Maintenance can log in, review requests, and keep updates moving from one simple portal.",
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
      className={`absolute max-w-[220px] rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 text-left text-sm font-medium leading-6 text-[#0f172a] shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

function MockSimpleView() {
  return (
    <div className="relative mx-auto w-full max-w-[880px] rounded-[28px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[24px] border border-[#d8e4ee] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              RentFray manager
            </div>
            <div className="mt-1 text-xl font-semibold text-[#0f172a]">
              Oak Grove Apartments
            </div>
            <div className="mt-1 text-sm text-[#64748b]">Property Code: 4821</div>
          </div>

          <div className="rounded-2xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white">
            Simple View
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Total Units", "48"],
            ["Payments Logged", "31"],
            ["Total Collected", "$18,640"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#dbe4ee] bg-[#f8fbfd] px-4 py-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#0f172a]">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {[
            ["Tier 1", "$7,200 collected", "12 portal payments this cycle"],
            ["Tier 2", "$6,840 collected", "11 portal payments this cycle"],
            ["Tier 3", "$4,600 collected", "8 portal payments this cycle"],
          ].map(([tier, total, meta]) => (
            <div
              key={tier}
              className="rounded-2xl border border-[#dbe4ee] bg-white px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-[#0f172a]">{tier}</div>
                  <div className="mt-1 text-sm text-[#64748b]">{meta}</div>
                </div>
                <div className="rounded-2xl bg-[#e8f7ee] px-3 py-2 text-sm font-semibold text-[#166534]">
                  {total}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Bubble className="left-1/2 top-[-12px] -translate-x-1/2">
        Clean monthly totals show exactly what RentFray processed.
      </Bubble>

      <Bubble className="right-[-8px] top-[255px]">
        Tier cards make incoming payments easy to scan in seconds.
      </Bubble>
    </div>
  );
}

function MockFullView() {
  const units = [
    ["101", "Smith", "$0.00", "Current", "bg-emerald-500"],
    ["102", "Johnson", "$245.00", "Grace", "bg-amber-400"],
    ["103", "Brown", "$780.00", "Past Due", "bg-red-500"],
    ["104", "-", "-", "Vacant", "bg-slate-400"],
    ["201", "Davis", "$0.00", "Current", "bg-emerald-500"],
    ["202", "Miller", "$125.00", "Balance Due", "bg-emerald-500"],
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-[880px] rounded-[28px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[24px] border border-[#d8e4ee] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              RentFray manager
            </div>
            <div className="mt-1 text-xl font-semibold text-[#0f172a]">
              Oak Grove Apartments
            </div>
            <div className="mt-1 text-sm text-[#64748b]">Property Code: 4821</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["+", "Rent", "GP&LF", "Mngr", "Accnt", "Info", "Maint"].map((label) => (
              <div
                key={label}
                className="rounded-2xl bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white"
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            ["Total Units", "48"],
            ["Occupied", "42"],
            ["Vacant", "6"],
            ["Tiers", "3"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#dbe4ee] bg-[#f8fbfd] px-4 py-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#0f172a]">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[24px] border border-[#dbe4ee] bg-white p-3">
          <div className="mb-3 px-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#64748b]">
            Tier 1
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
      </div>

      <Bubble className="left-[500px] top-[74px]">
        Top action buttons keep key manager tasks one tap away.
      </Bubble>

      <Bubble className="left-[-34px] top-[365px]">
        Color-coded dots make paid, grace, delinquent, and vacant units easy to spot.
      </Bubble>

      <Bubble className="left-[255px] top-[445px]">
        Click into a unit to post a manual payment, review details, or vacate it fast.
      </Bubble>
    </div>
  );
}

function MockTenantPortal() {
  return (
    <div className="relative mx-auto w-full max-w-[430px] rounded-[32px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[28px] border border-sky-100 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 p-4">
        <div className="text-[10px] font-semibold tracking-[0.22em] text-[#64748b]">
          RENTFRAY
        </div>

        <div className="mt-3 text-2xl font-semibold text-[#0f172a]">John Smith</div>
        <div className="mt-1 text-sm text-[#64748b]">Oak Grove Apartments · Unit 102</div>

        <div className="mt-5 rounded-[28px] border border-sky-200 bg-white p-5 text-center shadow-sm">
          <div className="text-xs text-[#64748b]">Current Balance</div>
          <div className="mt-2 text-4xl font-semibold text-[#0f172a]">$1,229.95</div>
          <div className="mt-2 text-sm font-medium text-red-600">Past Due</div>
        </div>

        <div className="mt-4 rounded-[28px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-[#0f172a]">Current Statement</div>

          <div className="mt-4 space-y-3 text-sm text-[#334155]">
            {[
              ["Rent", "$1,100.00"],
              ["Charges", "$65.00"],
              ["Late Fees", "$55.00"],
              ["Processing Fee", "$9.95"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span>{label}</span>
                <span className="font-medium text-[#0f172a]">{value}</span>
              </div>
            ))}

            <div className="border-t border-[#e2e8f0] pt-3" />

            <div className="flex justify-between text-base font-semibold text-[#0f172a]">
              <span>Total due on 4/1/2026</span>
              <span>$1,229.95</span>
            </div>

            <div className="text-sm text-[#64748b]">Grace period ends 4/6/2026.</div>
          </div>
        </div>

        <div className="mt-4 rounded-[28px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-[#0f172a]">Make a Payment</div>

          <div className="mt-3 rounded-xl border border-[#cbd5e1] bg-white px-4 py-3 text-left text-lg text-[#0f172a]">
            1229.95
          </div>

          <div className="mt-3 rounded-2xl bg-[#0f172a] px-4 py-3 text-center text-sm font-semibold text-white">
            Pay Now
          </div>
        </div>
      </div>

      <Bubble className="left-[-110px] top-[112px]">
        Tenants immediately see balance, statement details, and whether they are current or late.
      </Bubble>

      <Bubble className="right-[-120px] top-[360px]">
        Payment flow is mobile-friendly for simplicity and convenience.
      </Bubble>
    </div>
  );
}

function MockMaintenancePortal() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] rounded-[32px] border border-[#dbe4ee] bg-[#eef4f8] p-3 shadow-[0_25px_60px_rgba(15,23,42,0.16)]">
      <div className="rounded-[28px] border border-[#dbe4ee] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
              Maintenance Portal
            </div>
            <div className="mt-1 text-xl font-semibold text-[#0f172a]">
              Active Requests
            </div>
          </div>

          <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#334155]">
            Property 4821
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[
            ["Unit 102", "Leak under sink", "HIGH", "OPEN"],
            ["Unit 201", "AC not cooling", "URGENT", "IN_PROGRESS"],
            ["Unit 305", "Broken outlet", "NORMAL", "COMPLETE"],
          ].map(([unit, issue, urgency, status]) => (
            <div
              key={`${unit}-${issue}`}
              className="rounded-[22px] border border-[#e2e8f0] bg-[#f8fafc] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0f172a]">{unit}</div>
                  <div className="mt-1 text-sm text-[#334155]">{issue}</div>
                </div>

                <div className="flex flex-col gap-2 text-right">
                  <span className="rounded-xl bg-[#fef3c7] px-2 py-1 text-[11px] font-semibold text-[#92400e]">
                    {urgency}
                  </span>
                  <span className="rounded-xl bg-[#e2e8f0] px-2 py-1 text-[11px] font-semibold text-[#334155]">
                    {status}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <div className="rounded-xl bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white">
                  Update
                </div>
                <div className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]">
                  Complete
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Bubble className="left-[-95px] top-[110px]">
        Maintenance sees a clean queue of what needs attention now.
      </Bubble>

      <Bubble className="right-[-118px] top-[250px]">
        Status updates keep management instantly informed without extra calls or texts.
      </Bubble>
    </div>
  );
}

function SlidePreview({ slideId }: { slideId: string }) {
  switch (slideId) {
    case "sv":
      return <MockSimpleView />;
    case "fv":
      return <MockFullView />;
    case "tenant":
      return <MockTenantPortal />;
    case "maintenance":
      return <MockMaintenancePortal />;
    default:
      return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [openDemo, setOpenDemo] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const currentSlide = useMemo(() => slides[activeSlide] ?? slides[0], [activeSlide]);

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
              Always free. Full instant access. No hidden fees, contracts, or trials.
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
              Simple. Clean. Fast.
            </p>
          </section>

          <section className="mt-10 rounded-[32px] border border-[#cbd5e1] bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                See how it works
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[#475569] sm:text-base">
                Preview the manager, tenant, and maintenance experience with a
                quick visual walkthrough.
              </p>
            </div>

            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">
              Click to view each page.
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {slides.map((slide, index) => {
                const bgClass =
                  slide.id === "sv"
                    ? "bg-[#f3f7fb]"
                    : slide.id === "fv"
                    ? "bg-[#f7f4fb]"
                    : slide.id === "tenant"
                    ? "bg-[#f5faf5]"
                    : "bg-[#fbf7f2]";

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
                    <div className="mt-2 text-sm text-[#475569]">{slide.subtitle}</div>
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
      </main>

      {openDemo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-3 py-4 backdrop-blur-sm sm:px-6">
          <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-[#cbd5e1] bg-white shadow-[0_35px_120px_rgba(2,6,23,0.45)]">
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

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fbfd] px-3 py-4 sm:px-6 sm:py-6">
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