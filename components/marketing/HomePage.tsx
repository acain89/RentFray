"use client";

import { useRouter } from "next/navigation";
import MarketingFooter from "./MarketingFooter";
import MarketingNavigation from "./MarketingNavigation";
import { ArrowIcon, CheckIcon, LockIcon } from "./MarketingIcons";
import { DashboardPreview, TenantPreview } from "./ProductPreviews";
import Link from "next/link";

const steps = [
  { number: "1", title: "Create your account", text: "Add your property and set its billing rules.", icon: "building" },
  { number: "2", title: "Connect payouts", text: "Securely connect the bank account that receives rent.", icon: "bank" },
  { number: "3", title: "Give tenants access", text: "Provide the property code and simple instruction sheet.", icon: "people" },
  { number: "4", title: "See payments arrive", text: "RentFray tracks balances and status as tenants pay.", icon: "check" },
] as const;

function StepIcon({ type }: { type: (typeof steps)[number]["icon"] }) {
  if (type === "building") {
    return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M6 24V7l8-3v20M14 10h8v14M3 24h22M9 10h2M9 14h2M9 18h2M17 13h2M17 17h2M17 21h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  if (type === "bank") {
    return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m4 10 10-6 10 6M5 11h18M7 11v10M12 11v10M16 11v10M21 11v10M4 22h20M3 25h22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  if (type === "people") {
    return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="10" cy="9" r="4" stroke="currentColor" strokeWidth="1.7"/><circle cx="20" cy="10" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M3 24v-2a7 7 0 0 1 14 0v2M17 17a6 6 0 0 1 8 5.7V24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  }
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.7"/><path d="m9 14 3.2 3.2L19 10.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="rfm-home">
      <MarketingNavigation />

      <section className="rfm-hero">
        <div className="rfm-container rfm-hero-grid">
          <div className="rfm-hero-copy">
            <div className="rfm-eyebrow"><span /> Free for property owners and managers</div>
            <h1>Rent collection that makes sense.</h1>
            <p>Collect rent, manage balances, and see exactly what needs attention - without complicated software or monthly fees.</p>

            <div className="rfm-hero-actions">
              <button type="button" className="rfm-button" onClick={() => router.push("/setup")}>
                Create Account <ArrowIcon />
              </button>
             <Link className="rfm-text-link" href="/how-it-works">
              See how it works <ArrowIcon />
              </Link>
            </div>

            <div className="rfm-proof">
              <span><CheckIcon /> No contracts</span>
              <span><CheckIcon /> No setup fees</span>
              <span><CheckIcon /> Live in minutes</span>
            </div>

            <div className="rfm-hero-submessage">
              <span>Know what matters</span>
              <h2>Know who paid.<br />Know who hasn't.<br />At a glance.</h2>
              <p>One dashboard. Everything that needs your attention.</p>
            </div>
          </div>

          <div className="rfm-dashboard-stage">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="rfm-tenant-section">
        <div className="rfm-container rfm-tenant-grid">
          <div className="rfm-section-heading rfm-section-heading-left">
            <span>Simple for tenants</span>
            <h2>Paying rent shouldn't be complicated.</h2>
            <p>Tenants activate their own account, see a clear balance, and pay from their phone. No office visit. No confusing portal.</p>
            <button type="button" className="rfm-text-link" onClick={() => router.push("/how-it-works")}>
              See the full process <ArrowIcon />
            </button>
          </div>
          <TenantPreview />
        </div>
      </section>

      <section className="rfm-steps">
        <div className="rfm-container">
          <div className="rfm-section-heading rfm-section-heading-center">
            <span>Easy setup</span>
            <h2>Just four steps, and then RentFray does the rest.</h2>
          </div>

          <div className="rfm-step-grid">
            {steps.map((step) => (
              <article key={step.number}>
                <div className="rfm-step-top">
                  <b>{step.number}</b>
                  <span className="rfm-step-icon"><StepIcon type={step.icon} /></span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rfm-stripe">
        <div className="rfm-container rfm-stripe-panel">
          <div className="rfm-stripe-word">stripe</div>
          <div className="rfm-stripe-lock"><LockIcon /></div>
          <div>
            <h2>Payments securely processed through Stripe.</h2>
            <p>Bank-level encryption, secure payment processing, and automated payouts. RentFray never stores banking information or holds tenant funds.</p>
          </div>
        </div>
      </section>

      <section className="rfm-pricing" id="pricing">
        <div className="rfm-container rfm-pricing-panel">
          <div>
            <span>Simple pricing</span>
            <h2>Free for businesses.<br />No fine print.</h2>
          </div>

          <div className="rfm-price">
            <strong>$0</strong>
            <span>per month for owners and managers</span>
          </div>

          <div className="rfm-price-details">
            <span><CheckIcon /> No contract</span>
            <span><CheckIcon /> No trial expiration</span>
            <span><CheckIcon /> No cancellation fee</span>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-12">
        <div className="rfm-container">
          <div className="mx-auto max-w-4xl">
            <div className="mb-7">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Rent Collection Resources
              </span>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Learn more about collecting rent online
              </h2>

              <p className="mt-3 max-w-2xl text-slate-600">
                Explore RentFray&apos;s guides to online rent payments, tenant
                payment tracking, and rent collection software.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/free-rent-collection-software"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Free Rent Collection Software
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Online Rent Payment System
              </Link>

              <Link
                href="/collect-rent-online"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Collect Rent Online
              </Link>

              <Link
                href="/rent-collection-software-landlords"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Rent Collection for Landlords
              </Link>

              <Link
                href="/landlord-payment-system"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Landlord Payment System
              </Link>

              <Link
                href="/tenant-payment-portal"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>

              <Link
                href="/rent-payment-app"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Rent Payment App
              </Link>

              <Link
                href="/rent-tracking-software"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Rent Tracking Software
              </Link>

              <Link
                href="/free-rent-collection-software-no-monthly-fee"
                className="rounded-xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                No Monthly Fee Rent Software
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rfm-final-cta">
        <div className="rfm-container">
          <span>Ready when you are</span>
          <h2>Make rent collection the easy part.</h2>
          <p>Create your account and be ready to accept payments today.</p>
          <button type="button" className="rfm-button rfm-button-light" onClick={() => router.push("/setup")}>
            Create Account <ArrowIcon />
          </button>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

