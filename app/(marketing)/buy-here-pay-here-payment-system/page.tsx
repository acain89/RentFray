import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/buy-here-pay-here-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle =
  "Buy Here Pay Here Payment Systems vs Rent Collection Software | RentFray";

const pageDescription =
  "Learn how Buy Here Pay Here payment systems differ from property rent collection software and why vehicle-finance accounts need specialized servicing tools.";

const faqItems = [
  {
    question: "Is RentFray Buy Here Pay Here software?",
    answer:
      "No. RentFray is rent collection software for property owners and managers. It is not designed to manage vehicle financing, installment contracts, loan balances, interest, payoff amounts, repossessions, or other auto-finance operations.",
  },
  {
    question: "What does Buy Here Pay Here software usually manage?",
    answer:
      "Buy Here Pay Here businesses may need specialized tools for installment contracts, payment schedules, principal and interest, payoff calculations, delinquency, customer notices, vehicle records, repossession workflows, accounting, and regulatory requirements.",
  },
  {
    question: "What type of payments is RentFray designed for?",
    answer:
      "RentFray is designed for recurring property rent and configured property-related charges associated with tenant rental accounts.",
  },
  {
    question: "Can tenants pay property rent online with RentFray?",
    answer:
      "Yes. RentFray gives tenants a browser-based payment path for submitting rent payments online.",
  },
  {
    question: "How are RentFray payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge property owners a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners and managers. Tenants pay a small processing fee when they submit payments.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${pageUrl}#webpage`,
  url: pageUrl,
  name: pageTitle,
  description: pageDescription,
  about: {
    "@id": "https://www.rentfray.com/#software",
  },
  publisher: {
    "@id": "https://www.rentfray.com/#organization",
  },
};

export const metadata: Metadata = {
  title: {
    absolute: pageTitle,
  },
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    type: "article",
    url: pagePath,
    siteName: "RentFray",
    title: pageTitle,
    description:
      "Understand the difference between Buy Here Pay Here account servicing and recurring property rent collection.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Buy Here Pay Here finance software and property rent collection software solve different problems.",
  },
};

