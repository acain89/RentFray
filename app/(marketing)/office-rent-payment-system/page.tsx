import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/office-rent-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Office Rent Payment System for Commercial Tenants | RentFray";

const pageDescription =
  "Collect office rent online, track commercial tenant balances and payment status, and manage recurring rent without monthly software fees.";

const faqItems = [
  {
    question: "Can office tenants pay rent online with RentFray?",
    answer:
      "Yes. RentFray gives office tenants a browser-based way to submit recurring rent payments online.",
  },
  {
    question: "Can I track office rent by tenant or suite?",
    answer:
      "Yes. RentFray keeps rent obligations, payment activity, and balances associated with the appropriate tenant and rental unit.",
  },
  {
    question: "Can RentFray manage recurring office rent?",
    answer:
      "Yes. RentFray is designed around recurring rent obligations and provides owners and managers with payment-status and balance visibility throughout the billing cycle.",
  },
  {
    question: "Is RentFray commercial property management software?",
    answer:
      "RentFray is focused on rent collection, recurring charges, balances, and payment status. It does not replace specialized commercial lease accounting, CAM reconciliation, percentage-rent calculations, lease administration, or full property-management software.",
  },
  {
    question: "How are office rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge office property owners a monthly fee?",
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
      "Collect recurring office rent online and track commercial tenant balances and payment status.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online office rent collection and commercial tenant balance tracking without monthly software fees.",
  },
};

export default function OfficeRentPaymentSystemPage() {
  return (
    <>
      <Script
        id="office-rent-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="office-rent-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Office Rent Collection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Office Rent Payment System for Commercial Tenants
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Collect recurring office rent online while keeping each commercial
            tenant's payment activity, balance, and payment status connected to
            the correct rental account.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray gives office property owners and managers a focused rent
            collection system without adding a monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Office Rent Organized by Tenant and Rental Unit
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              An office property may have one commercial tenant or multiple
              tenants occupying separate suites or rental units.
            </p>

            <p>
              RentFray keeps recurring rent obligations, completed payment
              activity, and balances associated with the appropriate tenant and
              unit.
            </p>

            <p>
              Instead of treating every deposit as an isolated transaction,
              owners and managers can review rent in the context of the account
              that actually owes it.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Consistent Online Payment Path for Office Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Checks, separate bank transfers, and manually recorded payments
              can all move money, but they can also leave the property manager
              responsible for matching each transaction back to the correct
              tenant account.
            </p>

            <p>
              RentFray gives tenants a consistent browser-based payment path
              connected to the property's rent collection workflow.
            </p>

            <p>
              Tenants do not need to download an app before accessing the
              payment experience.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What an Office Rent Payment System Should Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant and Unit</h3>
              <p className="mt-2 text-slate-600">
                Keep rent activity associated with the commercial tenant and
                rental unit responsible for the obligation.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain the recurring rent obligation according to the
                property's configured billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payments from activity that is still
                processing or requires attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balance</h3>
              <p className="mt-2 text-slate-600">
                See what remains owed after completed payment activity is
                applied to the account.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Office Rent Needs More Than a Payment Button
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Office rent is generally an ongoing obligation rather than a
              series of unrelated transactions.
            </p>

            <p>
              A tenant owes rent for a billing cycle, submits payment activity,
              and has an account balance that needs to remain understandable
              afterward.
            </p>

            <p>
              RentFray is structured around that recurring relationship instead
              of functioning as a generic person-to-person money transfer tool.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track the Tenant Balance, Not Just the Transaction
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A transaction record answers one question: did payment activity
              occur?
            </p>

            <p>
              A tenant balance answers another important question: what does
              this account still owe?
            </p>

            <p>
              RentFray keeps payment activity and balances together so office
              property owners and managers can review the account instead of
              relying only on a list of deposits.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about rent and balance tracking →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Adds Important Context
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A submitted payment that is still processing is different from a
              completed payment, and both are different from an account with no
              payment activity.
            </p>

            <p>
              RentFray keeps payment status visible so owners and managers have
              more context when reviewing office tenant accounts.
            </p>

            <p>
              That is particularly useful when several commercial tenants have
              rent due during the same billing cycle.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Office Rent Collection Across Multiple Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              As the number of tenants increases, a payment process based on
              separate checks, transfers, notes, and spreadsheet updates
              requires more reconciliation.
            </p>

            <p>
              A centralized rent collection system gives the property one place
              to review recurring tenant obligations, payment activity, status,
              and balances.
            </p>

            <p>
              The same basic workflow can therefore remain consistent across
              separate office rental accounts.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Office Rent Payment System vs Manual Tracking
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Collect office rent</td>
                  <td className="px-3 py-3">
                    Checks or separate payment methods
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Identify tenant</td>
                  <td className="px-3 py-3">
                    Match transactions manually
                  </td>
                  <td className="px-3 py-3">
                    Payment activity connected to the rental account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">
                    Maintain separate records
                  </td>
                  <td className="px-3 py-3">
                    Balance maintained with account activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Review payment status</td>
                  <td className="px-3 py-3">
                    Check payment records separately
                  </td>
                  <td className="px-3 py-3">
                    Status visible in the rent workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Office Rent Collection vs Commercial Lease Accounting
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Commercial property operations can involve considerably more than
              collecting base rent.
            </p>

            <p>
              Some office leases include common-area maintenance charges,
              expense reconciliations, taxes, insurance allocations, percentage
              rent, complicated escalations, lease abstracts, and specialized
              accounting requirements.
            </p>

            <p>
              RentFray does not claim to replace commercial lease-accounting or
              lease-administration software.
            </p>

            <p>
              Its focus is narrower: recurring rent and configured charges,
              online tenant payments, account balances, and payment-status
              visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When a Focused Office Rent System Makes Sense
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Not every office property needs an enterprise commercial
              property-management suite.
            </p>

            <p>
              An owner or manager may already have workable processes for
              leases, accounting, maintenance, and property operations while
              still needing a better system for recurring rent collection.
            </p>

            <p>
              RentFray addresses that narrower problem without requiring the
              property to replace every other part of its management process.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/commercial-property-rent-collection"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about commercial property rent collection →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Office Rent Payment Processing
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
            Office Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for office property owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments. The
            property does not take on a monthly RentFray software subscription.
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
            Related Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/commercial-property-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Commercial Property Rent Collection
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/rent-billing-system"
              className="text-blue-600 hover:underline"
            >
              Recurring Rent Billing System
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/property-management-payment-system"
              className="text-blue-600 hover:underline"
            >
              Property Management Payment System
            </Link>

            <Link
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Office Rent Online with RentFray
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep commercial tenant rent, balances, and payment status organized
            without a monthly RentFray software fee.
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