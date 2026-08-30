import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/landlord-rent-payment-options";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Landlord Rent Payment Options Compared | RentFray";

const pageDescription =
  "Compare common landlord rent payment options including checks, cash, bank transfers, payment apps, and online rent collection systems.";

const faqItems = [
  {
    question: "What are the most common ways landlords collect rent?",
    answer:
      "Common rent payment methods include checks, cash, money orders, bank transfers, general payment apps, and dedicated online rent collection systems.",
  },
  {
    question: "What is the best rent payment option for landlords?",
    answer:
      "The best option depends on the property, but landlords generally benefit from a payment method that keeps rent connected to tenant accounts, balances, and payment status while reducing manual tracking.",
  },
  {
    question: "Are bank transfers good for collecting rent?",
    answer:
      "Bank transfers can move money efficiently, but landlords may still need to identify the tenant, update balances, and maintain separate payment records unless the transfer is part of a rent-specific system.",
  },
  {
    question: "Can landlords collect rent through payment apps?",
    answer:
      "General payment apps can accept transfers, but they are not necessarily designed around recurring rent obligations, tenant balances, or property-level payment tracking.",
  },
  {
    question: "How does RentFray differ from a general payment app?",
    answer:
      "RentFray is designed around recurring property rent. Payments stay connected to tenant accounts, balances, and payment status instead of functioning as isolated money transfers.",
  },
  {
    question: "Does RentFray charge landlords a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for landlords and property managers. Tenants pay a small processing fee when they submit payments.",
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
      "Compare checks, cash, transfers, payment apps, and dedicated online rent collection systems.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "A practical comparison of common rent payment options for landlords.",
  },
};

