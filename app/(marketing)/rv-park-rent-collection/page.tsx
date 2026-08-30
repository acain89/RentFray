import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rv-park-rent-collection";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "RV Park Rent Collection Software | RentFray";

const pageDescription =
  "Collect recurring RV space rent online, track resident balances and payment status, and manage long-term park payments without monthly software fees.";

const faqItems = [
  {
    question: "Can RV parks collect recurring space rent online with RentFray?",
    answer:
      "Yes. RentFray can support recurring online rent collection for long-term RV spaces and other configured resident charges.",
  },
  {
    question: "Can I track rent by RV space or resident account?",
    answer:
      "Yes. RentFray keeps recurring payment activity and balances associated with the appropriate tenant and rental account.",
  },
  {
    question: "Is RentFray an RV reservation or campground booking system?",
    answer:
      "No. RentFray is focused on recurring rent collection, balances, and payment status. It is not a reservation engine, nightly booking platform, campsite availability system, or check-in management system.",
  },
  {
    question: "Do RV park residents need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so residents can access the payment flow without installing an app.",
  },
  {
    question: "How are RV park rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store resident banking information or hold resident funds.",
  },
  {
    question: "Does RentFray charge RV park operators a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners and managers. Residents pay a small processing fee when they submit payments.",
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
      "Online recurring rent collection and payment tracking for long-term RV park residents.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Collect and track recurring RV park space rent online.",
  },
};

export default function RVParksPage() {
  return (
    <>
      <Script
        id="rv-park-rent-collection-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rv-park-rent-collection-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            RV Park Rent Collection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            RV Park Rent Collection Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RV parks with long-term or monthly residents need a way to keep
            recurring space rent connected to the correct resident account,
            payment activity, and remaining balance.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online payment system for recurring RV
            space rent without requiring park owners or managers to pay a
            monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Best Fit: Long-Term and Monthly RV Space Rent
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RV parks can operate in very different ways. Some primarily serve
              short-term travelers who book by the night or week. Others have
              long-term residents who occupy spaces for months and pay
              recurring rent.
            </p>

            <p>
              RentFray is most relevant to the second use case: recurring space
              rent that behaves more like a landlord-tenant payment obligation
              than a hospitality reservation.
            </p>

            <p>
              When a resident has a recurring amount due each billing cycle,
              RentFray can help keep that payment activity and balance organized
              in one rent collection workflow.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What RV Park Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Resident or Space Account</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring rent activity associated with the appropriate
                resident and rental account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Space Rent</h3>
              <p className="mt-2 text-slate-600">
                Maintain the amount due according to the park's recurring
                payment setup.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish successful payments from activity that is still
                processing or requires attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                See what each resident still owes after completed payments are
                applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Monthly RV Space Rent Online
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Long-term RV residents can use a browser-based payment path rather
              than relying on checks, cash, or unrelated payment methods.
            </p>

            <p>
              RentFray does not require residents to install an app before they
              access the payment flow.
            </p>

            <p>
              Payment activity remains connected to the rent account, giving
              the park more context than a standalone transfer or deposit.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/collect-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn how online rent collection works →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            RV Space Rent Should Stay Connected to the Resident Account
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Knowing that money arrived does not always answer whether a
              resident's rent account is current.
            </p>

            <p>
              If a resident owes $850 for the current billing cycle and has
              completed a $700 payment, the useful account information includes
              the remaining $150 balance.
            </p>

            <p>
              RentFray keeps payment activity and balances together so operators
              can review the status of the resident account instead of only the
              transaction.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring RV Rent vs Nightly Reservations
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Need</th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                  <th className="px-3 py-3 font-semibold">
                    Reservation Software
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Recurring monthly space rent</td>
                  <td className="px-3 py-3">Designed for this type of workflow</td>
                  <td className="px-3 py-3">May not be the primary focus</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Resident balance tracking</td>
                  <td className="px-3 py-3">Supported in rent workflow</td>
                  <td className="px-3 py-3">Varies by platform</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Nightly campsite bookings</td>
                  <td className="px-3 py-3">Not the purpose of RentFray</td>
                  <td className="px-3 py-3">Core use case</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Availability calendar / check-in</td>
                  <td className="px-3 py-3">Not provided as booking software</td>
                  <td className="px-3 py-3">Common booking function</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Across Long-Term RV Residents
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              During a monthly billing cycle, long-term residents may be in
              different payment states.
            </p>

            <p>
              One may be fully paid. Another may still have a balance. Another
              may have submitted a payment that is still processing.
            </p>

            <p>
              Distinguishing those account positions helps operators decide
              which residents actually require follow-up.
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
            RV Park Rent Collection vs Manual Tracking
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">
                    Rent Collection System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Collect space rent</td>
                  <td className="px-3 py-3">
                    Checks, cash, or separate transfers
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track resident</td>
                  <td className="px-3 py-3">
                    Spreadsheet, ledger, or notes
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to resident account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">
                    Maintained with rent activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Review payment status</td>
                  <td className="px-3 py-3">
                    Check separate payment records
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
            When an RV Park Needs Different Software
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray should not be treated as a complete RV park management
              system.
            </p>

            <p>
              Parks that rely heavily on short-term stays may need software for
              online reservations, site availability, rate management,
              check-in, guest records, campground maps, or other hospitality
              functions.
            </p>

            <p>
              RentFray's role is narrower: recurring rent and configured
              charges, online payment collection, resident balances, and
              payment-status visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure RV Park Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store resident banking information or hold
              resident funds. RentFray organizes the rent collection workflow
              while Stripe provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            RV Park Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for RV park owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Residents pay a small processing fee when they submit payments. The
            park does not take on a monthly RentFray software subscription.
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
            Related Park Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/campground-payment-system"
              className="text-blue-600 hover:underline"
            >
              Campground Payment System
            </Link>

            <Link
              href="/mobile-home-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Mobile Home Park Rent Collection
            </Link>

            <Link
              href="/trailer-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Trailer Park Rent Collection
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/rent-collection-software-landlords"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software for Landlords
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Long-Term RV Space Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring space rent, resident balances, and payment status
            organized without a monthly software fee for park owners or
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