import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { DetailCard, DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

const managerSteps = [
  ["01", "Create the account", "Create your login and begin the guided property setup."],
  ["02", "Set the property rules", "Add rent tiers, recurring charges, due dates, grace periods, and late fees."],
  ["03", "Connect Stripe", "Connect the bank account that should receive property funds."],
  ["04", "Give tenants the property code", "Provide the code and tier information. Tenants handle their own activation."],
] as const;

const tenantSteps = [
  ["01", "Enter the property code", "Start from RentFray using the code supplied by management."],
  ["02", "Select the tier and unit", "Confirm the correct rent tier and unit number."],
  ["03", "Create a PIN", "Create a private PIN for future access."],
  ["04", "Review and pay", "See the full balance, platform fee, and total before paying."],
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingPageShell
      eyebrow="How it works"
      title={<>Four manager steps.<br />Four tenant steps.<br />That is the system.</>}
      intro="No sales call. No onboarding appointment. No spreadsheet import. RentFray is built to be understood and used without outside help."
    >
      <DetailSection eyebrow="For managers" title="Set it up once." text="The setup is guided, self-serve, and focused only on what RentFray needs to collect recurring payments correctly.">
        <div className="rfp-grid-four">{managerSteps.map(([n,t,x]) => <DetailCard key={n} number={n} title={t} text={x} />)}</div>
      </DetailSection>

      <DetailSection eyebrow="Then" title="RentFray handles the monthly routine." text="The dashboard shows collected totals, expected totals, late fees, balances, and color-coded payment status." dark>
        <div className="rfp-status-row">
          <div><i className="is-paid" /><strong>Paid</strong><span>Payment completed</span></div>
          <div><i className="is-grace" /><strong>Grace period</strong><span>Still within allowed time</span></div>
          <div><i className="is-pending" /><strong>Pending</strong><span>Payment is processing</span></div>
          <div><i className="is-late" /><strong>Past due</strong><span>Needs attention</span></div>
        </div>
      </DetailSection>

      <DetailSection eyebrow="For tenants" title="The tenant does the onboarding." text="Management provides the property code and tier information. The tenant completes the rest from a phone, tablet, or computer.">
        <div className="rfp-grid-four">{tenantSteps.map(([n,t,x]) => <DetailCard key={n} number={n} title={t} text={x} />)}</div>
      </DetailSection>
    </MarketingPageShell>
  );
}
