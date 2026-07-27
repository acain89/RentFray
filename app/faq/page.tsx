import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import "../marketing-pages.css";

const faqs = [
  ["Is RentFray really free for businesses?", "Yes. RentFray does not charge property owners or managers a monthly software subscription, setup fee, contract fee, or cancellation fee."],
  ["What do tenants pay?", "Tenants pay the property balance plus a clearly disclosed RentFray platform fee. The maximum platform fee is $9.95, and smaller payment totals receive smaller fees."],
  ["Does RentFray deduct its fee from my rent?", "No. Rent, recurring charges, and late fees are directed to the business’s connected account. RentFray receives the platform fee separately."],
  ["How are payments processed?", "Payments are securely processed through Stripe. Businesses connect their payout account through Stripe Connect."],
  ["Does RentFray store banking information?", "RentFray does not store bank login credentials. Sensitive payment and banking information is handled through Stripe’s secure infrastructure."],
  ["How long does setup take?", "The setup is designed to take only a few minutes: create the account, configure the property, connect Stripe, and give tenants the property code."],
  ["Do I need a demo or onboarding call?", "No. RentFray is completely self-serve. There is no required sales call, training session, or onboarding appointment."],
  ["How do tenants get started?", "Management gives each tenant the property code and tier information. The tenant enters the code, selects the unit, creates a PIN, and completes the first payment."],
  ["Can RentFray charge recurring monthly items?", "Yes. Properties can include recurring charges such as water, trash, lot fees, or other monthly items alongside rent."],
  ["Can RentFray apply late fees?", "Yes. Managers configure the grace period, initial late fee, daily late fee, and daily-fee limit during setup."],
  ["Does RentFray support prorated rent calculations?", "No. Automatic prorated charge calculations are intentionally outside RentFray’s focused recurring-payment workflow."],
  ["Does RentFray include tenant screening?", "No. RentFray does not provide tenant screening, credit checks, or background checks."],
  ["Does RentFray replace accounting software?", "No. RentFray tracks property charges, payments, balances, late fees, and payment history. It is not intended to replace full accounting or bookkeeping software."],
  ["Can I manage RentFray from my phone?", "Yes. RentFray is designed to work on phones, tablets, and desktop computers."],
  ["Who can I contact if I need help?", "Email helpdesk@rentfray.com or call or text (936) 346-1538."],
] as const;

export default function FAQPage() {
  return (
    <MarketingPageShell eyebrow="FAQ" title={<>Straight answers.<br />No sales language.</>} intro="The practical questions businesses and tenants ask before using RentFray.">
      <section className="rfp-section">
        <div className="rfm-container rfp-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