export default function BuyHerePayHerePaymentSystemPage() {
  return (
    <>
      <Script
        id="buy-here-pay-here-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="buy-here-pay-here-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Payment Software Comparison
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Buy Here Pay Here Payment Systems vs Rent Collection Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Buy Here Pay Here dealerships and property owners may both collect
            recurring payments, but the accounts behind those payments are
            fundamentally different.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray is built for property rent collection. It is not vehicle
            finance, loan-servicing, or Buy Here Pay Here software.
          </p>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Is RentFray a Buy Here Pay Here Payment System?
          </h2>

          <p className="mt-4 text-slate-600">No.</p>

          <p className="mt-3 text-slate-600">
            RentFray manages recurring property-rent obligations, configured
            property charges, tenant payment activity, account balances, and
            payment status.
          </p>

          <p className="mt-3 text-slate-600">
            It does not manage financed vehicles, installment contracts,
            principal, interest, payoff amounts, loan amortization,
            repossessions, credit reporting, or other auto-finance functions.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Vehicle Payments and Property Rent Are Different
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A recurring payment schedule does not make two financial
              relationships equivalent.
            </p>

            <p>
              Property rent generally represents an amount owed by a tenant for
              occupying or using real property during a rental period.
            </p>

            <p>
              A Buy Here Pay Here payment generally relates to a financed vehicle
              purchase and an installment obligation governed by a sales or
              finance contract.
            </p>

            <p>
              The payment software therefore needs to understand the underlying
              obligation—not simply collect money on a recurring schedule.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Buy Here Pay Here Software May Need to Handle
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Installment Contracts</h3>
              <p className="mt-2 text-slate-600">
                Maintain the terms of the customer's vehicle financing
                agreement.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Principal and Interest</h3>
              <p className="mt-2 text-slate-600">
                Track how payments affect financed balances according to the
                contract.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Schedules</h3>
              <p className="mt-2 text-slate-600">
                Manage weekly, biweekly, monthly, or other contractual payment
                schedules.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payoff Amounts</h3>
              <p className="mt-2 text-slate-600">
                Determine what is required to satisfy the finance obligation.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Vehicle Records</h3>
              <p className="mt-2 text-slate-600">
                Associate financed accounts with the correct vehicle and
                transaction records.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Delinquency and Servicing</h3>
              <p className="mt-2 text-slate-600">
                Support account servicing, notices, collection procedures, and
                other workflows appropriate to financed accounts.
              </p>
            </div>
          </div>

          <p className="mt-6 text-slate-600">
            RentFray does not provide these auto-finance or loan-servicing
            functions.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What RentFray Is Designed to Handle
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Property Rent</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring rent obligations associated with tenant
                rental accounts.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Online Tenant Payments</h3>
              <p className="mt-2 text-slate-600">
                Give tenants a browser-based path for submitting rent payments
                online.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                Keep completed payment activity and the amount still owed
                connected to the tenant account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payments from activity that is still
                processing or requires attention.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Buy Here Pay Here Software vs RentFray
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Function</th>
                  <th className="px-3 py-3 font-semibold">
                    BHPH / Auto-Finance Software
                  </th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Property rent collection</td>
                  <td className="px-3 py-3">Not the primary purpose</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant balances</td>
                  <td className="px-3 py-3">Not the primary account type</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Vehicle finance contracts</td>
                  <td className="px-3 py-3">Core function</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Principal and interest</td>
                  <td className="px-3 py-3">May be required</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payoff calculations</td>
                  <td className="px-3 py-3">May be required</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Repossession workflow</td>
                  <td className="px-3 py-3">May be included</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Online payments</td>
                  <td className="px-3 py-3">May be included</td>
                  <td className="px-3 py-3">
                    Yes, within RentFray's property-rent workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Vehicle Finance Can Carry Additional Requirements
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Buy Here Pay Here accounts can involve consumer-finance,
              servicing, disclosure, recordkeeping, collection, and other legal
              or regulatory requirements that do not apply to ordinary property
              rent collection in the same way.
            </p>

            <p>
              Businesses offering vehicle financing should evaluate software
              specifically designed for their financing model and applicable
              requirements.
            </p>

            <p>
              RentFray should not be used as a substitute for specialized
              auto-finance or loan-servicing software.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Choose Software Based on the Obligation Being Collected
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              If a business is financing vehicles and servicing installment
              accounts, it should evaluate software built specifically for Buy
              Here Pay Here or auto-finance operations.
            </p>

            <p>
              If a business owns or manages real property and needs to collect
              recurring rent from tenants, property rent collection software is
              the appropriate category.
            </p>

            <p>
              Keeping those categories separate produces clearer records and
              helps businesses choose software designed for the financial
              relationship they actually manage.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            RentFray Is Built for Property Rent Collection
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray helps property owners and managers organize recurring
              rent obligations, collect tenant payments online, review payment
              status, and track tenant balances.
            </p>

            <p>
              It intentionally does not position itself as a general loan,
              lending, vehicle-finance, or installment-account servicing
              platform.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about RentFray's rent collection software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Property Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. RentFray manages the rent collection workflow while Stripe
              provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Property Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>

          <div className="mt-6 space-y-6">
            {faqItems.map((item) => (
              <div key={item.question}>
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-2 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/free-rent-collection-software"
              className="text-blue-600 hover:underline"
            >
              Free Rent Collection Software
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/commercial-property-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Commercial Property Rent Collection
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Need to Collect Property Rent Online?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            RentFray provides recurring rent collection, tenant balance
            tracking, and payment-status visibility without a monthly software
            fee for property owners and managers.
          </p>

          <Link
            href="/setup"
            className="mt-5 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-100"
          >
            Create a Free Account
          </Link>
        </section>
      </main>
    </>
  );
}