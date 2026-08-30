import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/spreadsheet-vs-rent-software";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Spreadsheet vs Rent Software | RentFray";

const pageDescription =
  "Compare spreadsheets with rent software for tracking tenant balances, payment status, recurring rent, payment history, and online collection.";

const faqItems = [
  {
    question: "Can I use a spreadsheet to track rent?",
    answer:
      "Yes. A spreadsheet can work well for a small rental operation if payment information, balances, and monthly records are updated consistently.",
  },
  {
    question: "What is the biggest limitation of using a spreadsheet for rent?",
    answer:
      "A spreadsheet does not know when a tenant pays. Someone still has to verify the payment, enter it, update the balance, and keep the sheet synchronized with the actual payment activity.",
  },
  {
    question: "What does rent software do that a spreadsheet cannot?",
    answer:
      "Dedicated rent software can connect tenant accounts, recurring rent, online payment activity, payment status, and balances in the same workflow.",
  },
  {
    question: "When should I stop using a spreadsheet for rent tracking?",
    answer:
      "Consider switching when manual entry, reconciliation, balance calculations, or checking multiple payment sources starts taking enough time that keeping the spreadsheet accurate becomes difficult.",
  },
  {
    question: "Is rent software only for large landlords?",
    answer:
      "No. Small landlords can also benefit from focused rent software, especially when they personally handle payment collection and tracking.",
  },
  {
    question: "How much does RentFray cost landlords?",
    answer:
      "RentFray has no monthly software fee for property owners and managers. Tenants pay a small processing fee when they submit payments.",
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
      "A practical comparison of spreadsheets and dedicated rent software for landlords and property managers.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Compare spreadsheets with rent software for tracking rent and tenant balances.",
  },
};

