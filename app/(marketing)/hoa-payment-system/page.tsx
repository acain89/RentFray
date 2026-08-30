import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/hoa-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "HOA Payment System for Recurring Dues | RentFray";

const pageDescription =
  "Collect recurring HOA dues and community payments online, track homeowner balances and payment status, and avoid monthly software fees.";

const faqItems = [
  {
    question: "Can HOAs collect recurring dues online with RentFray?",
    answer:
      "Yes. RentFray can support recurring online payments for homeowner dues, assessments, and other configured community charges when they fit a recurring payment workflow.",
  },
  {
    question: "Can I track HOA balances by homeowner account?",
    answer:
      "Yes. RentFray keeps recurring payment activity and balances associated with the appropriate homeowner or resident account.",
  },
  {
    question: "Is RentFray full HOA management software?",
    answer:
      "No. RentFray is focused on recurring payment collection, balances, and payment status. It does not replace specialized HOA software for accounting, elections, violations, architectural requests, document management, reserve planning, or other association-management functions.",
  },
  {
    question: "Do homeowners need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so homeowners can access the payment flow without installing an app.",
  },
  {
    question: "How are HOA payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store homeowner banking information or hold homeowner funds.",
  },
  {
    question: "Does RentFray charge HOAs a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for organizations using the platform. Homeowners pay a small processing fee when they submit payments.",
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
      "Collect recurring HOA dues online and track homeowner balances and payment status.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online recurring HOA dues collection and homeowner balance tracking.",
  },
};

export default function HoaPaymentSystemPage() {
  return (
    <>
      <Script
        id="hoa-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="hoa-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            HOA Recurring Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            HOA Payment System for Recurring Dues
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Homeowners associations may collect the same dues or recurring
            community charges from many homeowner accounts during each billing
            cycle.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online payment system for collecting
            recurring HOA payments, tracking homeowner balances, and monitoring
            payment status without a monthly software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep HOA Payments Connected to the Correct Homeowner Account
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A community may receive many payments during the same billing
              period, but each one needs to stay associated with the appropriate
              homeowner account.
            </p>

            <p>
              RentFray keeps recurring payment activity and balances organized
              by account instead of leaving the board or manager to reconstruct
              the payment picture from bank deposits and spreadsheet entries.
            </p>

            <p>
              That creates a clearer record of what each account owed, what was
              paid, and what remains outstanding.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            HOA Dues, Assessments, and Recurring Community Charges
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Associations may collect regular monthly, quarterly, or other
              recurring dues depending on how the community is structured.
            </p>

            <p>
              Some communities may also have configured assessments or other
              recurring charges that need to stay connected to individual
              homeowner accounts.
            </p>

            <p>
              RentFray is best suited to charges that can be represented as
              recurring account obligations and tracked through the same payment
              and balance workflow.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What an HOA Payment System Needs to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Homeowner Account</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment activity associated with the appropriate
                homeowner or resident account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring dues or configured charges according to the
                community's setup.
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
            Let Homeowners Pay Online Without an App Download
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray gives homeowners a browser-based way to submit recurring
              community payments.
            </p>

            <p>
              They do not need to install an app before accessing the payment
              flow.
            </p>

            <p>
              Payment activity remains connected to the account so the
              association can review the transaction alongside the resulting
              balance.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Payment Receipt Is Not the Same as an Account Balance
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Knowing that a homeowner submitted money does not always mean the
              account is fully current.
            </p>

            <p>
              If an account owes $600 and a completed payment covers $450, the
              association still needs to know that $150 remains due.
            </p>

            <p>
              Tracking payments together with the account balance provides a
              clearer picture than simply recording that a transaction
              occurred.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Helps Boards and Managers Know What Needs Attention
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A homeowner with a submitted payment that is still processing is
              different from an account with no payment activity.
            </p>

            <p>
              Keeping payment status visible helps administrators distinguish
              those situations before deciding which accounts require
              follow-up.
            </p>

            <p>
              That distinction becomes increasingly valuable when many
              homeowner accounts are due during the same payment cycle.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            HOA Payments vs Manual Tracking
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
                  <td className="px-3 py-3">Collect dues</td>
                  <td className="px-3 py-3">
                    Checks or separate payment methods
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Identify homeowner account</td>
                  <td className="px-3 py-3">
                    Match payment manually
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to account activity
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">
                    Maintained with payment activity
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
            Where Dedicated HOA Management Software Goes Further
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Association management involves much more than collecting dues.
            </p>

            <p>
              Full HOA platforms may provide accounting, budgeting, reserve
              tracking, board portals, elections, violation management,
              architectural requests, document storage, meeting tools,
              communications, work orders, and other community-management
              functions.
            </p>

            <p>
              RentFray does not claim to replace those systems.
            </p>

            <p>
              Its role is narrower: recurring online payments, configured
              charges, homeowner balances, and payment-status visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When a Focused HOA Payment System May Be Enough
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Some associations already have workable processes for board
              administration, records, accounting, and community operations.
            </p>

            <p>
              Their main payment problem may simply be collecting recurring dues
              online and maintaining a clearer picture of account balances.
            </p>

            <p>
              In that situation, a focused payment platform can address the
              collection workflow without requiring the association to replace
              every other administrative process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure HOA Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store homeowner banking information or hold
              homeowner funds. RentFray organizes the recurring payment workflow
              while Stripe provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            HOA Payments Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for associations, boards, and managers
            using the payment platform.
          </p>

          <p className="mt-3 text-slate-600">
            Homeowners pay a small processing fee when they submit payments. The
            association does not take on a monthly RentFray software
            subscription.
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
              Online Payment System
            </Link>

            <Link
              href="/rent-billing-system"
              className="text-blue-600 hover:underline"
            >
              Recurring Billing System
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Payment and Balance Tracking
            </Link>

            <Link
              href="/property-management-payment-system"
              className="text-blue-600 hover:underline"
            >
              Property Management Payment System
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
            Collect Recurring HOA Dues Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep homeowner payments, balances, and payment status organized
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