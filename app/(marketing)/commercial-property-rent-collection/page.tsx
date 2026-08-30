import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/commercial-property-rent-collection";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Commercial Property Rent Collection | RentFray";

const pageDescription =
  "Collect recurring commercial rent online, track tenant balances and payment status, and organize payments for offices, retail spaces, warehouses, and other commercial rentals.";

const faqItems = [
  {
    question: "Can commercial property owners collect rent online with RentFray?",
    answer:
      "Yes. RentFray provides an online payment workflow for recurring commercial rent and other configured tenant charges.",
  },
  {
    question: "Can I track commercial tenant balances separately?",
    answer:
      "Yes. RentFray keeps payment activity and outstanding balances associated with the appropriate tenant and rental account.",
  },
  {
    question: "What types of commercial properties can use RentFray?",
    answer:
      "RentFray can support recurring payment collection for properties such as office spaces, retail units, warehouses, mixed-use properties, and other commercial rentals where the payment structure fits the platform.",
  },
  {
    question: "Does RentFray replace commercial lease accounting software?",
    answer:
      "No. RentFray is focused on payment collection, recurring charges, balances, and payment status. Commercial properties with complex lease accounting, CAM reconciliation, percentage rent, or specialized accounting requirements may still need additional software.",
  },
  {
    question: "How are commercial rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge commercial property owners a monthly software fee?",
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
      "Online recurring rent collection and payment tracking for commercial property owners and managers.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Collect and track recurring commercial property rent online.",
  },
};

export default function CommercialPropertyRentCollectionPage() {
  return (
    <>
      <Script
        id="commercial-property-rent-collection-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="commercial-property-rent-collection-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Commercial Rent Collection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Commercial Property Rent Collection
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Commercial rent collection often involves recurring payments across
            multiple tenants, suites, storefronts, offices, warehouses, or other
            leased spaces.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online payment system for commercial
            owners and managers who need to collect recurring rent, track tenant
            balances, and monitor payment status without adding a monthly
            software subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Commercial Tenant Payments Organized
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Commercial tenants may occupy different spaces, owe different
              amounts, and maintain separate payment histories.
            </p>

            <p>
              An organized rent collection process should keep those accounts
              separate so property managers can see what each tenant owes, what
              has been paid, and what balance remains.
            </p>

            <p>
              RentFray connects the payment activity to the appropriate tenant
              account rather than leaving the manager to match unrelated
              transfers and deposits manually.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Commercial Property Managers Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant or Space</h3>
              <p className="mt-2 text-slate-600">
                Keep each payment associated with the appropriate commercial
                tenant and rental account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring rent and configured charges according to the
                property's payment setup.
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
              <h3 className="font-semibold">Outstanding Balance</h3>
              <p className="mt-2 text-slate-600">
                See what remains owed after completed payments are applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Commercial Rent Online
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Online rent collection gives commercial tenants a consistent
              browser-based payment path instead of requiring every payment to
              arrive through a different manual process.
            </p>

            <p>
              RentFray keeps that payment activity connected to the tenant's
              rent account so the manager can review the payment and resulting
              balance in the same workflow.
            </p>

            <p>
              Tenants do not need to download an app to access the RentFray
              payment experience.
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
            Commercial Rent Is More Than a Bank Deposit
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A bank transaction confirms that money moved, but it does not
              necessarily provide the full tenant-account picture.
            </p>

            <p>
              The property manager may also need to know which tenant the
              payment belongs to, which recurring obligation it applies to,
              whether any balance remains, and whether payment activity is still
              processing.
            </p>

            <p>
              A rent-specific workflow keeps that account context attached to
              the payment process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Commercial Rent Collection vs Manual Reconciliation
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
                  <td className="px-3 py-3">Collect payment</td>
                  <td className="px-3 py-3">
                    Checks, transfers, or other separate methods
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Identify tenant</td>
                  <td className="px-3 py-3">
                    Match transaction manually
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to tenant account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Track balance</td>
                  <td className="px-3 py-3">
                    Spreadsheet or accounting update
                  </td>
                  <td className="px-3 py-3">
                    Balance maintained with rent activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Review payment status</td>
                  <td className="px-3 py-3">
                    Check outside payment records
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
            Commercial Property Types That May Fit RentFray
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray can be useful when the property has recurring tenant or
            occupant payments that fit a straightforward rent collection
            workflow.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Office Spaces</h3>
              <p className="mt-2 text-slate-600">
                Collect recurring payments from office tenants and keep account
                balances organized.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Retail Units</h3>
              <p className="mt-2 text-slate-600">
                Maintain separate payment records for storefronts and other
                leased retail spaces.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Warehouse Space</h3>
              <p className="mt-2 text-slate-600">
                Organize recurring payments for leased warehouse units or
                commercial storage space.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Mixed-Use Properties</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment accounts separate across commercial
                occupants where the billing structure fits the platform.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Where Commercial Rent Can Become More Complex
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Commercial leases can involve more than a fixed monthly rent
              amount.
            </p>

            <p>
              Some properties may need detailed common-area maintenance
              reconciliation, tax and insurance allocations, percentage rent,
              operating-expense adjustments, complex escalation formulas, or
              specialized lease accounting.
            </p>

            <p>
              RentFray is not positioned as a complete commercial lease
              accounting platform. Its focus is the payment side: recurring
              charges, online collection, balances, and payment status.
            </p>

            <p>
              A commercial owner with more complex accounting requirements may
              use separate accounting or lease-management tools alongside a
              focused payment system.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Commercial Tenant Balances
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payment tracking should show more than whether a transaction
              occurred.
            </p>

            <p>
              If a tenant owes $2,500 and a completed payment covers $2,000,
              the account still has a $500 balance. That remaining amount is the
              number the manager needs to see.
            </p>

            <p>
              Keeping balances tied to the tenant account makes partial payments
              and outstanding amounts easier to review.
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
            Secure Commercial Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. RentFray organizes the payment and account workflow while
              Stripe handles the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Commercial Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for commercial property owners and
            managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments. The
            property does not take on a monthly RentFray software subscription.
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
            Related Commercial Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/office-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Office Rent Payment System
            </Link>

            <Link
              href="/warehouse-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Warehouse Rent Payment System
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
              href="/property-management-payment-system"
              className="text-blue-600 hover:underline"
            >
              Property Management Payment System
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
            Collect Commercial Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Organize recurring commercial tenant payments, balances, and
            payment status without a monthly software fee for owners or
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