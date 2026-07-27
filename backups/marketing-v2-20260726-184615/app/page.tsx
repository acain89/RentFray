"use client";

import { useRouter } from "next/navigation";

const unitRows = [
  { unit: "101", tenant: "Smith", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "102", tenant: "Johnson", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "103", tenant: "Brown", balance: "$1,225.00", status: "Past due", tone: "late" },
  { unit: "201", tenant: "Davis", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "202", tenant: "Miller", balance: "$950.00", status: "Processing", tone: "pending" },
] as const;

function BrandMark() {
  return (
    <div className="rf-home-brand" aria-label="RentFray home">
      <span className="rf-home-brand-mark" aria-hidden="true">
        RF
      </span>
      <span>RentFray</span>
    </div>
  );
}

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

function DashboardPreview() {
  return (
    <div className="rf-product-frame rf-product-frame-dashboard">
      <div className="rf-product-window-bar">
        <div className="rf-product-window-dots" aria-hidden="true"><span /><span /><span /></div>
        <span className="rf-product-window-title">Manager dashboard</span>
        <span className="rf-product-live"><i /> Live</span>
      </div>

      <div className="rf-dashboard-preview">
        <aside className="rf-dashboard-sidebar">
          <BrandMark />
          <nav aria-label="Dashboard preview navigation">
            <span className="is-active">Overview</span>
            <span>Payments</span>
            <span>Residents</span>
            <span>Maintenance</span>
            <span>Reports</span>
          </nav>
          <div className="rf-dashboard-property">
            <small>Property</small>
            <strong>Oak Grove</strong>
            <span>48 units</span>
          </div>
        </aside>

        <div className="rf-dashboard-main">
          <div className="rf-dashboard-heading">
            <div>
              <small>July 2026</small>
              <h3>Good morning, Andrew.</h3>
              <p>Here is what needs your attention.</p>
            </div>
            <button type="button" tabIndex={-1}>+ Add payment</button>
          </div>

          <div className="rf-dashboard-metrics">
            <article><span>Expected</span><strong>$45,600</strong><small>Current cycle</small></article>
            <article><span>Collected</span><strong>$38,475</strong><small className="positive">84% received</small></article>
            <article><span>Outstanding</span><strong>$7,125</strong><small>6 units</small></article>
          </div>

          <div className="rf-dashboard-table-card">
            <div className="rf-dashboard-table-header">
              <div><strong>Payment status</strong><span>Current billing cycle</span></div>
              <button type="button" tabIndex={-1}>View all</button>
            </div>
            <div className="rf-dashboard-table-labels"><span>Unit</span><span>Resident</span><span>Balance</span><span>Status</span></div>
            {unitRows.map((row) => (
              <div className="rf-dashboard-row" key={row.unit}>
                <span className="rf-dashboard-unit"><i className={`is-${row.tone}`} />{row.unit}</span>
                <span>{row.tenant}</span>
                <strong>{row.balance}</strong>
                <span className={`rf-dashboard-status is-${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantPreview() {
  return (
    <div className="rf-tenant-scene" aria-label="Tenant portal preview">
      <div className="rf-tenant-glow" />
      <div className="rf-phone-shell">
        <div className="rf-phone-speaker" />
        <div className="rf-phone-screen">
          <div className="rf-phone-brand">RentFray</div>
          <div className="rf-phone-property">Oak Grove Apartments</div>
          <div className="rf-phone-card">
            <span>Current balance</span>
            <strong>$1,229.95</strong>
            <small>Due August 1</small>
          </div>
          <button type="button" tabIndex={-1}>Pay now</button>
          <div className="rf-phone-payment-lines">
            <div><span>Monthly rent</span><strong>$1,150.00</strong></div>
            <div><span>Water</span><strong>$50.00</strong></div>
            <div><span>Platform fee</span><strong>$29.95</strong></div>
          </div>
          <div className="rf-phone-history">
            <span><i className="is-paid" /> Last payment</span>
            <strong>$1,229.95</strong>
            <small>Paid July 1</small>
          </div>
        </div>
      </div>
      <div className="rf-payment-toast">
        <span><CheckIcon /></span>
        <div><strong>Payment received</strong><small>Unit 201 · $1,150.00</small></div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const goTo = (path: string): void => router.push(path);

  return (
    <main className="rf-home">
      <header className="rf-home-header">
        <div className="rf-home-container rf-home-nav">
          <button type="button" className="rf-home-logo-button" onClick={() => goTo("/")}><BrandMark /></button>
          <nav className="rf-home-nav-links" aria-label="Main navigation">
            <a href="#product">How it works</a>
            <a href="#pricing">Pricing</a>
            <button type="button" onClick={() => goTo("/faq")}>FAQ</button>
          </nav>
          <div className="rf-home-nav-actions">
            <button type="button" className="rf-home-signin" onClick={() => goTo("/property-code")}>Sign in</button>
            <button type="button" className="rf-home-button rf-home-button-small" onClick={() => goTo("/setup")}>Create free account</button>
          </div>
        </div>
      </header>

      <section className="rf-home-hero">
        <div className="rf-home-container">
          <div className="rf-home-hero-copy">
            <div className="rf-home-eyebrow"><span /> Free for property owners and managers</div>
            <h1>Rent collection that finally makes sense.</h1>
            <p>Collect rent, manage balances, and see exactly what needs attention—without complicated software or monthly fees.</p>
            <div className="rf-home-hero-actions">
              <button type="button" className="rf-home-button" onClick={() => goTo("/setup")}>Create free account <ArrowIcon /></button>
              <a className="rf-home-text-link" href="#product">See how it works <ArrowIcon /></a>
            </div>
            <div className="rf-home-proof"><span><CheckIcon /> No contracts</span><span><CheckIcon /> No setup fees</span><span><CheckIcon /> Live in minutes</span></div>
          </div>

          <div className="rf-home-hero-product"><DashboardPreview /></div>
        </div>
      </section>

      <section className="rf-home-statement">
        <div className="rf-home-container rf-home-statement-grid">
          <p>Built for apartments, RV parks, mobile home parks, self-storage, HOAs, and independent landlords.</p>
          <div><strong>Simple enough to start today.</strong><span>Capable enough to run the operation.</span></div>
        </div>
      </section>

      <section className="rf-home-showcase" id="product">
        <div className="rf-home-container">
          <div className="rf-home-section-heading">
            <span>Clarity at a glance</span>
            <h2>Know who paid.<br />Know who hasn’t.</h2>
            <p>One clean dashboard shows balances, payment status, collection totals, and the few things that actually require your attention.</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="rf-home-tenant-section">
        <div className="rf-home-container rf-home-tenant-grid">
          <div className="rf-home-section-heading rf-home-section-heading-left">
            <span>Simple for tenants</span>
            <h2>Paying rent shouldn’t be complicated.</h2>
            <p>Tenants activate their own account, see a clear balance, and pay from their phone. No office visit. No confusing portal.</p>
            <a className="rf-home-text-link" href="#steps">See the full process <ArrowIcon /></a>
          </div>
          <TenantPreview />
        </div>
      </section>

      <section className="rf-home-steps" id="steps">
        <div className="rf-home-container">
          <div className="rf-home-section-heading rf-home-section-heading-center">
            <span>From setup to paid</span>
            <h2>Four steps. Then RentFray takes over.</h2>
          </div>
          <div className="rf-home-step-grid">
            <article><b>01</b><h3>Create your account</h3><p>Add the property and set its billing rules.</p></article>
            <article><b>02</b><h3>Connect payouts</h3><p>Securely connect the bank account that receives rent.</p></article>
            <article><b>03</b><h3>Give tenants access</h3><p>Provide the property code and simple instruction sheet.</p></article>
            <article><b>04</b><h3>See payments arrive</h3><p>RentFray tracks balances and status as tenants pay.</p></article>
          </div>
        </div>
      </section>

      <section className="rf-home-pricing" id="pricing">
        <div className="rf-home-container rf-home-pricing-panel">
          <div><span>Simple pricing</span><h2>Free for businesses.<br />No fine print.</h2></div>
          <div className="rf-home-price"><strong>$0</strong><span>per month for owners and managers</span></div>
          <div className="rf-home-price-details"><p>Tenants pay a clearly disclosed platform service fee when they make a payment.</p><span><CheckIcon /> No subscription</span><span><CheckIcon /> No contract</span><span><CheckIcon /> No cancellation fee</span></div>
        </div>
      </section>

      <section className="rf-home-final-cta">
        <div className="rf-home-container">
          <span>Ready when you are.</span>
          <h2>Make rent collection the easy part.</h2>
          <p>Create the account, connect payouts, and start collecting rent today.</p>
          <button type="button" className="rf-home-button rf-home-button-light" onClick={() => goTo("/setup")}>Create free account <ArrowIcon /></button>
        </div>
      </section>

      <footer className="rf-home-footer">
        <div className="rf-home-container rf-home-footer-grid">
          <div><BrandMark /><p>Modern rent collection without unnecessary software.</p></div>
          <div><strong>Product</strong><a href="#product">How it works</a><a href="#pricing">Pricing</a><button type="button" onClick={() => goTo("/faq")}>FAQ</button></div>
          <div><strong>Access</strong><button type="button" onClick={() => goTo("/property-code")}>Property portal</button><button type="button" onClick={() => goTo("/login/admin")}>Admin portal</button><button type="button" onClick={() => goTo("/install")}>Install app</button></div>
          <div><strong>Questions?</strong><a href="mailto:helpdesk@rentfray.com">helpdesk@rentfray.com</a><a href="tel:19363461538">(936) 346-1538</a></div>
        </div>
        <div className="rf-home-container rf-home-footer-bottom"><span>© 2026 RentFray</span><span>Secure payments powered by Stripe</span></div>
      </footer>
    </main>
  );
}
