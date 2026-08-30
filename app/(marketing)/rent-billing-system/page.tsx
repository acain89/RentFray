import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rent-billing-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Rent Billing System for Recurring Monthly Rent | RentFray";

const pageDescription =
  "A rent billing system for recurring monthly rent. Organize tenant amounts due, balances, payment status, and online rent collection without monthly software fees.";

const faqItems = [
  {
    question: "What is a rent billing system?",
    answer:
      "A rent billing system helps landlords and property managers organize recurring rent amounts, tenant balances, payment activity, and the monthly collection cycle.",
  },
  {
    question: "Does RentFray support recurring rent billing?",
    answer:
      "Yes. RentFray is built around recurring rent obligations so owners and managers can keep monthly rent and tenant balances organized.",
  },
  {
    question: "Can tenants pay their rent online?",
    answer:
      "Yes. Tenants can access RentFray through a web browser and submit rent payments online.",
  },
  {
    question: "Can landlords see outstanding balances?",
    answer:
      "Yes. RentFray keeps tenant balances and payment status visible so owners and managers can see what is still owed.",
  },
  {
    question: "How are rent payments processed?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners or managers. Tenants pay a small processing fee when they submit payments.",
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
    type: "website",
    url: pagePath,
    siteName: "RentFray",
    title: pageTitle,
    description:
      "Organize recurring rent amounts, tenant balances, payment status, and online collection in one focused billing workflow.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Recurring rent billing, balances, payment status, and online collection.",
  },
};

