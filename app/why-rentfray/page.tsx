import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import { DetailSection } from "@/components/marketing/MarketingDetails";
import "../marketing-pages.css";

export const metadata: Metadata = {
  title: "Why Switch to RentFray? | Simple Rent Collection",
  description:
    "Compare manual rent collection, traditional property management software, and RentFray—the free, self-service rent collection platform.",
  alternates: {
    canonical: "/why-rentfray",
  },
};

const manualProblems = [
  "Checking multiple payment apps",
  "Depositing paper checks",
  "Updating spreadsheets",
  "Calculating late fees manually",
  "Searching bank activity to identify payments",
  "Trying to remember who still owes money",
] as const;

const traditionalFeatures = [
  "Accounting",
  "Leasing",
  "Applications",
  "Marketing",
  "Maintenance",
  "Vendor management",
  "Owner portals",
  "Document storage",
  "Resident messaging",
  "Reports about reports",
] as const;

const removedFeatures = [
  "No CRM",
  "No marketing suite",
  "No lease designer",
  "No vendor marketplace",
  "No enterprise accounting package",
  "No complicated tenant invitation system",
  "No twenty-seven reports you will never open",
  "No clicking here just to click somewhere else",
] as const;

const comparisonRows = [
  {
    label: "Setup time",
    manual: "None",
    traditional: "Often days or weeks",
    rentfray: "About 10 minutes",
  },
  {
    label: "Sales calls",
    manual: "Never",
    traditional: "Almost always",
    rentfray: "Never",
  },
  {
    label: "Product demo",
    manual: "Never",
    traditional: "Usually required",
    rentfray: "Never",
  },
  {
    label: "Contract",
    manual: "None",
    traditional: "Common",
    rentfray: "Never",
  },
  {
    label: "Complete self-service setup",
    manual: "Not applicable",
    traditional: "Extremely rare",
    rentfray: "Always",
  },
  {
    label: "Monthly manager cost",
    manual: "None",
    traditional: "Usually required",
    rentfray: "Free",
  },
  {
    label: "Online tenant payments",
    manual: "Scattered across apps",
    traditional: "Yes",
    rentfray: "One portal",
  },
  {
    label: "Automatic late fees",
    manual: "No",
    traditional: "Usually",
    rentfray: "Yes",
  },
  {
    label: "Live billing-cycle dashboard",
    manual: "No",
    traditional: "Usually",
    rentfray: "Yes",
  },
  {
    label: "Tenant onboarding",
    manual: "Handled individually",
    traditional: "Usually manager-assisted",
    rentfray: "Tenant self-service",
  },
] as const;

