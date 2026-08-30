import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/equipment-rental-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Equipment Rental Payment Systems vs Rent Collection Software | RentFray";

const pageDescription =
  "Learn how equipment rental payment systems differ from property rent collection software and when a dedicated equipment rental platform is the better fit.";

const faqItems = [
  {
    question: "Is RentFray equipment rental software?",
    answer:
      "No. RentFray is rent collection software for property owners and managers. It is not designed to manage equipment inventory, rental periods, reservations, returns, damage, deposits, or other equipment-rental operations.",
  },
  {
    question: "What does equipment rental software usually need to manage?",
    answer:
      "Equipment rental businesses may need tools for inventory availability, rental periods, reservations, contracts, returns, deposits, damage tracking, maintenance, and customer billing. Those requirements are different from recurring property rent collection.",
  },
  {
    question: "What type of payments is RentFray designed for?",
    answer:
      "RentFray is designed for recurring property rent and configured property-related charges associated with tenant rental accounts.",
  },
  {
    question: "Can tenants pay property rent online with RentFray?",
    answer:
      "Yes. RentFray gives tenants a browser-based payment path for submitting rent payments online.",
  },
  {
    question: "How are RentFray payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge property owners a monthly software fee?",
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
      "Understand the difference between equipment rental payment systems and recurring property rent collection software.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Equipment rental software and property rent collection software solve different payment problems.",
  },
};

export default function EquipmentRentalPaymentSystemPage() {
  return (
    <>
      <Script
        id="equipment-rental-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="equipment-rental-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Payment Software Comparison
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Equipment Rental Payment Systems vs Rent Collection Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Equipment rental businesses and property owners may both collect
            recurring payments, but the software requirements behind those
            payments are different.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray is built for property rent collection. It is not equipment
            rental management software.
          </p>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Is RentFray an Equipment Rental Payment System?
          </h2>

          <p className="mt-4 text-slate-600">
            Not in the traditional equipment-rental sense.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray manages recurring property rent, configured charges,
            tenant payment activity, account balances, and payment status.
          </p>

          <p className="mt-3 text-slate-600">
            It does not manage equipment inventory, reservations, pickup and
            return dates, rental contracts, damage, deposits, maintenance, or
            equipment availability.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Equipment Rentals and Property Rent Are Different
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The word "rental" applies to both property and equipment, but the
              underlying business relationships are different.
            </p>

            <p>
              Property rent commonly involves an ongoing tenant occupying a
              rental unit and owing recurring rent according to a continuing
              rental relationship.
            </p>

            <p>
              Equipment rentals can involve individual assets, availability,
              start and return dates, changing rental periods, deposits,
              condition tracking, and other operational requirements tied to the
              equipment itself.
            </p>

            <p>
              A payment platform should match the underlying business workflow,
              not simply the word used to describe the payment.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Equipment Rental Software May Need to Handle
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Equipment Inventory</h3>
              <p className="mt-2 text-slate-600">
                Track individual equipment, categories, quantities, and
                availability.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Rental Periods</h3>
              <p className="mt-2 text-slate-600">
                Manage pickup dates, return dates, extensions, and changing
                rental durations.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Reservations and Scheduling</h3>
              <p className="mt-2 text-slate-600">
                Determine whether a specific piece of equipment is available
                for a requested period.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Returns and Condition</h3>
              <p className="mt-2 text-slate-600">
                Record returned equipment, damage, maintenance needs, and other
                asset-specific information.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Rental Contracts</h3>
              <p className="mt-2 text-slate-600">
                Support agreements and terms associated with individual
                equipment rentals.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Equipment-Specific Billing</h3>
              <p className="mt-2 text-slate-600">
                Calculate charges that may depend on rental duration, equipment,
                extensions, deposits, or other rental terms.
              </p>
            </div>
          </div>

          <p className="mt-6 text-slate-600">
            RentFray does not provide these equipment-management functions.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What RentFray Is Designed to Handle
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Property Rent</h3>
              <p className="mt-2 text-slate-600">
                Maintain recurring rent obligations associated with tenant
                rental accounts.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Online Tenant Payments</h3>
              <p className="mt-2 text-slate-600">
                Give tenants a browser-based path for submitting rent payments
                online.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                Keep payment activity and the amount still owed connected to
                the tenant account.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payments from activity that is still
                processing or requires attention.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Equipment Rental Software vs Property Rent Collection Software
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Function</th>
                  <th className="px-3 py-3 font-semibold">
                    Equipment Rental Software
                  </th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Recurring property rent</td>
                  <td className="px-3 py-3">Not the primary purpose</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant balances</td>
                  <td className="px-3 py-3">Varies by platform</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Equipment inventory</td>
                  <td className="px-3 py-3">Common requirement</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Equipment reservations</td>
                  <td className="px-3 py-3">Common requirement</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Pickup and return tracking</td>
                  <td className="px-3 py-3">Common requirement</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Asset maintenance</td>
                  <td className="px-3 py-3">May be included</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Online payments</td>
                  <td className="px-3 py-3">May be included</td>
                  <td className="px-3 py-3">
                    Yes, for RentFray's property-rent workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Choose Software Based on the Rental Relationship
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              If the business rents equipment to customers and needs to manage
              those assets from reservation through return, dedicated equipment
              rental software is the appropriate category to evaluate.
            </p>

            <p>
              If the business owns or manages real property and needs to collect
              recurring rent from tenants, property rent collection software is
              the more relevant category.
            </p>

            <p>
              Keeping those categories separate helps businesses evaluate
              software based on the actual workflow they need rather than on
              overlapping terminology.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            RentFray Is Focused on Property Rent Collection
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray is intentionally narrower than a general rental-business
              management platform.
            </p>

            <p>
              Property owners and managers use RentFray to organize recurring
              rent obligations, collect tenant payments online, review payment
              status, and track tenant balances.
            </p>

            <p>
              That focus allows RentFray to solve the rent collection problem
              without claiming to manage unrelated rental industries.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about RentFray's rent collection software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Property Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
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
            Property Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            For property rent collection, RentFray costs $0 per month for
            property owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
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
            Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/free-rent-collection-software"
              className="text-blue-600 hover:underline"
            >
              Free Rent Collection Software
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
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
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
            Need to Collect Property Rent Online?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            RentFray provides recurring rent collection, tenant balance
            tracking, and payment-status visibility without a monthly software
            fee for property owners and managers.
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