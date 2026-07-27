"use client";

import { useRouter } from "next/navigation";
import MarketingFooter from "./MarketingFooter";
import MarketingNavigation from "./MarketingNavigation";
import { ArrowIcon, CheckIcon } from "./MarketingIcons";
import { DashboardPreview, TenantPreview } from "./ProductPreviews";

const steps = [
  {
    number: "01",
    title: "Create your account",
    text: "Add the property and set its billing rules.",
  },
  {
    number: "02",
    title: "Connect payouts",
    text: "Securely connect the bank account that receives rent.",
  },
  {
    number: "03",
    title: "Give tenants access",
    text: "Provide the property code and simple instruction sheet.",
  },
  {
    number: "04",
    title: "See payments arrive",
    text: "RentFray tracks balances and status as tenants pay.",
  },
] as const;

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="rfm-home">
      <MarketingNavigation />

      <section className="rfm-hero">
        <div className="rfm-container">
          <div className="rfm-hero-copy">
            <div className="rfm-eyebrow">
              <span /> Free for property owners and managers
            </div>
            <h1>Rent collection that finally makes sense.</h1>
            <p>
              Collect rent, manage balances, and see exactly what needs
              attention—without complicated software or monthly fees.
            </p>

            <div className="rfm-hero-actions">
              <button
                type="button"
                className="rfm-button"
                onClick={() => router.push("/setup")}
              >
                Create free account
                <ArrowIcon />
              </button>
              <button
                type="button"
                className="rfm-text-link"
                onClick={() => router.push("/how-it-works")}
              >
                See how it works
                <ArrowIcon />
              </button>
            </div>

            <div className="rfm-proof">
              <span>
                <CheckIcon /> No contracts
              </span>
              <span>
                <CheckIcon /> No setup fees
              </span>
              <span>
                <CheckIcon /> Live in minutes
              </span>
            </div>
          </div>

          <div className="rfm-hero-product">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="rfm-statement">
        <div className="rfm-container rfm-statement-grid">
          <p>
            Built for apartments, RV parks, mobile home parks, self-storage,
            HOAs, and independent landlords.
          </p>
          <div>
            <strong>Simple enough to start today.</strong>
            <span>Capable enough to run the operation.</span>
          </div>
        </div>
      </section>

      <section className="rfm-showcase">
        <div className="rfm-container">
          <div className="rfm-section-heading">
            <span>Clarity at a glance</span>
            <h2>
              Know who paid.
              <br />
              Know who hasn’t.
            </h2>
            <p>
              One clean dashboard shows balances, payment status, collection
              totals, and the few things that actually require your attention.
            </p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="rfm-tenant-section">
        <div className="rfm-container rfm-tenant-grid">
          <div className="rfm-section-heading rfm-section-heading-left">
            <span>Simple for tenants</span>
            <h2>Paying rent shouldn’t be complicated.</h2>
            <p>
              Tenants activate their own account, see a clear balance, and pay
              from their phone. No office visit. No confusing portal.
            </p>
            <button
              type="button"
              className="rfm-text-link"
              onClick={() => router.push("/how-it-works")}
            >
              See the full process
              <ArrowIcon />
            </button>
          </div>
          <TenantPreview />
        </div>
      </section>

      <section className="rfm-steps">
        <div className="rfm-container">
          <div className="rfm-section-heading rfm-section-heading-center">
            <span>From setup to paid</span>
            <h2>Four steps. Then RentFray takes over.</h2>
          </div>

          <div className="rfm-step-grid">
            {steps.map((step) => (
              <article key={step.number}>
                <b>{step.number}</b>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rfm-pricing" id="pricing">
        <div className="rfm-container rfm-pricing-panel">
          <div>
            <span>Simple pricing</span>
            <h2>
              Free for businesses.
              <br />
              No fine print.
            </h2>
          </div>

          <div className="rfm-price">
            <strong>$0</strong>
            <span>per month for owners and managers</span>
          </div>

          <div className="rfm-price-details">
            <p>
              Tenants pay a clearly disclosed platform fee when they make a
              payment.
            </p>
            <span>
              <CheckIcon /> No contract
            </span>
            <span>
              <CheckIcon /> No trial expiration
            </span>
            <span>
              <CheckIcon /> No cancellation fee
            </span>
          </div>
        </div>
      </section>

      <section className="rfm-final-cta">
        <div className="rfm-container">
          <span>Ready when you are</span>
          <h2>Make rent collection the easy part.</h2>
          <p>Create your free account and be ready to accept payments today.</p>
          <button
            type="button"
            className="rfm-button rfm-button-light"
            onClick={() => router.push("/setup")}
          >
            Create free account
            <ArrowIcon />
          </button>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
