"use client";

import { useRouter } from "next/navigation";

const managerSteps = [
  {
    number: "01",
    title: "Create the property",
    text: "Enter the property details, rent tiers, due date, grace period, and late-fee rules in one guided setup.",
  },
  {
    number: "02",
    title: "Connect payouts",
    text: "Connect the owner's bank account securely through Stripe. RentFray never stores banking credentials or holds tenant funds.",
  },
  {
    number: "03",
    title: "Give tenants their instructions",
    text: "Print the Tenant Instruction Sheet, add the property code and tier, then hand it to each tenant.",
  },
  {
    number: "04",
    title: "Run everything from one dashboard",
    text: "See who paid, who is processing, who is in the grace period, and who needs attention without maintaining a separate spreadsheet.",
  },
] as const;

const tenantSteps = [
  "Enter the property code.",
  "Select the correct tier and unit.",
  "Create a private PIN.",
  "Review the balance and pay online.",
] as const;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 10.5 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HowItWorksPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#fbfdfb] text-[#17261d]">
      <header className="sticky top-0 z-40 border-b border-[#e4ebe5]/90 bg-[#fbfdfb]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-[min(100%-32px,1180px)] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-[19px] font-semibold tracking-[-0.03em]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17261d] text-[11px] font-bold tracking-[0.08em] text-white">
              RF
            </span>
            RentFray
          </button>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#647169] md:flex">
            <button type="button" onClick={() => router.push("/")}>Home</button>
            <a href="#managers">Managers</a>
            <a href="#tenants">Tenants</a>
            <a href="#pricing">Pricing</a>
            <button type="button" onClick={() => router.push("/faq")}>FAQ</button>
          </nav>

          <button
            type="button"
            onClick={() => router.push("/setup")}
            className="rounded-full bg-[#17261d] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#25382b]"
          >
            Create free account
          </button>
        </div>
      </header>

      <section className="overflow-hidden px-4 pb-24 pt-24 sm:pt-32">
        <div className="mx-auto max-w-[980px] text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#dce7de] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#587060] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#7eab86]" />
            Simple from setup to payment
          </div>
          <h1 className="mx-auto mt-7 max-w-[900px] text-[clamp(50px,8vw,92px)] font-semibold leading-[0.98] tracking-[-0.065em]">
            Rent collection,
            <span className="block text-[#789a80]">without the complexity.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[680px] text-lg leading-8 text-[#657169] sm:text-xl">
            Managers complete one guided setup. Tenants activate themselves. RentFray handles the monthly routine.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/setup")}
              className="inline-flex min-h-14 items-center gap-3 rounded-full bg-[#17261d] px-7 text-base font-semibold text-white shadow-[0_18px_45px_rgba(23,38,29,0.18)] transition hover:-translate-y-0.5 hover:bg-[#25382b]"
            >
              Create free account
              <span className="h-5 w-5"><ArrowIcon /></span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/property-code")}
              className="min-h-14 rounded-full border border-[#d7e1d9] bg-white px-7 text-base font-semibold text-[#17261d] transition hover:border-[#b9cbbd] hover:bg-[#f6faf7]"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>

      <section id="managers" className="border-y border-[#e7ede8] bg-white px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="max-w-[720px]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#789a80]">For managers</span>
            <h2 className="mt-4 text-[clamp(42px,6vw,68px)] font-semibold leading-[1.02] tracking-[-0.055em]">
              Set it up once.
              <span className="block text-[#789a80]">See what matters every day.</span>
            </h2>
          </div>

          <div className="mt-16 grid border-t border-[#dfe7e1] md:grid-cols-2">
            {managerSteps.map((step, index) => (
              <article
                key={step.number}
                className={`min-h-[300px] border-b border-[#dfe7e1] py-10 md:p-12 ${
                  index % 2 === 0 ? "md:border-r" : ""
                }`}
              >
                <span className="text-xs font-bold tracking-[0.16em] text-[#91a797]">{step.number}</span>
                <h3 className="mt-16 text-2xl font-semibold tracking-[-0.035em]">{step.title}</h3>
                <p className="mt-4 max-w-[480px] text-base leading-7 text-[#69766e]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tenants" className="overflow-hidden bg-[#17261d] px-4 py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[1180px] items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#a7c0ad]">For tenants</span>
            <h2 className="mt-4 text-[clamp(44px,6vw,72px)] font-semibold leading-[1.02] tracking-[-0.06em]">
              Paying rent shouldn't be complicated.
            </h2>
            <p className="mt-6 max-w-[560px] text-lg leading-8 text-[#bdc9c0]">
              The instruction sheet tells tenants exactly where to go and what to enter. From there, the process is direct and mobile-friendly.
            </p>

            <div className="mt-10 space-y-3">
              {tenantSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-4 border-b border-white/10 py-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#b8d2be]">
                    {index + 1}
                  </span>
                  <span className="text-base text-[#edf3ee]">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute inset-12 rounded-full bg-[#789a80]/25 blur-3xl" />
            <div className="relative mx-auto w-[300px] rounded-[44px] border border-white/15 bg-[#0e1812] p-3 shadow-[0_45px_100px_rgba(0,0,0,0.4)] sm:w-[340px]">
              <div className="rounded-[34px] bg-[#f5f9f6] px-6 pb-8 pt-5 text-[#17261d]">
                <div className="mx-auto mb-7 h-1.5 w-20 rounded-full bg-[#17261d]/15" />
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#789a80]">RentFray</div>
                <div className="mt-3 text-sm font-semibold">Oak Grove Apartments</div>
                <div className="mt-8 rounded-[26px] border border-[#dce6de] bg-white p-6 shadow-[0_16px_40px_rgba(45,73,54,0.08)]">
                  <span className="text-xs text-[#768279]">Current balance</span>
                  <strong className="mt-2 block text-4xl tracking-[-0.055em]">$1,229.95</strong>
                  <small className="mt-2 block text-[#839087]">Due August 1</small>
                </div>
                <button type="button" tabIndex={-1} className="mt-5 w-full rounded-2xl bg-[#17261d] py-4 text-sm font-semibold text-white">
                  Pay now
                </button>
                <div className="mt-7 space-y-4 text-sm">
                  <div className="flex justify-between"><span className="text-[#7b877f]">Monthly rent</span><strong>$1,150.00</strong></div>
                  <div className="flex justify-between"><span className="text-[#7b877f]">Water</span><strong>$50.00</strong></div>
                  <div className="flex justify-between"><span className="text-[#7b877f]">Processing fee</span><strong>$29.95</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white px-4 py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#789a80]">Straightforward pricing</span>
            <h2 className="mt-4 text-[clamp(44px,6vw,72px)] font-semibold leading-[1.02] tracking-[-0.06em]">
              Free for property owners and managers.
            </h2>
            <p className="mt-6 max-w-[590px] text-lg leading-8 text-[#69766e]">
              No subscription. No setup charge. No cancellation fee. Tenants pay the clearly disclosed payment fee when they check out.
            </p>
          </div>

          <div className="rounded-[32px] border border-[#dfe8e1] bg-[#f3f7f4] p-8 sm:p-10">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#789a80]">Manager account</span>
            <div className="mt-5 text-[76px] font-semibold leading-none tracking-[-0.08em]">$0</div>
            <div className="mt-2 text-base text-[#6d796f]">per month</div>
            <div className="mt-8 space-y-4">
              {["No contract", "No trial expiration", "No setup fee", "Cancel anytime"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-semibold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#dfece2] text-[#5b8864]">
                    <span className="h-4 w-4"><CheckIcon /></span>
                  </span>
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => router.push("/setup")}
              className="mt-9 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#17261d] px-7 text-base font-semibold text-white transition hover:bg-[#25382b]"
            >
              Start setup
              <span className="h-5 w-5"><ArrowIcon /></span>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#eef4ef] px-4 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-[850px]">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#789a80]">Ready when you are</span>
          <h2 className="mt-5 text-[clamp(46px,7vw,78px)] font-semibold leading-[1] tracking-[-0.065em]">
            Make rent collection the easy part.
          </h2>
          <p className="mx-auto mt-6 max-w-[600px] text-lg leading-8 text-[#69766e]">
            Complete the guided setup, connect payouts, and give tenants their instruction sheet.
          </p>
          <button
            type="button"
            onClick={() => router.push("/setup")}
            className="mt-9 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#17261d] px-8 text-base font-semibold text-white shadow-[0_18px_45px_rgba(23,38,29,0.16)] transition hover:-translate-y-0.5 hover:bg-[#25382b]"
          >
            Create free account
            <span className="h-5 w-5"><ArrowIcon /></span>
          </button>
        </div>
      </section>

      <footer className="border-t border-[#e5ebe6] bg-white px-4 py-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 text-sm text-[#738078] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 RentFray. Rent collection that makes sense.</span>
          <div className="flex flex-wrap gap-6">
            <button type="button" onClick={() => router.push("/faq")}>FAQ</button>
            <a href="mailto:helpdesk@rentfray.com">Support</a>
            <button type="button" onClick={() => router.push("/property-code")}>Sign in</button>
          </div>
        </div>
      </footer>
    </main>
  );
}