export default function LandlordRentPaymentOptionsPage() {
  return (
    <>
      <Script
        id="landlord-rent-payment-options-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="landlord-rent-payment-options-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Payment Comparison
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Landlord Rent Payment Options Compared
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Landlords have several ways to accept rent, including checks, cash,
            money orders, bank transfers, payment apps, and dedicated online
            rent collection systems.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            The important difference is not simply how the money moves. A good
            rent payment method should also make it easier to identify the
            tenant, understand the payment status, and keep the account balance
            accurate.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Should a Landlord Look for in a Rent Payment Method?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rent payment method has to work for both sides of the rental
              relationship.
            </p>

            <p>
              Tenants need a practical way to submit rent, while landlords need
              enough information to understand which account the payment belongs
              to and whether the tenant still owes anything afterward.
            </p>

            <p>
              That makes rent collection different from simply receiving a
              transfer. The strongest payment option is usually the one that
              reduces the amount of separate tracking required after the money
              arrives.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Common Rent Payment Options for Landlords
          </h2>

          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Paper Checks</h3>

              <p className="mt-3 text-slate-600">
                Checks remain a familiar rent payment method. They create a
                physical record and do not require the tenant to use an online
                service.
              </p>

              <p className="mt-3 text-slate-600">
                The tradeoff is manual handling. The landlord may need to
                receive the check, deposit it, identify the tenant, record the
                payment, and update the account balance separately.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Cash</h3>

              <p className="mt-3 text-slate-600">
                Cash can be convenient in some landlord-tenant arrangements, but
                it creates more responsibility for documentation and physical
                handling.
              </p>

              <p className="mt-3 text-slate-600">
                Landlords using cash need a reliable process for receipts,
                records, deposits, and account updates.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">
                Money Orders and Certified Funds
              </h3>

              <p className="mt-3 text-slate-600">
                Money orders and certified funds can provide a paper-based
                alternative when personal checks are not preferred.
              </p>

              <p className="mt-3 text-slate-600">
                Like checks, however, they still require physical handling and
                separate rent-account tracking.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Bank Transfers</h3>

              <p className="mt-3 text-slate-600">
                Bank transfers can move rent electronically without requiring
                paper checks or cash.
              </p>

              <p className="mt-3 text-slate-600">
                The landlord may still need to match each transfer to the
                correct tenant and maintain a separate record of the tenant's
                balance and payment status.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">
                General Payment Apps
              </h3>

              <p className="mt-3 text-slate-600">
                General payment apps can provide a simple way for a tenant to
                send money electronically.
              </p>

              <p className="mt-3 text-slate-600">
                Their main limitation for rent collection is that they may treat
                the payment as an isolated transfer rather than part of an
                ongoing rental account with recurring obligations and balances.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">
                Dedicated Online Rent Collection Systems
              </h3>

              <p className="mt-3 text-slate-600">
                A dedicated rent collection system is designed around the
                landlord-tenant payment relationship rather than around a single
                transaction.
              </p>

              <p className="mt-3 text-slate-600">
                Depending on the platform, this can make it easier to keep
                recurring rent, payment activity, tenant balances, and payment
                status connected in one workflow.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Landlord Rent Payment Options Side by Side
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Payment Method</th>
                  <th className="px-3 py-3 font-semibold">
                    Online Payment
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    Account Tracking
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    Manual Work
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Check</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Separate</td>
                  <td className="px-3 py-3">Higher</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Cash</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Separate</td>
                  <td className="px-3 py-3">Higher</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Bank transfer</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Usually separate</td>
                  <td className="px-3 py-3">Varies</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">General payment app</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Limited or separate</td>
                  <td className="px-3 py-3">Varies</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">
                    Dedicated rent collection system
                  </td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">
                    Designed around rental accounts
                  </td>
                  <td className="px-3 py-3">Typically lower</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Moving Money Is Only Part of Rent Collection
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment method can successfully move money while still leaving
              important questions unanswered.
            </p>

            <p>
              Which tenant made the payment? Which rental account does it belong
              to? Is the payment completed or still processing? Does the tenant
              still have an outstanding balance?
            </p>

            <p>
              A rent-specific system is valuable because it can answer those
              questions within the same workflow used to collect the payment.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Tenant Balances Matter
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment history and a tenant balance are related, but they are
              not the same thing.
            </p>

            <p>
              A payment history shows what transactions occurred. A balance
              shows what the tenant still owes after completed payment activity
              has been applied.
            </p>

            <p>
              Landlords who rely only on bank deposits or transfer notifications
              may still need a separate ledger or spreadsheet to maintain that
              account-level picture.
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
            Why Payment Status Matters
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A submitted payment is not necessarily the same as a completed
              payment.
            </p>

            <p>
              Rent collection software can provide additional context by showing
              whether payment activity is processing, completed, failed, or
              otherwise requires attention.
            </p>

            <p>
              That context helps landlords avoid treating every account the same
              simply because a tenant initiated a transaction.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            One Consistent Rent Payment Process
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Accepting many unrelated payment methods can create flexibility,
              but it can also increase reconciliation work.
            </p>

            <p>
              If one tenant pays by check, another uses a transfer, and another
              uses a payment app, the landlord may have to review several places
              before understanding the complete rent picture.
            </p>

            <p>
              A consistent online rent payment process can reduce the number of
              separate systems the landlord needs to check during each billing
              cycle.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How RentFray Fits Among Landlord Payment Options
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray is a dedicated rent collection platform rather than a
              general money-transfer service.
            </p>

            <p>
              It keeps recurring rent obligations, tenant payment activity,
              payment status, and balances connected to the rental account.
            </p>

            <p>
              Tenants use a browser-based payment flow, while landlords and
              property managers use RentFray to review the rent collection
              picture from the property side.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/landlord-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              See how the RentFray landlord payment system works →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            RentFray vs General Payment Apps
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Function</th>
                  <th className="px-3 py-3 font-semibold">
                    General Payment App
                  </th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Send money online</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Yes, within the rent workflow</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Recurring rent obligations</td>
                  <td className="px-3 py-3">Not the primary purpose</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant account balance</td>
                  <td className="px-3 py-3">Usually separate</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment status</td>
                  <td className="px-3 py-3">Transaction focused</td>
                  <td className="px-3 py-3">
                    Connected to rent collection
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Property-level workflow</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Online Rent Payments Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to process tenant payments.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. RentFray manages the rent collection workflow while Stripe
              provides the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            $0 Monthly Software Fee for Landlords
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray has no monthly software fee for landlords and property
            managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about RentFray pricing →
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
              href="/landlord-payment-system"
              className="text-blue-600 hover:underline"
            >
              Landlord Payment System
            </Link>

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
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/best-way-to-collect-rent"
              className="text-blue-600 hover:underline"
            >
              Best Way to Collect Rent
            </Link>

            <Link
              href="/tenant-rent-payment-options"
              className="text-blue-600 hover:underline"
            >
              Tenant Rent Payment Options
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Looking for a Dedicated Online Rent Payment System?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            RentFray gives landlords a consistent way to collect rent online
            while keeping tenant balances and payment status connected to the
            rental account.
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