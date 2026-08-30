import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/trailer-park-rent-collection";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Trailer Park Rent Collection Software | RentFray";

const pageDescription =
  "Collect trailer park lot rent online, track resident balances and payment status, and manage recurring monthly payments without monthly software fees.";

const faqItems = [
  {
    question: "What is trailer park rent collection software?",
    answer:
      "Trailer park rent collection software helps park owners and managers organize recurring resident payments, balances, and payment status across individual rental accounts.",
  },
  {
    question: "Can residents pay trailer park rent online with RentFray?",
    answer:
      "Yes. RentFray provides a browser-based payment flow for recurring rent and other configured resident charges.",
  },
  {
    question: "Can I track which trailer park residents still owe rent?",
    answer:
      "Yes. RentFray keeps payment activity and balances tied to the appropriate resident account so operators can see what has been paid and what remains due.",
  },
  {
    question: "Is trailer park rent the same as mobile home park lot rent?",
    answer:
      "The terms are often used for the same type of property. Many communities collect recurring lot rent from residents who own their homes, while others may also rent park-owned homes or assess additional recurring charges.",
  },
  {
    question: "How are trailer park rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store resident banking information or hold resident funds.",
  },
  {
    question: "Does RentFray charge trailer park owners a monthly software fee?",
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
      "Online recurring rent collection and payment tracking for trailer parks and mobile home communities.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Collect and track recurring trailer park rent online.",
  },
};

export default function TrailerParkRentCollectionPage() {
  return (
    <>
      <Script
        id="trailer-park-rent-collection-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="trailer-park-rent-collection-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Trailer Park Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Trailer Park Rent Collection Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Trailer park owners and managers often collect recurring rent from
            multiple residents or lots during the same monthly billing cycle.
            Keeping each resident account separate is what makes that payment
            activity useful.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online rent collection system for
            tracking recurring payments, resident balances, and payment status
            without a monthly software fee for the park.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Trailer Park Rent Collection and Mobile Home Park Rent Collection
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              "Trailer park" is still a common search term, although many
              properties today are described as mobile home parks or
              manufactured housing communities.
            </p>

            <p>
              In either case, the underlying payment problem may be similar:
              recurring rent must be connected to the correct resident or lot,
              completed payments must be recorded, and remaining balances need
              to stay visible.
            </p>

            <p>
              RentFray focuses on that recurring payment workflow rather than
              the terminology used to describe the property.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/mobile-home-park-rent-collection"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the mobile home park rent collection page →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Resident Rent Accounts Separate
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A park may receive many payments during the same period, but those
              payments only become useful records when they stay connected to
              the correct resident account.
            </p>

            <p>
              RentFray keeps recurring rent activity organized by tenant and
              rental account so the operator can review what was due, what was
              paid, and what remains outstanding.
            </p>

            <p>
              That is more informative than relying only on a bank balance,
              payment receipt, or spreadsheet entry that has to be reconciled
              manually.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What a Trailer Park Rent Ledger Needs to Show
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Resident Account</h3>
              <p className="mt-2 text-slate-600">
                Keep payment records tied to the appropriate resident or rental
                space.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Monthly Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring rent and configured charges according to the
                park's billing setup.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payment activity from transactions that
                are still processing or need attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                See what the resident still owes after completed payments are
                applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Move Beyond a Paid-or-Unpaid List
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A simple paid-or-unpaid list can miss important account details.
            </p>

            <p>
              A resident may have made a partial payment. A payment may still be
              processing. Additional configured charges may also affect the
              account balance.
            </p>

            <p>
              Tracking the amount due, completed payments, current payment
              status, and remaining balance gives the operator a clearer view of
              what each account actually looks like.
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
            Give Residents a Browser-Based Way to Pay
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray gives residents an online payment path without requiring
              them to download an app first.
            </p>

            <p>
              Using one recurring payment workflow can also reduce the number of
              separate payment sources the park has to check and reconcile each
              month.
            </p>

            <p>
              The payment activity remains connected to the resident's rent
              account so the park can review both the transaction and the
              resulting balance.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Lot Rent and Home Rent
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Not every trailer park uses the same rental arrangement.
            </p>

            <p>
              Some residents own the manufactured home and rent the lot beneath
              it. Other properties may own and rent the home itself. A park may
              also have recurring charges in addition to the base rent.
            </p>

            <p>
              RentFray can organize recurring property charges that fit its rent
              collection workflow, but it is not intended to replace every
              specialized manufactured-housing accounting or utility-billing
              system.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Trailer Park Rent Collection vs a Spreadsheet
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Spreadsheet</th>
                  <th className="px-3 py-3 font-semibold">
                    Rent Collection System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Collect payment</td>
                  <td className="px-3 py-3">
                    Happens outside the spreadsheet
                  </td>
                  <td className="px-3 py-3">
                    Online payment workflow included
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Update resident record</td>
                  <td className="px-3 py-3">
                    Entered manually
                  </td>
                  <td className="px-3 py-3">
                    Payment tied to account activity
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Calculate balance</td>
                  <td className="px-3 py-3">
                    Formula or manual update
                  </td>
                  <td className="px-3 py-3">
                    Balance maintained with rent activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Check payment status</td>
                  <td className="px-3 py-3">
                    Requires outside payment records
                  </td>
                  <td className="px-3 py-3">
                    Status visible in the rent workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <Link
              href="/spreadsheet-vs-rent-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare spreadsheets with rent software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Consistent Process Across the Park
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The number of occupied lots can change, but the underlying rent
              collection process stays similar.
            </p>

            <p>
              Each account has an amount due, payment activity, a payment
              status, and a balance. Using the same workflow across those
              accounts makes the park easier to review as occupancy changes.
            </p>

            <p>
              A smaller park may use the system to replace a handwritten ledger
              or spreadsheet. A larger park may value having the same process
              repeated across more resident accounts.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Trailer Park Rent Payment Processing
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
            Trailer Park Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for park owners and managers.
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
              href="/mobile-home-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Mobile Home Park Rent Collection
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
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
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
            Collect Trailer Park Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring resident payments, balances, and payment status
            organized without a monthly software fee for owners or managers.
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