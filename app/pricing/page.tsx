import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { CheckMark, DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

export default function PricingPage() {
  return (
    <MarketingPageShell
      eyebrow="Pricing"
      title={<>Free for businesses.<br />Clear for tenants.</>}
      intro="No monthly subscription. No setup charge. No contract. RentFray earns revenue from the platform fee shown before checkout."
    >
      <DetailSection eyebrow="Business pricing" title="$0 per month. Always." text="Owners and managers can create an account, connect payouts, use the dashboard, and collect payments without paying a software subscription.">
        <div className="rfp-price-facts">
          {["No subscription", "No setup fee", "No contract", "No cancellation fee", "No paid upgrade required"].map((item) => (
            <div key={item}><span><CheckMark /></span><strong>{item}</strong></div>
          ))}
        </div>
      </DetailSection>

      <DetailSection eyebrow="Tenant platform fee" title="$9.95 is the maximum." text="Tenants never pay more than $9.95 in RentFray platform fees. Smaller payment totals receive smaller fees. It only goes down from the maximum." dark>
        <div className="rfp-max-fee"><span>Maximum platform fee</span><strong>$9.95</strong><p>Never higher.</p></div>
      </DetailSection>

      <DetailSection eyebrow="Example checkout" title="Every dollar is shown before payment.">
        <div className="rfp-checkout-grid">
          <div className="rfp-receipt">
            <span>Tenant checkout</span>
            <div><p>Rent</p><strong>$1,400.00</strong></div>
            <div><p>Water</p><strong>$50.00</strong></div>
            <div><p>Trash</p><strong>$25.00</strong></div>
            <hr />
            <div><p>Property subtotal</p><strong>$1,475.00</strong></div>
            <div><p>Platform fee</p><strong>$9.95</strong></div>
            <hr />
            <div className="is-total"><p>Tenant pays</p><strong>$1,484.95</strong></div>
          </div>

          <div className="rfp-money-result">
            <article><span>Business receives</span><strong>$1,475.00</strong><p>Rent, water, and trash charges.</p></article>
            <article><span>RentFray receives</span><strong>$9.95</strong><p>The separately disclosed platform fee.</p></article>
          </div>
        </div>

        <div className="rfp-important-note">
          <strong>RentFray never deducts fees from your rent.</strong>
          <p>Your rent, recurring charges, and late fees are directed to your connected bank account. The platform fee is collected separately by RentFray.</p>
        </div>
      </DetailSection>
    </MarketingPageShell>
  );
}

