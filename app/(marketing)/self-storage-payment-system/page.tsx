import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/self-storage-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Self Storage Payment System for Recurring Payments | RentFray";

const pageDescription =
  "Collect recurring self storage payments online, track customer balances and payment status by unit, and manage recurring billing without monthly software fees.";

const faqItems = [
  {
    question: "Can self storage facilities collect recurring payments with RentFray?",
    answer:
      "Yes. RentFray can support recurring online payments for storage unit accounts and other configured recurring charges.",
  },
  {
    question: "Can I track self storage balances by unit or customer?",
    answer:
      "Yes. RentFray keeps recurring payment activity and balances associated with the appropriate customer and unit account.",
  },
  {
    question: "Is RentFray full self storage management software?",
    answer:
      "No. RentFray is focused on recurring payment collection, balances, and payment status. It does not replace specialized software for unit inventory, gate access, reservations, auctions, lien workflows, insurance, or other storage-specific operations.",
  },
  {
    question: "Do storage customers need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so customers can access the payment flow without installing an app.",
  },
  {
    question: "How are self storage payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store customer banking information or hold customer funds.",
  },
  {
    question: "Does RentFray charge self storage operators a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for businesses using the platform. Customers pay a small processing fee when they submit payments.",
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
      "Collect recurring self storage payments online and track customer balances and payment status.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online recurring payment collection and balance tracking for self storage facilities.",
  },
};

export default function SelfStoragePage() {
  return (
    <>
      <Script
        id="self-storage-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="self-storage-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Self Storage Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Self Storage Payment System for Recurring Payments
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Self storage facilities may manage dozens or hundreds of recurring
            customer accounts, each tied to a specific unit, amount due, payment
            history, and remaining balance.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online payment system for recurring
            storage payments, customer balances, and payment status without a
            monthly software subscription for the business.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Each Storage Unit Payment Account Separate
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              When many customers make recurring payments during the same
              billing cycle, each transaction needs to stay connected to the
              correct account.
            </p>

            <p>
              RentFray keeps payment activity and balances associated with the
              appropriate customer and unit account instead of leaving the
              operator to match unrelated deposits manually.
            </p>

            <p>
              That creates a clearer record of what each account owed, what was
              paid, and what remains outstanding.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Self Storage Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Customer and Unit</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment activity connected to the appropriate
                storage account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring billing according to the facility's account
                setup.
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
                See what remains due after completed payments are applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Storage Unit Payments Online
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray gives customers a browser-based payment path for their
              recurring account.
            </p>

            <p>
              Customers do not need to download an app before accessing the
              payment flow.
            </p>

            <p>
              The resulting payment stays connected to the customer account,
              providing more context than a standalone transfer or deposit.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Storage Billing Is More Than a Payment Receipt
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Recording that a customer made a payment does not necessarily
              show whether the account is current.
            </p>

            <p>
              If a storage account owes $180 and a completed payment covers
              $120, the facility still needs to know that $60 remains due.
            </p>

            <p>
              Tracking the balance alongside payment activity makes partial
              payments and outstanding amounts easier to understand.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Status Helps Identify Which Accounts Need Attention
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              An account with a submitted payment that is still processing is
              different from an account with no payment activity.
            </p>

            <p>
              Keeping payment status visible helps operators distinguish those
              situations before deciding which accounts require follow-up.
            </p>

            <p>
              That becomes increasingly useful when the facility is reviewing
              many recurring accounts at the same time.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Self Storage Payments vs Manual Tracking
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
                    Match transaction to customer manually
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to customer account
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
            Where Dedicated Self Storage Software Goes Further
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A complete self storage management platform can handle much more
              than recurring customer payments.
            </p>

            <p>
              Storage-specific systems may include unit inventory, vacancy
              tracking, reservations, move-ins and move-outs, access-control
              integration, gate codes, insurance, automated lien processes,
              auctions, facility maps, and other operational tools.
            </p>

            <p>
              RentFray does not claim to replace those functions.
            </p>

            <p>
              Its role is focused: recurring payment collection, configured
              charges, customer balances, and payment-status visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When a Focused Payment System May Be Enough
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Not every storage operator is looking to replace every part of
              facility management.
            </p>

            <p>
              A business may already have a workable process for assigning
              units, managing access, and handling customer records but still
              want a clearer way to collect and track recurring payments.
            </p>

            <p>
              In that case, a focused payment platform may address the payment
              problem without requiring the facility to move every operational
              function into a new system.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Self Storage Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store customer banking information or hold
              customer funds. RentFray organizes the recurring payment workflow
              while Stripe provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Self Storage Payments Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for businesses using the payment
            platform.
          </p>

          <p className="mt-3 text-slate-600">
            Customers pay a small processing fee when they submit payments. The
            storage facility does not take on a monthly RentFray software
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
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Payment and Balance Tracking
            </Link>

            <Link
              href="/rent-billing-system"
              className="text-blue-600 hover:underline"
            >
              Recurring Billing System
            </Link>

            <Link
              href="/commercial-property-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Commercial Property Rent Collection
            </Link>

            <Link
              href="/warehouse-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Warehouse Rent Payment System
            </Link>

            <Link
              href="/equipment-rental-payment-system"
              className="text-blue-600 hover:underline"
            >
              Equipment Rental Payment System
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Recurring Self Storage Payments Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep customer payments, account balances, and payment status
            organized without a monthly RentFray software fee.
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