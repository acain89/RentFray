import BrandMark from "./BrandMark";
import { CheckIcon } from "./MarketingIcons";

const tiers = [
  {
    label: "Tier 1",
    rows: [
      { unit: "101", tenant: "James Anderson", amount: "$1,209.95", status: "Paid", tone: "paid" },
      { unit: "102", tenant: "Maria Garcia", amount: "$1,209.95", status: "Paid", tone: "paid" },
      { unit: "103", tenant: "Robert Brown", amount: "$1,209.95", status: "In Grace", tone: "grace" },
      { unit: "104", tenant: "Linda Miller", amount: "$1,209.95", status: "Paid", tone: "paid" },
      { unit: "105", tenant: "David Wilson", amount: "$1,209.95", status: "Paid", tone: "paid" },
    ],
  },
  {
    label: "Tier 2",
    rows: [
      { unit: "201", tenant: "Sarah Johnson", amount: "$1,409.95", status: "Paid", tone: "paid" },
      { unit: "202", tenant: "Michael Davis", amount: "$1,409.95", status: "Pending", tone: "pending" },
      { unit: "203", tenant: "Jessica Taylor", amount: "$1,409.95", status: "Paid", tone: "paid" },
      { unit: "204", tenant: "Christopher Martinez", amount: "$1,409.95", status: "Paid", tone: "paid" },
    ],
  },
  {
    label: "Tier 3",
    rows: [
      { unit: "301", tenant: "Daniel Thompson", amount: "$1,609.95", status: "Paid", tone: "paid" },
      { unit: "302", tenant: "Brian White", amount: "$1,609.95", status: "Past Due", tone: "late" },
      { unit: "303", tenant: "Amanda Lee", amount: "$1,609.95", status: "Paid", tone: "paid" },
      { unit: "304", tenant: "Kevin Harris", amount: "$1,609.95", status: "Pending", tone: "pending" },
      { unit: "305", tenant: "Rachel Clark", amount: "$1,609.95", status: "In Grace", tone: "grace" },
    ],
  },
] as const;

export function DashboardPreview() {
  return (
    <div className="rfm-real-dashboard" aria-label="Sample RentFray manager dashboard">
      <section className="rfm-manager-card">
        <div>
          <span className="rfm-dashboard-kicker">RentFray Manager</span>
          <h3>Pine Hollow Apartments</h3>
          <p>Property Code: <strong>5821</strong></p>
          <p>Role: <strong>OWNER</strong></p>
        </div>
        <div className="rfm-manager-actions">
          <span className="rfm-manage-button">Manage</span>
          <span className="rfm-logout-button">Logout</span>
        </div>
      </section>

      <section className="rfm-cycle-card">
        <span className="rfm-dashboard-kicker">Current Cycle</span>
        <h4>July 2026</h4>

        <div className="rfm-cycle-metrics">
          <article>
            <span>Collected</span>
            <strong>$23,650.00</strong>
          </article>
          <article>
            <span>Expected</span>
            <strong>$29,200.00</strong>
          </article>
          <article>
            <span>Units</span>
            <strong>24 / 28 Paid</strong>
          </article>
          <article>
            <span>Late Fees Collected</span>
            <strong>$615.00</strong>
          </article>
        </div>

        <article className="rfm-difference">
          <span>Difference</span>
          <strong>−$5,550.00</strong>
        </article>
      </section>

      <section className="rfm-tier-card">
        {tiers.map((tier) => (
          <div className="rfm-tier-group" key={tier.label}>
            <h5>{tier.label}</h5>
            <div className="rfm-tier-rows">
              {tier.rows.map((row) => (
                <div className="rfm-tier-row" key={row.unit}>
                  <span className={`rfm-dot is-${row.tone}`} />
                  <a tabIndex={-1}>Unit {row.unit}</a>
                  <span className="rfm-tenant-name">{row.tenant}</span>
                  <strong>{row.amount}</strong>
                  <span className={`rfm-row-status is-${row.tone}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function TenantPreview() {
  return (
    <div className="rfm-tenant-scene" aria-label="Tenant portal preview">
      <div className="rfm-tenant-glow" />
      <div className="rfm-phone-shell">
        <div className="rfm-phone-speaker" />
        <div className="rfm-phone-screen">
          <div className="rfm-phone-brand">RentFray</div>
          <div className="rfm-phone-property">Pine Hollow Apartments</div>

          <div className="rfm-phone-card">
            <span>Current balance</span>
            <strong>$1,409.95</strong>
            <small>Due August 1</small>
          </div>

          <span className="rfm-phone-pay">Pay now</span>

          <div className="rfm-phone-lines">
            <div><span>Monthly rent</span><strong>$1,325.00</strong></div>
            <div><span>Water</span><strong>$75.00</strong></div>
            <div><span>Platform fee</span><strong>$9.95</strong></div>
          </div>

          <div className="rfm-phone-history">
            <span><i /> Last payment</span>
            <strong>$1,409.95</strong>
            <small>Paid July 1</small>
          </div>
        </div>
      </div>

      <div className="rfm-payment-toast">
        <span><CheckIcon /></span>
        <div>
          <strong>Payment received</strong>
          <small>Unit 201 · $1,409.95</small>
        </div>
      </div>
    </div>
  );
}
