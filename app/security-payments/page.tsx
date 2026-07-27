import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { DetailCard, DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

export default function SecurityPaymentsPage() {
  return (
    <MarketingPageShell
      eyebrow="Security & payments"
      title={<>Stripe handles the payment.<br />RentFray handles the workflow.</>}
      intro="Sensitive payment information is handled by Stripe. RentFray does not store bank login credentials or retain the property’s rent, recurring charges, or late fees."
    >
      <DetailSection eyebrow="Money flow" title="See exactly where the money goes." text="Stripe processes the payment and separates the property funds from the RentFray platform fee.">
        <div className="rfp-flow">
          <div className="rfp-flow-node"><span>1</span><strong>Tenant</strong><p>Pays $1,484.95</p></div>
          <div className="rfp-flow-arrow">→</div>
          <div className="rfp-flow-node is-stripe"><span>2</span><strong>Stripe</strong><p>Securely processes and separates the transaction</p></div>
          <div className="rfp-flow-split">
            <article><span>3A</span><strong>Business account</strong><b>$1,475.00</b><p>Rent + recurring charges + late fees</p></article>
            <article><span>3B</span><strong>RentFray</strong><b>$9.95</b><p>Platform fee only</p></article>
          </div>
        </div>
      </DetailSection>

      <DetailSection eyebrow="What RentFray receives" title="Only the platform fee." text="RentFray does not retain the property’s rent, recurring charges, or late fees. Those amounts are directed through Stripe to the connected business account." dark />

      <DetailSection eyebrow="Payment security" title="Sensitive information stays with Stripe.">
        <div className="rfp-grid-three">
          <DetailCard title="Bank information" text="Banking credentials and sensitive payment details are handled through Stripe’s secure infrastructure." />
          <DetailCard title="Encryption" text="Payment data is protected using modern encryption and established payment-security practices." />
          <DetailCard title="Connected payouts" text="The business connects its payout account through Stripe Connect and receives its property funds there." />
        </div>
      </DetailSection>
    </MarketingPageShell>
  );
}
