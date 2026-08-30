import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/duplex-landlord-rent-collection";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Duplex Rent Collection for Landlords | RentFray";

const pageDescription =
  "Online rent collection for duplex landlords. Collect rent from both units, track tenant balances and payment status, and manage recurring rent without monthly software fees.";

const faqItems = [
  {
    question: "How can a duplex landlord collect rent online?",
    answer:
      "A duplex landlord can use an online rent collection system that gives both tenants a consistent payment path while keeping each unit's rent, payments, and balance separate.",
  },
  {
    question: "Is rent collection software useful for only two units?",
    answer:
      "It can be. A duplex may only have two units, but landlords can still benefit from organized payment records, recurring rent, tenant balances, and a consistent online payment process.",
  },
  {
    question: "Can I track each duplex unit separately?",
    answer:
      "Yes. RentFray keeps rent obligations and payment activity associated with the appropriate tenant and unit.",
  },
  {
    question: "Do duplex tenants need to download an app?",
    answer:
      "No. RentFray uses a browser-based tenant payment experience, so tenants do not need to install an app.",
  },
  {
    question: "How are duplex rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge duplex landlords a monthly fee?",
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
      "Collect rent from both duplex units online and keep tenant balances and payment status organized.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online rent collection and payment tracking for duplex landlords.",
  },
};

export default function DuplexLandlordRentCollectionPage() {
  return (
    <>
      <Script
        id="duplex-rent-collection-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="duplex-rent-collection-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Duplex Rent Collection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Duplex Rent Collection for Landlords
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            A duplex only has two units, but that still means two recurring rent
            obligations, two tenant accounts, and two payment histories to keep
            organized every month.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray gives duplex landlords a focused online system for
            collecting rent, tracking tenant balances, and monitoring payment
            status without requiring a monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Both Duplex Units Separate and Organized
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The biggest advantage of organized duplex rent collection is not
              managing a huge number of tenants. It is keeping the two tenant
              accounts accurate without unnecessary manual work.
            </p>

            <p>
              Each unit can have its own rent obligation, tenant payment
              activity, and remaining balance. That makes it easier to see the
              status of each side of the duplex without mixing payment records
              together.
            </p>

            <p>
              Instead of treating rent as a collection of unrelated deposits,
              the payment activity stays connected to the appropriate rental
              account.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What a Duplex Landlord Needs to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Rent Due for Each Unit</h3>
              <p className="mt-2 text-slate-600">
                Keep each tenant's recurring rent obligation associated with
                the correct side of the duplex.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Activity</h3>
              <p className="mt-2 text-slate-600">
                See payment activity without relying only on bank deposits,
                texts, or handwritten records.
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
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                Know what each tenant still owes after completed payments are
                applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Use Rent Collection Software for Only Two Units?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A duplex landlord can absolutely collect rent manually. Checks,
              bank transfers, payment apps, and spreadsheets may be sufficient
              when the process is working well.
            </p>

            <p>
              The reason to use dedicated rent collection software is not
              because two units are inherently difficult to manage. It is
              because software can connect the payment process with the rent
              records.
            </p>

            <p>
              If one tenant pays in full while the other still owes part of the
              month's rent, a dedicated system can make those two account
              positions easier to see without manually reconciling separate
              records.
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

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Give Both Tenants the Same Online Payment Process
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A consistent payment process means both duplex tenants know where
              to go when rent is due.
            </p>

            <p>
              RentFray provides a browser-based tenant experience, so tenants
              can access the payment flow without downloading an app.
            </p>

            <p>
              Keeping both units on the same rent collection workflow also
              reduces the need to reconcile completely different payment
              methods each month.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Duplex Rent by Balance, Not Just Payment
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Knowing that a tenant made a payment is only part of the account
              picture.
            </p>

            <p>
              If monthly rent is $1,200 and the tenant has completed a $900
              payment, the important number is the remaining $300 balance.
            </p>

            <p>
              Tracking the balance makes partial payments and outstanding rent
              easier to understand than a simple paid-or-unpaid note.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about rent tracking software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Rent for a Duplex
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Rent is not a one-time transaction. The same obligation returns
              according to the property's rent schedule.
            </p>

            <p>
              RentFray is built around recurring rent so landlords can manage
              the monthly cycle without treating every month's rent as an
              unrelated payment request.
            </p>

            <p>
              That recurring structure is useful even for a two-unit property
              because it preserves the relationship between the tenant, the
              amount due, payment activity, and remaining balance.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Duplex Rent Collection: Manual vs Online
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">
                    Online Rent System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Collect rent</td>
                  <td className="px-3 py-3">
                    Checks, cash, transfers, or payment apps
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track each unit</td>
                  <td className="px-3 py-3">
                    Spreadsheet, notes, or separate records
                  </td>
                  <td className="px-3 py-3">
                    Tenant and unit records kept together
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">
                    Maintained with the rent account
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Review payment status</td>
                  <td className="px-3 py-3">
                    Check individual payment sources
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
            Do Duplex Landlords Need Full Property Management Software?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Some duplex landlords may need broader property-management tools
              for accounting, maintenance, leasing, screening, documents, or
              other operational tasks.
            </p>

            <p>
              Others may only need a focused way to collect recurring rent and
              keep tenant balances organized.
            </p>

            <p>
              RentFray is designed for that narrower job. It does not require a
              landlord to adopt a large property-management suite just to
              organize rent collection.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-collection-software-alternative"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare rent collection software alternatives →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Online Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Duplex rent payments through RentFray are processed by Stripe.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. RentFray organizes the rent collection workflow while
              Stripe provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Duplex Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for duplex landlords and property
            managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments. The
            landlord does not take on a monthly RentFray software subscription.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore free rent collection software →
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
            Related Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/rent-collection-software-landlords"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software for Landlords
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/best-way-to-collect-rent"
              className="text-blue-600 hover:underline"
            >
              Best Way to Collect Rent
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/online-rent-payment-system-apartments"
              className="text-blue-600 hover:underline"
            >
              Apartment Rent Payment System
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
            Collect Rent From Both Duplex Units Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring rent, tenant balances, and payment status organized
            for both units without a monthly software fee.
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