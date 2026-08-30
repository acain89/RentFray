import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rent-tracking-software";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Rent Tracking Software for Payments and Balances | RentFray";

const pageDescription =
  "Rent tracking software for landlords and property managers. See tenant balances, track payment status, identify what is paid and unpaid, and keep recurring rent organized.";

const faqItems = [
  {
    question: "What is rent tracking software?",
    answer:
      "Rent tracking software helps landlords and property managers monitor tenant balances, payment status, and recurring rent so they can see what has been paid and what still needs attention.",
  },
  {
    question: "Can RentFray show which tenants have paid?",
    answer:
      "Yes. RentFray gives landlords and property managers payment-status and balance visibility across tenant accounts.",
  },
  {
    question: "Can RentFray track outstanding tenant balances?",
    answer:
      "Yes. Tenant balances are part of the RentFray rent collection workflow, helping managers see what is still owed.",
  },
  {
    question: "Does RentFray also collect rent online?",
    answer:
      "Yes. RentFray combines online rent collection with payment and balance tracking so the payment workflow and the tracking workflow stay connected.",
  },
  {
    question: "Is RentFray free for landlords and property managers?",
    answer:
      "Yes. RentFray has no monthly software fee for property owners or managers. Tenants pay a small processing fee when they submit payments.",
  },
  {
    question: "How are rent payments processed?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
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
      "Track tenant balances and payment status so you can quickly see what is paid, what is unpaid, and what needs attention.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Rent tracking software for tenant balances and payment status.",
  },
};

export default function RentTrackingSoftwarePage() {
  return (
    <>
      <Script
        id="rent-tracking-software-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rent-tracking-software-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Payment Tracking
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Rent Tracking Software to See What’s Paid and What’s Not
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray helps landlords and property managers track tenant
            balances and payment status so they can quickly see what has been
            paid, what is still owed, and which accounts need attention.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Create a Free Account
            </Link>

            <Link
              href="/free-rent-collection-software"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              See RentFray Overview
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Know Who Paid. Know Who Hasn’t.
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Collecting rent is only part of the job. Landlords and property
              managers also need a reliable way to see the current state of
              every tenant account.
            </p>

            <p>
              Without a dedicated tracking system, answering a simple question
              like “Who still owes rent?” can mean checking payment records,
              bank activity, spreadsheets, messages, and handwritten notes.
            </p>

            <p>
              RentFray keeps rent collection and account visibility connected
              so the payment picture is easier to understand without
              reconstructing it manually.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What You Can Track With RentFray
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                See the balance associated with each tenant account so the
                amount still owed remains visible.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Monitor payment status so you can distinguish accounts that
                are paid from those that still need attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Rent</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring rent organized around the tenant and property
                instead of maintaining separate monthly records.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Online Payment Activity</h3>
              <p className="mt-2 text-slate-600">
                Keep payment activity connected to the same rent collection
                system used to manage tenant accounts.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Tracking Rent Separately Creates More Work
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A common manual workflow is to collect rent through one method
              and record it somewhere else. A tenant pays, the landlord
              verifies the payment, and then somebody updates a spreadsheet,
              ledger, or note.
            </p>

            <p>
              That creates two separate jobs: collecting the payment and
              maintaining the record of the payment.
            </p>

            <p>
              It also creates opportunities for the two records to disagree.
              A payment may have occurred while the spreadsheet was never
              updated, or a manual entry may not reflect the current tenant
              balance.
            </p>

            <p>
              RentFray keeps payment collection and rent tracking in the same
              workflow so managers have less information to reconcile
              manually.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Rent by Tenant Instead of by Transaction
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A bank statement or general payment app can show that money
              moved, but a landlord needs to understand the tenant account
              behind that transaction.
            </p>

            <p>
              Rent tracking is more useful when the information is organized
              around the rental relationship: the tenant, the amount owed, the
              payment activity, and the remaining balance.
            </p>

            <p>
              That makes the system useful for managing rent rather than
              simply reviewing a list of transactions.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Gives You More Than Paid or Unpaid
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Online payments are not always instantaneous. A payment can move
              through different stages before its final outcome is known.
            </p>

            <p>
              RentFray keeps payment status visible so landlords and managers
              can understand the current state of a tenant account instead of
              treating every submitted payment as immediately complete.
            </p>

            <p>
              That distinction matters when deciding which accounts actually
              require follow-up.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Tracking Software vs a Spreadsheet
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Spreadsheet</th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Record rent information</td>
                  <td className="px-3 py-3">Manual entry</td>
                  <td className="px-3 py-3">
                    Connected to the rent workflow
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track tenant balances</td>
                  <td className="px-3 py-3">
                    Requires formulas or manual updates
                  </td>
                  <td className="px-3 py-3">Built into the system</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track payment status</td>
                  <td className="px-3 py-3">
                    Must be checked and entered manually
                  </td>
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
            Track Payments Where You Collect Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray does not treat tracking as a separate administrative
              tool. Tenants can submit rent online through the same platform
              landlords and managers use to monitor rent accounts.
            </p>

            <p>
              Keeping collection and tracking together reduces the need to
              copy payment information from one system into another.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/collect-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about collecting rent online →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Useful Across Multiple Units and Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Tracking becomes increasingly important as the number of tenant
              accounts grows. Instead of remembering the status of a few
              payments, managers need a consistent view across the property.
            </p>

            <p>
              RentFray helps organize tenant balances and payment status so
              managers can review rent collection without checking each
              payment method individually.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/property-management-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              See property-management payment tracking →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Online Payments Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to securely process online rent payments.
              RentFray does not store tenant banking information or hold
              tenant funds.
            </p>

            <p>
              RentFray provides the rent collection, tenant-balance, and
              payment-status experience while Stripe handles the underlying
              payment processing.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Tracking Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            There is no monthly software subscription required to use the rent
            collection and tracking platform.
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
            Rent Tracking Software vs Rent Collection Software
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The two categories overlap, but the search intent is different.
              Rent tracking software emphasizes visibility: balances, payment
              status, paid accounts, unpaid accounts, and records.
            </p>

            <p>
              Rent collection software emphasizes the broader process of
              accepting and managing recurring rent payments.
            </p>

            <p>
              RentFray combines both functions, but this page focuses
              specifically on the tracking side of that workflow.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-collection-software-landlords"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore rent collection software for landlords →
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
            Related Rent Tracking Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/how-to-track-tenant-payments"
              className="text-blue-600 hover:underline"
            >
              How to Track Tenant Payments
            </Link>

            <Link
              href="/manual-rent-tracking-vs-software"
              className="text-blue-600 hover:underline"
            >
              Manual Rent Tracking vs Software
            </Link>

            <Link
              href="/spreadsheet-vs-rent-software"
              className="text-blue-600 hover:underline"
            >
              Spreadsheet vs Rent Software
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
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            See What’s Paid and What Still Needs Attention
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Use RentFray to collect rent online while keeping tenant balances
            and payment status visible in the same system.
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