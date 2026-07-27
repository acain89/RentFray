import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { Checklist, DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

const typicalSteps = [
  "Schedule a demo", "Wait for a sales call", "Compare pricing plans", "Choose a paid package",
  "Sign a contract", "Import property data", "Attend onboarding", "Train managers and staff",
  "Invite or manually create tenants", "Configure payment processing", "Wait for account approval",
  "Begin collecting payments",
] as const;

const rentfraySteps = ["Create an account", "Connect Stripe", "Give tenants the property code"] as const;

export default function WhyRentFrayPage() {
  return (
    <MarketingPageShell
      eyebrow="Why RentFray?"
      title={<>RentFray's simplicity is not an accident.<br />It is a deliberate design principle.</>}
      intro="RentFray was built for businesses that need recurring payment collection, not another expensive system to manage."
    >
      <DetailSection eyebrow="The difference" title="Look at the setup." text="Some software is built around sales teams, contracts, imports, training, and long onboarding. RentFray is built around getting the job done.">
        <div className="rfp-comparison">
          <article>
            <span>Typical software</span>
            <h3>Days or weeks before you are ready.</h3>
            <Checklist items={typicalSteps} negative />
            <div className="rfp-comparison-footer">
           <strong>And then you pay every month.</strong>
           </div>
          </article>
          <article className="is-rentfray">
            <span>RentFray</span>
            <h3>Three steps.</h3>
            <Checklist items={rentfraySteps} />
            <div className="rfp-comparison-footer">
            <strong>Time to complete:</strong>
            <span>About 10 minutes.</span>
            </div>
          </article>
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="No invitation emails"
        title="Tenants onboard themselves with the property code."
        text="Traditional software often requires management to create tenant accounts, send invitation links, resend emails, and reset passwords. RentFray gives each property one unique code that tenants use to activate themselves."
      >
        <div className="rfp-important-note">
          <strong>Give tenants the code. They handle the rest.</strong>
          <p>
            Enter property code. Select tier and unit. Create PIN. Pay.
          </p>
        </div>
      </DetailSection>
      <DetailSection eyebrow="Self-serve by design" title="No phone call. No email chain. No training session." text="Create the account yourself. Configure the property yourself. Connect Stripe yourself. Tenants onboard themselves." dark />

      <DetailSection eyebrow="The rule" title="Every feature has to earn its place." text="Every feature has to answer one question: Does this make recurring payment collection simpler? If the answer is no, it probably does not belong.">
        <blockquote className="rfp-quote">
  Software should reduce complexity, not create it.
</blockquote>
      </DetailSection>

      <DetailSection eyebrow="Simple on purpose" title="RentFray is not trying to replace every system you use." text="It is not an accounting suite, leasing platform, CRM, screening service, or enterprise ERP. It has one goal: streamline the recurring, month-to-month business needs that otherwise waste your time." dark />
    </MarketingPageShell>
  );
}


