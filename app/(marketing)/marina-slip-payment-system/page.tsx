import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/marina-slip-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Marina Slip Payment System for Recurring Rent | RentFray";

const pageDescription =
  "Collect recurring marina slip rent online, track slip-holder balances and payment status, and manage recurring dockage payments without monthly software fees.";

const faqItems = [
  {
    question: "Can marinas collect recurring slip rent online with RentFray?",
    answer:
      "Yes. RentFray can support recurring online payments for marina slips and other configured recurring rental charges.",
  },
  {
    question: "Can I track marina payments by slip holder?",
    answer:
      "Yes. RentFray keeps recurring payment activity and balances associated with the appropriate rental account so marina operators can review what has been paid and what remains due.",
  },
  {
    question: "Is RentFray full marina management software?",
    answer:
      "No. RentFray is focused on recurring payment collection, balances, and payment status. It does not replace specialized marina software for reservations, transient dockage, vessel records, fuel sales, launch scheduling, maintenance, or other marina operations.",
  },
  {
    question: "Do slip holders need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so slip holders can access the payment flow without installing an app.",
  },
  {
    question: "How are marina slip payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store slip-holder banking information or hold slip-holder funds.",
  },
  {
    question: "Does RentFray charge marina owners a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners and managers. Slip holders pay a small processing fee when they submit payments.",
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
      "Collect recurring marina slip rent online and track slip-holder balances and payment status.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online recurring marina slip payments and balance tracking without monthly software fees.",
  },
};

export default function MarinaSlipPaymentSystemPage() {
  return (
    <>
      <Script
        id="marina-slip-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="marina-slip-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Marina Slip Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Marina Slip Payment System for Recurring Rent
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Marinas with long-term or seasonal slip holders may collect the same
            dockage or slip rent from many rental accounts during each billing
            cycle.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online system for recurring marina slip
            payments, account balances, and payment status without a monthly
            software subscription for marina owners or managers.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Every Slip Holder's Payment Account Separate
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              When multiple slip holders pay during the same billing period,
              each payment needs to stay connected to the correct rental
              account.
            </p>

            <p>
              RentFray keeps recurring payment activity and balances associated
              with the appropriate account rather than leaving the marina to
              reconstruct the payment picture from deposits, notes, and
              spreadsheets.
            </p>

            <p>
              That creates a clearer record of what each account owes, what has
              been paid, and what remains outstanding.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Slip Rent and Dockage Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Long-term marina arrangements often involve recurring payments
              tied to an ongoing slip or dockage agreement.
            </p>

            <p>
              RentFray is most relevant when those charges can be represented as
              recurring rental obligations associated with individual accounts.
            </p>

            <p>
              That makes the platform a better fit for recurring slip rent than
              for one-time transient dockage or reservation-based marina
              activity.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Marina Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Slip-Holder Account</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment activity associated with the appropriate
                rental account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain the expected recurring payment according to the
                marina's account setup.
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
                See what remains due after completed payments are applied to the
                account.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Let Slip Holders Pay Online Without an App
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray gives slip holders a browser-based path for submitting
              recurring payments.
            </p>

            <p>
              They do not need to download an app before accessing the payment
              flow.
            </p>

            <p>
              Payment activity stays connected to the rental account so the
              marina can review the payment together with the account balance.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track the Account Balance, Not Just the Payment
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment record by itself does not always tell the marina whether
              a slip-holder account is fully current.
            </p>

            <p>
              RentFray tracks completed payment activity together with the
              account balance, giving operators a clearer view of what remains
              owed.
            </p>

            <p>
              That is more useful for recurring rental accounts than simply
              recording that money changed hands.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about payment and balance tracking →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Provides More Context
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A slip holder with a submitted payment that is still processing is
              different from an account with no payment activity.
            </p>

            <p>
              Keeping payment status visible helps marina operators distinguish
              those situations before deciding which accounts require
              attention.
            </p>

            <p>
              That distinction becomes increasingly useful when many recurring
              slip accounts are due during the same billing period.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Marina Slip Payments vs Manual Tracking
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
                  <td className="px-3 py-3">Collect slip rent</td>
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
                    Match transaction manually
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
                    Check payment records separately
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
            Where Dedicated Marina Management Software Goes Further
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Running a marina involves operational needs that extend well
              beyond collecting recurring slip rent.
            </p>

            <p>
              Specialized marina software may include transient reservations,
              slip availability, vessel records, contracts, fuel sales,
              launch scheduling, dry storage, service and maintenance
              management, marina maps, and other operational tools.
            </p>

            <p>
              RentFray does not claim to replace those functions.
            </p>

            <p>
              Its role is narrower: recurring online payments, configured
              charges, account balances, and payment-status visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When a Focused Marina Payment System May Be Enough
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A marina may already have workable processes for assigning slips,
              maintaining vessel information, handling contracts, and managing
              daily operations.
            </p>

            <p>
              Its main payment problem may simply be collecting recurring slip
              rent online and maintaining a clearer picture of account balances.
            </p>

            <p>
              In that situation, a focused payment platform can address the
              recurring collection workflow without requiring the marina to
              replace every other operational process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Marina Slip Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store slip-holder banking information or hold
              slip-holder funds. RentFray organizes the recurring payment
              workflow while Stripe provides the payment-processing
              infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Marina Slip Payments Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for marina owners and managers using the
            payment platform.
          </p>

          <p className="mt-3 text-slate-600">
            Slip holders pay a small processing fee when they submit payments.
            The marina does not take on a monthly RentFray software subscription.
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
            Related Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
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
              Recurring Rent Billing
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent and Balance Tracking
            </Link>

            <Link
              href="/commercial-property-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Commercial Property Rent Collection
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
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Recurring Marina Slip Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep slip-holder payments, balances, and payment status organized
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