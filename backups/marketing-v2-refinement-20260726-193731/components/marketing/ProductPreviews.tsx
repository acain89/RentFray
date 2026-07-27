import BrandMark from "./BrandMark";
import { CheckIcon } from "./MarketingIcons";

const unitRows = [
  { unit: "101", tenant: "Smith", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "102", tenant: "Johnson", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "103", tenant: "Brown", balance: "$1,225.00", status: "Past due", tone: "late" },
  { unit: "201", tenant: "Davis", balance: "$0.00", status: "Paid", tone: "paid" },
  { unit: "202", tenant: "Miller", balance: "$950.00", status: "Processing", tone: "pending" },
] as const;

export function DashboardPreview() {
  return (
    <div className="rfm-product-frame">
      <div className="rfm-window-bar">
        <div className="rfm-window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="rfm-window-title">Manager dashboard</span>
        <span className="rfm-live">
          <i /> Live
        </span>
      </div>

      <div className="rfm-dashboard">
        <aside className="rfm-dashboard-sidebar">
          <BrandMark compact />
          <nav aria-label="Dashboard preview navigation">
            <span className="is-active">Overview</span>
            <span>Payments</span>
            <span>Residents</span>
            <span>Maintenance</span>
            <span>Reports</span>
          </nav>
          <div className="rfm-dashboard-property">
            <small>Property</small>
            <strong>Oak Grove</strong>
            <span>48 units</span>
          </div>
        </aside>

        <div className="rfm-dashboard-main">
          <div className="rfm-dashboard-heading">
            <div>
              <small>July 2026</small>
              <h3>Good morning, Andrew.</h3>
              <p>Here is what needs your attention.</p>
            </div>
            <span className="rfm-preview-button">+ Add payment</span>
          </div>

          <div className="rfm-dashboard-metrics">
            <article>
              <span>Expected</span>
              <strong>$45,600</strong>
              <small>Current cycle</small>
            </article>
            <article>
              <span>Collected</span>
              <strong>$38,475</strong>
              <small className="positive">84% received</small>
            </article>
            <article>
              <span>Outstanding</span>
              <strong>$7,125</strong>
              <small>6 units</small>
            </article>
          </div>

          <div className="rfm-table-card">
            <div className="rfm-table-header">
              <div>
                <strong>Payment status</strong>
                <span>Current billing cycle</span>
              </div>
              <span>View all</span>
            </div>
            <div className="rfm-table-labels">
              <span>Unit</span>
              <span>Resident</span>
              <span>Balance</span>
              <span>Status</span>
            </div>
            {unitRows.map((row) => (
              <div className="rfm-table-row" key={row.unit}>
                <span className="rfm-unit">
                  <i className={`is-${row.tone}`} />
                  {row.unit}
                </span>
                <span>{row.tenant}</span>
                <strong>{row.balance}</strong>
                <span className={`rfm-status is-${row.tone}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
          <div className="rfm-phone-property">Oak Grove Apartments</div>

          <div className="rfm-phone-card">
            <span>Current balance</span>
            <strong>$1,229.95</strong>
            <small>Due August 1</small>
          </div>

          <span className="rfm-phone-pay">Pay now</span>

          <div className="rfm-phone-lines">
            <div>
              <span>Monthly rent</span>
              <strong>$1,150.00</strong>
            </div>
            <div>
              <span>Water</span>
              <strong>$50.00</strong>
            </div>
            <div>
              <span>Platform fee</span>
              <strong>$29.95</strong>
            </div>
          </div>

          <div className="rfm-phone-history">
            <span>
              <i /> Last payment
            </span>
            <strong>$1,229.95</strong>
            <small>Paid July 1</small>
          </div>
        </div>
      </div>

      <div className="rfm-payment-toast">
        <span>
          <CheckIcon />
        </span>
        <div>
          <strong>Payment received</strong>
          <small>Unit 201 · $1,150.00</small>
        </div>
      </div>
    </div>
  );
}