export default function RentBillingSystemPage() {
  return (
    <>
      <Script
        id="rent-billing-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rent-billing-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recurring Rent Billing
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Rent Billing System for Recurring Monthly Rent
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray helps landlords and property managers organize recurring
            rent, tenant balances, payment status, and online collection in one
            focused monthly billing workflow.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Create a Free Account
            </Link>

            <Link
              href="/rent-tracking-software"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              See Rent Tracking
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Is a Rent Billing System?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rent billing system organizes the recurring amount a tenant
              owes and connects that obligation to the payment activity that
              follows.
            </p>

            <p>
              For a landlord or property manager, billing is not just about
              accepting money. It is also about knowing what amount is due,
              whether it has been paid, what balance remains, and which tenant
              accounts still require attention.
            </p>

            <p>
              RentFray keeps those pieces connected so recurring rent does not
              have to be managed through separate spreadsheets, payment apps,
              and manual records.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            The Monthly Rent Billing Cycle
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">1. Rent Becomes Due</h3>
              <p className="mt-2 text-slate-600">
                The tenant account carries the recurring rent obligation for
                the applicable billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                2. The Amount Owed Is Visible
              </h3>
              <p className="mt-2 text-slate-600">
                The tenant balance reflects the rent that needs to be paid,
                giving both the payment workflow and the account record a
                clear starting point.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">3. The Tenant Pays Online</h3>
              <p className="mt-2 text-slate-600">
                The tenant accesses RentFray through a browser and submits the
                rent payment online.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">4. Stripe Processes the Payment</h3>
              <p className="mt-2 text-slate-600">
                Stripe securely handles the underlying payment processing.
                RentFray does not store tenant banking information or hold
                tenant funds.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                5. Payment Status and Balance Stay Visible
              </h3>
              <p className="mt-2 text-slate-600">
                Owners and managers can monitor payment status and the tenant
                balance instead of rebuilding the month's billing record by
                hand.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Billing Starts With the Amount Due
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment system starts when someone submits money. A billing
              system starts earlier, with the amount the tenant is expected to
              pay.
            </p>

            <p>
              That distinction matters because landlords and property managers
              need to manage the obligation even before the payment occurs.
              The tenant account needs a clear amount due and a balance that
              can be followed through the collection process.
            </p>

            <p>
              RentFray is designed around that recurring rent relationship
              rather than treating every payment as an isolated transaction.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Tenant Balances Are Part of the Billing Workflow
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Knowing that a payment occurred does not always answer the most
              important billing question: does the tenant still owe anything?
            </p>

            <p>
              RentFray keeps tenant balances visible so owners and managers can
              see the account after payment activity is considered.
            </p>

            <p>
              That makes balance tracking part of rent billing rather than a
              separate spreadsheet calculation.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about tenant balance tracking →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Matters During the Billing Cycle
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A submitted online payment is not necessarily the same thing as
              a completed payment. Payment processing can have an intermediate
              status before the final result is known.
            </p>

            <p>
              RentFray keeps payment status visible so management has better
              context when reviewing a tenant account.
            </p>

            <p>
              That helps distinguish between an account that has no payment
              activity and one where a payment is already moving through the
              process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Billing Without Rebuilding the Month by Hand
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Manual rent billing often means repeating the same work every
              month: identify what each tenant owes, collect payments through
              one or more methods, verify deposits, and update a separate
              tracking record.
            </p>

            <p>
              That workflow becomes increasingly difficult as the number of
              tenants grows because the billing record and the payment record
              can drift apart.
            </p>

            <p>
              RentFray keeps recurring rent, balances, and payment activity in
              the same system so less of the monthly billing picture has to be
              reconstructed manually.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Billing System vs Spreadsheet
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Billing Task</th>
                  <th className="px-3 py-3 font-semibold">Spreadsheet</th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track recurring rent</td>
                  <td className="px-3 py-3">Manual setup and updates</td>
                  <td className="px-3 py-3">
                    Part of the rent workflow
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track tenant balance</td>
                  <td className="px-3 py-3">
                    Manual formulas or entries
                  </td>
                  <td className="px-3 py-3">Built into the account</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track payment status</td>
                  <td className="px-3 py-3">Manual verification</td>
                  <td className="px-3 py-3">
                    Connected to payment activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Collect rent online</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <Link
              href="/spreadsheet-vs-rent-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare spreadsheets and rent software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Billing and Collection Work Better Together
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Billing software is more useful when it is connected to the
              actual payment process. Otherwise, management still has to move
              information between the billing record and the system where the
              tenant paid.
            </p>

            <p>
              RentFray combines the recurring rent workflow with online
              collection so the amount due, payment activity, and resulting
              balance are part of the same system.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/collect-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about online rent collection →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Works Across Multiple Tenants and Units
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Recurring billing becomes more valuable as a rental operation
              grows. Each additional tenant creates another monthly rent
              obligation, balance, payment, and account status to manage.
            </p>

            <p>
              RentFray gives property managers a consistent billing and
              collection workflow across tenant accounts rather than requiring
              each unit to be tracked independently through manual records.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/property-management-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the property-management workflow →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Online Payment Processing Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to securely process online rent payments.
              RentFray does not store tenant banking information or hold
              tenant funds.
            </p>

            <p>
              Stripe handles the underlying payment processing while RentFray
              manages the recurring rent, tenant account, balance, and
              payment-status workflow around it.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            $0 Monthly Software Fee for Owners and Managers
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            There is no monthly software subscription required to use the
            recurring rent billing and collection platform.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn more about RentFray pricing →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Billing System vs Rental Payment Platform
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rent billing system focuses on the recurring financial
              obligation: the amount due, the billing cycle, tenant balances,
              payment activity, and the status of those accounts.
            </p>

            <p>
              A rental payment platform describes the broader environment that
              connects tenants, owners or managers, payment processing, and
              recurring rental transactions.
            </p>

            <p>
              RentFray supports both, but this page focuses specifically on
              the billing side of the rent collection workflow.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rental-payment-platform"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore the rental payment platform →
            </Link>
          </div>
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
            Related Rent Billing Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/rental-payment-platform"
              className="text-blue-600 hover:underline"
            >
              Rental Payment Platform
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
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/free-rent-collection-software"
              className="text-blue-600 hover:underline"
            >
              Free Rent Collection Software
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Monthly Rent Billing and Collection Connected
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Use RentFray to manage recurring rent, tenant balances, payment
            status, and online collection in one focused workflow.
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