export default function SpreadsheetVsRentSoftwarePage() {
  return (
    <>
      <Script
        id="spreadsheet-vs-rent-software-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="spreadsheet-vs-rent-software-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Tracking Comparison
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Spreadsheet vs Rent Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            A spreadsheet can be an effective way to track rent when the
            number of tenants is small and the records are easy to maintain.
            Dedicated rent software becomes more useful when payment activity,
            balances, and recurring rent require too much manual updating.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            The main difference is not whether the records are digital. It is
            whether the payment and tracking workflow is connected or still
            depends on manual entry.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What a Rent Spreadsheet Does Well
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Spreadsheets are flexible. You can create columns for tenant
              names, units, rent amounts, due dates, payment dates, balances,
              and notes without learning a new system.
            </p>

            <p>
              For a landlord managing only a few tenants, that may be all that
              is necessary.
            </p>

            <p>
              A spreadsheet is also easy to customize. You decide exactly what
              gets tracked and how the information is organized.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Low Cost</h3>
              <p className="mt-2 text-slate-600">
                You may already have access to spreadsheet software, making the
                direct cost very low or zero.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Flexible Layout</h3>
              <p className="mt-2 text-slate-600">
                Columns, formulas, notes, and categories can be customized to
                fit your own tracking method.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Easy to Start</h3>
              <p className="mt-2 text-slate-600">
                A simple rent spreadsheet can be created quickly without a
                property setup process.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Familiar</h3>
              <p className="mt-2 text-slate-600">
                Many landlords already know how to use spreadsheets and do not
                need additional training.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Where a Spreadsheet Has Limitations
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A spreadsheet stores the information you enter, but it does not
              know what happened outside the spreadsheet.
            </p>

            <p>
              If a tenant pays by check, bank transfer, or another payment
              method, someone still has to verify that payment and update the
              record.
            </p>

            <p>
              That means the spreadsheet can only be as current as the last
              manual update.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Manual Payment Entry</h3>
              <p className="mt-2 text-slate-600">
                Payments generally need to be entered or confirmed by hand.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Manual Balance Updates</h3>
              <p className="mt-2 text-slate-600">
                Tenant balances depend on formulas or manual calculations that
                must remain accurate.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Separate Payment Source</h3>
              <p className="mt-2 text-slate-600">
                The spreadsheet itself does not collect rent, so payment
                activity must be reconciled from somewhere else.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Limited Payment Status Context</h3>
              <p className="mt-2 text-slate-600">
                A spreadsheet does not automatically know whether an online
                payment is processing, completed, or unsuccessful.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Spreadsheet vs Rent Software: Side by Side
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Feature</th>
                  <th className="px-3 py-3 font-semibold">Spreadsheet</th>
                  <th className="px-3 py-3 font-semibold">Rent Software</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant records</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Recurring rent records</td>
                  <td className="px-3 py-3">
                    Created and maintained manually
                  </td>
                  <td className="px-3 py-3">
                    Can be part of the tenant account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant balances</td>
                  <td className="px-3 py-3">
                    Formula or manual calculation
                  </td>
                  <td className="px-3 py-3">
                    Maintained within the rent workflow
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Online payment collection</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">
                    Available with payment-enabled software
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment status</td>
                  <td className="px-3 py-3">
                    Entered or verified manually
                  </td>
                  <td className="px-3 py-3">
                    Can be connected to payment activity
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment reconciliation</td>
                  <td className="px-3 py-3">Manual</td>
                  <td className="px-3 py-3">
                    Reduced when collection and tracking are connected
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Software subscription</td>
                  <td className="px-3 py-3">
                    Often free or already available
                  </td>
                  <td className="px-3 py-3">
                    Varies; RentFray is $0/month for owners and managers
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            The Biggest Difference Is Where the Payment Data Comes From
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              In a spreadsheet system, the landlord usually brings the payment
              information into the spreadsheet.
            </p>

            <p>
              That may mean checking a bank account, confirming a transfer,
              recording a check, or looking at another payment application and
              then updating the tenant's record.
            </p>

            <p>
              Rent software can reduce that gap when the same system is used
              for both payment collection and account tracking.
            </p>

            <p>
              Instead of copying payment information into the tracking record,
              the payment activity can already be associated with the tenant
              account.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Tenant Balances Are Easier to Use When They Stay Current
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A spreadsheet can calculate tenant balances very well, but only
              when the underlying entries are current.
            </p>

            <p>
              If a $1,000 rent charge is recorded and the tenant pays $700, the
              spreadsheet needs that payment entered before the $300 remaining
              balance is accurate.
            </p>

            <p>
              Dedicated rent tracking software can keep the balance connected
              to the same payment activity used for collection.
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
            When a Spreadsheet Is Probably Enough
          </h2>

          <p className="mt-4 text-slate-600">
            A spreadsheet may continue to be the better choice when:
          </p>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• You manage only a few tenant accounts.</li>
            <li>• Payment activity is simple and predictable.</li>
            <li>• You are comfortable maintaining the records manually.</li>
            <li>• Updating balances takes very little time.</li>
            <li>• You rarely need to reconcile multiple payment sources.</li>
            <li>• The spreadsheet remains easy to review and trust.</li>
          </ul>

          <p className="mt-5 text-slate-600">
            If the spreadsheet is doing the job without creating significant
            administrative work, there may be no urgent reason to replace it.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When Rent Software Starts Making More Sense
          </h2>

          <p className="mt-4 text-slate-600">
            Dedicated software becomes more useful when:
          </p>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• You are tracking more tenants or units.</li>
            <li>• Payments arrive through several different sources.</li>
            <li>• You spend time manually matching payments to tenants.</li>
            <li>• Outstanding balances require repeated calculation.</li>
            <li>• You need clearer visibility into payment status.</li>
            <li>
              • You want online payment collection and tracking in the same
              system.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Software Does Not Have to Replace Every Spreadsheet You Use
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A landlord can still use spreadsheets for forecasting,
              budgeting, custom analysis, or other records even after moving
              rent collection and payment tracking into dedicated software.
            </p>

            <p>
              The choice is not necessarily spreadsheet or software for every
              part of the business.
            </p>

            <p>
              The question is whether a spreadsheet should remain the primary
              system for recurring rent obligations, payments, and tenant
              balances.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Spreadsheet vs Manual Rent Tracking
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              These ideas overlap, but they are not exactly the same.
            </p>

            <p>
              A spreadsheet is one specific manual tracking tool. Manual rent
              tracking can also include notebooks, bank records, payment apps,
              texts, receipts, and other systems used together.
            </p>

            <p>
              If your question is broader than spreadsheets and you want to
              compare an entire manual workflow against software, see the
              manual rent tracking comparison.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/manual-rent-tracking-vs-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare manual rent tracking with software →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            A Focused Alternative to Spreadsheet Rent Tracking
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray combines recurring rent, tenant balances, payment status,
            and online rent collection so those records do not have to be
            maintained separately in a spreadsheet.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore RentFray rent tracking software →
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
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/manual-rent-tracking-vs-software"
              className="text-blue-600 hover:underline"
            >
              Manual Rent Tracking vs Software
            </Link>

            <Link
              href="/how-to-track-tenant-payments"
              className="text-blue-600 hover:underline"
            >
              How to Track Tenant Payments
            </Link>

            <Link
              href="/rent-billing-system"
              className="text-blue-600 hover:underline"
            >
              Rent Billing System
            </Link>

            <Link
              href="/rent-collection-software-alternative"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software Alternative
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Ready to Replace Spreadsheet Rent Tracking?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring rent, tenant balances, payment status, and online
            collection together without a monthly software fee for owners or
            managers.
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