export default function WhyRentFrayPage() {
  return (
    <MarketingPageShell
      eyebrow="Why switch?"
title={
  <>
    There should be
    <br />
    a better way
    <br />
    to collect rent.
  </>
}
      intro="Collecting rent should not require three sales calls, a software demo, a contract, weeks of onboarding, and a monthly bill before you collect your first dollar."
    >
      <section className="rfw-opening">
        <div className="rfm-container">
          <p className="rfw-opening-lead">Yet somehow, that became normal.</p>

          <div className="rfw-opening-statement">
            <span>We do not buy it.</span>
            <h2>Small property managers deserve a third option.</h2>
            <p>
              Not a patchwork of checks, payment apps, bank deposits, and
              spreadsheets. Not an enterprise system built to manage thousands
              of units.
            </p>
            <strong>Something simple. RentFray.</strong>
          </div>
        </div>
      </section>

      <DetailSection
        eyebrow="Your three choices"
        title="Every manager already has a system."
        text="The question is whether that system is making rent collection easier—or simply keeping the same monthly headaches alive."
      >
        <div className="rfw-choice-grid">
          <article className="rfw-choice-card">
            <span className="rfw-choice-number">01</span>
            <p className="rfw-choice-label">Keep doing it manually</p>
            <h3>If it works, keep doing it.</h3>
            <p>
              Seriously. RentFray is not here to convince everyone that they
              need software.
            </p>

            <p>
              But if collecting rent means checking all of these every month,
              there may be an easier way:
            </p>

            <ul>
              {manualProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </article>

          <article className="rfw-choice-card">
            <span className="rfw-choice-number">02</span>
            <p className="rfw-choice-label">
              Buy traditional property software
            </p>
            <h3>Some businesses genuinely need everything.</h3>
            <p>
              Thousands of units. Multiple offices. Accounting departments.
              Leasing teams. Maintenance crews. Complicated reporting.
            </p>

            <div className="rfw-feature-cloud" aria-label="Common features">
              {traditionalFeatures.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>

            <p className="rfw-card-punchline">
              If you manage 82 apartments, you probably do not need software
              capable of launching a space shuttle.
            </p>
          </article>

          <article className="rfw-choice-card is-rentfray">
            <span className="rfw-choice-number">03</span>
            <p className="rfw-choice-label">Use RentFray</p>
            <h3>We asked one question.</h3>

            <blockquote>
              What is the simplest possible way to collect rent?
            </blockquote>

            <p>
              Then we removed everything that did not help answer that
              question.
            </p>

            <div className="rfw-rentfray-steps">
              <span>Create an account</span>
              <span>Set the billing rules</span>
              <span>Connect Stripe</span>
              <span>Give tenants the property code</span>
            </div>

            <strong className="rfw-done">Done.</strong>
          </article>
        </div>
      </DetailSection>

      <section className="rfw-comparison-section">
        <div className="rfm-container">
          <span className="rfp-eyebrow">The honest comparison</span>
          <h2>Different systems. Very different routines.</h2>
          <p className="rfw-comparison-intro">
            No vague symbols. No fine print hidden under the chart. Just the
            practical differences.
          </p>

          <div className="rfw-table-wrap">
            <table className="rfw-table">
              <thead>
                <tr>
                  <th scope="col">What changes</th>
                  <th scope="col">Manual collection</th>
                  <th scope="col">Traditional software</th>
                  <th scope="col" className="is-rentfray">
                    RentFray
                  </th>
                </tr>
              </thead>

              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td data-label="Manual collection">{row.manual}</td>
                    <td data-label="Traditional software">
                      {row.traditional}
                    </td>
                    <td data-label="RentFray" className="is-rentfray">
                      {row.rentfray}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rfw-comparison-note">
            Traditional platforms vary. The comparison reflects the sales,
            setup, pricing, and onboarding process commonly encountered across
            full property-management systems.
          </p>
        </div>
      </section>

      <DetailSection
        eyebrow="Less software"
        title="We removed a lot of features. On purpose."
        text="RentFray is not a stripped-down enterprise platform. It was designed from the beginning around one specific job."
        dark
      >
        <div className="rfw-removed-grid">
          {removedFeatures.map((feature) => (
            <div key={feature}>
              <span aria-hidden="true">—</span>
              <p>{feature}</p>
            </div>
          ))}
        </div>

        <div className="rfw-just-rent">
          <span>Just</span>
          <strong>collect rent.</strong>
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="One property code"
        title="Management does not have to onboard every tenant."
        text="RentFray gives each property one unique code. Give tenants the code and their tier information once. They activate themselves."
      >
        <div className="rfw-code-flow">
          <article>
            <span>1</span>
            <strong>Give tenants the property code.</strong>
            <p>No invitation emails or manager-created tenant accounts.</p>
          </article>

          <div aria-hidden="true">→</div>

          <article>
            <span>2</span>
            <strong>Tenants activate themselves.</strong>
            <p>They select their tier and unit, then create a private PIN.</p>
          </article>

          <div aria-hidden="true">→</div>

          <article>
            <span>3</span>
            <strong>Rent collection is organized.</strong>
            <p>Payments, balances, status, and late fees live in one system.</p>
          </article>
        </div>
      </DetailSection>

      <section className="rfw-not-for-everyone">
        <div className="rfm-container">
          <span className="rfp-eyebrow">No pretending</span>
          <h2>RentFray is not for everyone.</h2>
          <p className="rfw-not-subtitle">And that is completely fine.</p>

          <div className="rfw-fit-columns">
            <article>
              <span>RentFray may not be the right choice if you need:</span>
              <ul>
                <li>Enterprise accounting</li>
                <li>Complex leasing workflows</li>
                <li>Marketing and applicant screening</li>
                <li>Vendor and maintenance management</li>
                <li>Large-office collaboration tools</li>
                <li>Hundreds of interconnected features</li>
              </ul>
            </article>

            <article className="is-rentfray">
              <span>RentFray was built for managers who want to:</span>
              <ul>
                <li>Collect tenant payments online</li>
                <li>Stop checking multiple payment sources</li>
                <li>Apply billing rules consistently</li>
                <li>Never overlook another late fee</li>
                <li>See who paid in seconds</li>
                <li>Avoid another monthly software bill</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="rfw-final-word">
        <div className="rfm-container">
          <p>RentFray is not trying to be everything.</p>
          <h2>It is trying to be the simplest way to collect rent.</h2>

          <div className="rfw-final-actions">
            <Link href="/setup" className="rfw-primary-link">
              Create Free Account
            </Link>

            <Link href="/how-it-works" className="rfw-secondary-link">
              See How It Works
            </Link>
          </div>

          <span className="rfw-final-note">
            No contract. No sales call. No commitment.
          </span>
        </div>
      </section>
    </MarketingPageShell>
  );
}