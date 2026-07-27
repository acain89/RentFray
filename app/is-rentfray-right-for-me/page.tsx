import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { Checklist, DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

const goodFit = [
  "You collect recurring monthly rent or property charges",
  "You want tenants to pay online",
  "You want a clean dashboard showing who paid",
  "You want automatic grace periods and late fees",
  "You want tenants to onboard themselves",
  "You want to stop tracking payments in spreadsheets",
  "You want software your staff can understand quickly",
  "You prefer self-serve setup instead of sales calls",
] as const;

const notFit = [
  "You need enterprise accounting or full bookkeeping",
  "You need tenant screening",
  "You need automatic prorated rent calculations",
  "You need lease generation and e-signatures",
  "You need listing syndication and lead management",
  "You need an all-in-one property-management ERP",
  "You manage thousands of units with complex corporate workflows",
] as const;

export default function RightFitPage() {
  return (
    <MarketingPageShell
      eyebrow="Is RentFray right for me?"
      title={<>A focused tool for recurring payment collection.</>}
      intro="RentFray is a strong fit for independent properties that want the monthly payment process to be simple. It is not built to be everything."
    >
      <DetailSection eyebrow="A strong fit" title="RentFray probably makes sense for you if:">
        <div className="rfp-fit-panel"><Checklist items={goodFit} /></div>
      </DetailSection>

      <DetailSection eyebrow="Not the right tool" title="RentFray may not be the right fit if:" dark>
        <div className="rfp-fit-panel"><Checklist items={notFit} negative /></div>
      </DetailSection>

      <DetailSection eyebrow="The point" title="We intentionally do less." text="RentFray’s goal is to streamline month-to-month business needs—not become an all-encompassing, bloated management program.">
        <div className="rfp-important-note">
          <strong>That focus is the product.</strong>
          <p>RentFray concentrates on recurring charges, rent collection, late fees, tenant access, manager visibility, maintenance requests, and payment history.</p>
        </div>
      </DetailSection>
    </MarketingPageShell>
  );
}
