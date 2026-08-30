import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/mobile-home-park-rent-collection";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Mobile Home Park Rent Collection Software | RentFray";

const pageDescription =
  "Collect mobile home park lot rent online, track resident balances and payment status by lot, and manage recurring rent without monthly software fees.";

const faqItems = [
  {
    question: "Can mobile home parks collect lot rent online with RentFray?",
    answer:
      "Yes. RentFray provides a browser-based payment workflow for recurring mobile home park lot rent and other configured resident charges.",
  },
  {
    question: "Can I track mobile home park rent by lot?",
    answer:
      "Yes. RentFray keeps resident payment activity and balances associated with the appropriate rental account so park operators can review what each occupied lot owes.",
  },
  {
    question: "Can RentFray manage recurring monthly lot rent?",
    answer:
      "Yes. RentFray is built around recurring rent obligations so operators can manage the monthly payment cycle across multiple resident accounts.",
  },
  {
    question: "Do mobile home park residents need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so residents can access the payment flow without installing an app.",
  },
  {
    question: "How are mobile home park rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store resident banking information or hold resident funds.",
  },
  {
    question: "Is RentFray free for mobile home park operators?",
    answer:
      "RentFray has no monthly software fee for property owners and managers. Residents pay a small processing fee when they submit payments.",
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
      "Collect mobile home park lot rent online and track recurring resident balances and payment status.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online lot rent collection and payment tracking for mobile home parks.",
  },
};

export default function MobileHomeParksPage() {
  return (
    <>
      <Script
        id="mobile-home-park-rent-collection-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="mobile-home-park-rent-collection-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Mobile Home Park Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Mobile Home Park Rent Collection Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Mobile home parks may collect recurring lot rent from dozens of
            residents at the same time. Each account needs to stay connected to
            the correct lot, payment activity, and remaining balance.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray gives mobile home park owners and managers a focused way to
            collect rent online, track resident balances, and monitor payment
            status without a monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Lot Rent Across the Park
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Park rent collection is easier to manage when each resident
              account stays associated with the correct rental lot.
            </p>

            <p>
              One resident may be paid in full. Another may have a remaining
              balance. Another payment may still be processing. The operator
              needs to be able to distinguish those accounts without
              reconstructing the month from bank deposits or handwritten
              records.
            </p>

            <p>
              RentFray organizes recurring payment activity around individual
              tenant accounts so the park can review rent by resident and lot.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Mobile Home Park Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Lot or Resident Account</h3>
              <p className="mt-2 text-slate-600">
                Keep rent obligations and payment activity connected to the
                appropriate occupied lot.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Lot Rent</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring monthly rent instead of rebuilding each
                resident's obligation every billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payments from activity that is still
                processing or needs attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Outstanding Balance</h3>
              <p className="mt-2 text-slate-600">
                See what each resident still owes after completed payments are
                applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Mobile Home Park Lot Rent Online
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A consistent online payment method gives residents one clear
              place to submit rent instead of requiring the park to reconcile
              several unrelated payment methods.
            </p>

            <p>
              RentFray uses a browser-based resident payment experience. There
              is no app download required before a resident can access the
              payment flow.
            </p>

            <p>
              The resulting payment activity remains part of the rent account,
              giving the operator more context than a standalone transfer.
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
            Recurring Lot Rent Is Different From a One-Time Payment
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Lot rent repeats according to the park's billing schedule. That
              makes resident account history and recurring balances more useful
              than treating every payment as an isolated transaction.
            </p>

            <p>
              RentFray is built around recurring rent obligations so the
              monthly payment cycle remains connected to the resident account.
            </p>

            <p>
              That structure gives park operators a clearer view of what was
              due, what has been paid, and what remains outstanding.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track the Resident Balance, Not Just Whether Money Arrived
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment does not necessarily mean the resident's account is
              fully paid.
            </p>

            <p>
              If lot rent and configured recurring charges total $750 and a
              completed payment covers $600, the account still has a $150
              balance.
            </p>

            <p>
              Keeping that remaining balance visible makes partial payments and
              outstanding rent easier to understand.
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
            Payment Status Helps Park Operators Know What Needs Attention
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A resident who has submitted a payment that is still processing
              is not in the same position as a resident with no payment
              activity.
            </p>

            <p>
              Keeping payment status visible helps managers understand the
              difference before deciding which accounts require follow-up.
            </p>

            <p>
              That becomes increasingly useful as the number of occupied lots
              grows and the park is reviewing many accounts during the same
              billing cycle.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Mobile Home Park Rent Collection vs Manual Tracking
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
                  <td className="px-3 py-3">Collect lot rent</td>
                  <td className="px-3 py-3">
                    Checks, cash, transfers, or other methods
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track each lot</td>
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
            Useful for Owner-Operated and Multi-Lot Parks
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A mobile home park does not need hundreds of lots before
              organized rent collection becomes useful.
            </p>

            <p>
              Smaller owner-operated parks may benefit from replacing manual
              ledgers and scattered payment records. Properties with more lots
              may benefit from having a consistent payment and balance-tracking
              process across more resident accounts.
            </p>

            <p>
              The value comes from keeping recurring rent organized—not from
              reaching a particular property size.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Lot Rent, Home Rent, and Other Recurring Charges
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Mobile home park billing is not identical at every property.
            </p>

            <p>
              Some residents may own their homes and pay only for the lot.
              Other properties may rent park-owned homes. A property may also
              have additional configured recurring charges alongside the base
              rent.
            </p>

            <p>
              RentFray is designed to organize recurring property charges and
              payment balances, but it should not be treated as specialized
              mobile-home-park accounting software for every operational or
              utility-billing requirement.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Mobile Home Park Payment Processing
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
            Mobile Home Park Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for mobile home park owners and
            managers.
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
            Related Park Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/trailer-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Trailer Park Rent Collection
            </Link>

            <Link
              href="/rv-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              RV Park Rent Collection
            </Link>

            <Link
              href="/campground-payment-system"
              className="text-blue-600 hover:underline"
            >
              Campground Payment System
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
            Collect Mobile Home Park Lot Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring lot rent, resident balances, and payment status
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