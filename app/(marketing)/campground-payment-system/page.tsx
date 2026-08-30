import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/campground-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Campground Payment System for Recurring Payments | RentFray";

const pageDescription =
  "Collect recurring campground payments online for long-term or seasonal occupants, track balances and payment status, and avoid monthly software fees.";

const faqItems = [
  {
    question: "Can campgrounds collect recurring payments online with RentFray?",
    answer:
      "Yes. RentFray can support recurring online payments for long-term or seasonal campground occupants when the payment arrangement fits a recurring property-payment workflow.",
  },
  {
    question: "Is RentFray a campground reservation system?",
    answer:
      "No. RentFray is not a booking engine, campsite reservation system, availability calendar, or guest check-in platform. Its focus is recurring payment collection, balances, and payment status.",
  },
  {
    question: "Can I track recurring campground payments by occupant or space?",
    answer:
      "RentFray keeps payment activity and balances associated with the appropriate tenant or rental account so operators can review what has been paid and what remains due.",
  },
  {
    question: "Do campground occupants need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so occupants can access the payment flow without installing an app.",
  },
  {
    question: "How are campground payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store occupant banking information or hold occupant funds.",
  },
  {
    question: "Does RentFray charge campground owners a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners and managers. Occupants pay a small processing fee when they submit payments.",
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
      "Online recurring payment collection for long-term and seasonal campground occupants.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Collect recurring campground payments online and track balances and payment status.",
  },
};

export default function CampgroundPaymentSystemPage() {
  return (
    <>
      <Script
        id="campground-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="campground-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Campground Recurring Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Campground Payment System for Recurring Payments
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Campgrounds with long-term or seasonal occupants may collect the
            same space payment month after month rather than processing only
            short-term reservations.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online system for recurring campground
            payments, balances, and payment status without requiring owners or
            managers to pay a monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Best Fit: Long-Term and Seasonal Campground Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A campground that operates primarily through nightly or weekly
              reservations has different software needs from a property with
              long-term or seasonal occupants.
            </p>

            <p>
              RentFray is most relevant when an occupant has a recurring amount
              due for the same rental space across multiple billing cycles.
            </p>

            <p>
              In that situation, payment collection begins to look more like
              recurring rent than hospitality checkout, making tenant-style
              balances and payment status useful.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Recurring Campground Accounts Separate
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              When multiple long-term occupants make recurring payments during
              the same billing period, each account needs to stay connected to
              the correct rental space and balance.
            </p>

            <p>
              RentFray organizes recurring payment activity around individual
              rental accounts instead of leaving the operator to match a list of
              deposits to occupants manually.
            </p>

            <p>
              That makes it easier to review what each account owes, what
              payment activity has occurred, and what remains outstanding.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Campground Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Occupant or Space Account</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment activity associated with the appropriate
                rental account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain the expected recurring payment according to the
                property's billing setup.
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
                See what each recurring occupant still owes after completed
                payments are applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Recurring Campground Payments Online
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray gives long-term or seasonal occupants a browser-based
              payment path without requiring an app download.
            </p>

            <p>
              The resulting payment activity stays connected to the recurring
              account rather than existing as an isolated money transfer.
            </p>

            <p>
              That allows the campground to review both the payment itself and
              the balance that remains afterward.
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
            Recurring Campground Payments vs Reservations
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Need</th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                  <th className="px-3 py-3 font-semibold">
                    Campground Reservation Software
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">
                    Recurring monthly or seasonal payment
                  </td>
                  <td className="px-3 py-3">
                    Fits the recurring payment workflow
                  </td>
                  <td className="px-3 py-3">
                    May support it, depending on platform
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Account balance tracking</td>
                  <td className="px-3 py-3">
                    Supported in the payment workflow
                  </td>
                  <td className="px-3 py-3">Varies by platform</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Nightly reservations</td>
                  <td className="px-3 py-3">Not RentFray's purpose</td>
                  <td className="px-3 py-3">Core use case</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Site availability calendar</td>
                  <td className="px-3 py-3">Not provided as booking software</td>
                  <td className="px-3 py-3">Common booking feature</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Guest check-in management</td>
                  <td className="px-3 py-3">Not the platform's focus</td>
                  <td className="px-3 py-3">Common hospitality function</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Balances Instead of Only Recording Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A recurring occupant may make a payment without satisfying the
              full amount due.
            </p>

            <p>
              If the account owes $700 and a completed payment covers $500, the
              campground still needs to know that a $200 balance remains.
            </p>

            <p>
              Tracking payment activity together with the account balance
              provides a clearer picture than simply recording that money was
              received.
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
            Payment Status Helps Separate Processing From Unpaid
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              An occupant who has submitted a payment that is still processing
              is different from an account with no payment activity.
            </p>

            <p>
              Keeping payment status visible helps the campground distinguish
              those situations before deciding which recurring accounts need
              attention.
            </p>

            <p>
              That distinction becomes more useful as the number of long-term
              occupants grows.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Campground Payments vs Manual Tracking
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">
                    Recurring Payment System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Collect payment</td>
                  <td className="px-3 py-3">
                    Checks, cash, or separate transfers
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Identify account</td>
                  <td className="px-3 py-3">
                    Match payment to occupant manually
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to rental account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">
                    Maintained with account activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Review payment status</td>
                  <td className="px-3 py-3">
                    Check separate payment records
                  </td>
                  <td className="px-3 py-3">
                    Status visible in the payment workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When a Campground Needs Dedicated Reservation Software
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Campgrounds that serve transient guests generally need features
              that are outside RentFray's focus.
            </p>

            <p>
              Those may include reservations, nightly pricing, site
              availability, online booking, arrival and departure dates,
              check-in, campground maps, and guest-management functions.
            </p>

            <p>
              RentFray should not be presented as a replacement for those
              systems.
            </p>

            <p>
              Its role is narrower: recurring property payments, configured
              charges, balances, and payment-status visibility for accounts that
              behave more like ongoing rentals.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Campground Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store occupant banking information or hold
              occupant funds. RentFray organizes the recurring payment workflow
              while Stripe provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Campground Payments Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for campground owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Occupants pay a small processing fee when they submit payments. The
            campground does not take on a monthly RentFray software
            subscription.
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
              href="/rv-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              RV Park Rent Collection
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
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
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
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Recurring Campground Payments Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep long-term or seasonal occupant payments, balances, and payment
            status organized without a monthly software fee for owners or
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