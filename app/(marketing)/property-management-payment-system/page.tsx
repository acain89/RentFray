import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/property-management-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle =
  "Property Management Payment System for Rent Collection | RentFray";

const pageDescription =
  "A property management payment system for collecting rent across multiple units and tenants. Track balances and payment status while giving tenants a consistent online payment process.";

const faqItems = [
  {
    question: "What is a property management payment system?",
    answer:
      "A property management payment system helps owners and managers collect recurring tenant payments while keeping balances and payment status organized across the property.",
  },
  {
    question: "Can RentFray manage rent payments across multiple units?",
    answer:
      "Yes. RentFray is designed to help property owners and managers organize tenant balances and payment activity across the units they manage.",
  },
  {
    question: "Can property managers see which tenants have paid?",
    answer:
      "Yes. RentFray provides balance and payment-status visibility so managers can see which tenant accounts are current and which still need attention.",
  },
  {
    question: "How are tenant payments processed?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Is RentFray free for property managers?",
    answer:
      "Yes. RentFray has no monthly software fee for property owners or managers. Tenants pay a small processing fee when they submit payments.",
  },
  {
    question: "Do tenants need to install an app?",
    answer:
      "No. Tenants can use RentFray through a web browser without downloading a separate mobile app.",
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
    type: "website",
    url: pagePath,
    siteName: "RentFray",
    title: pageTitle,
    description:
      "Collect rent across multiple units and tenants while keeping balances and payment status organized in one system.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online rent payment management for properties with multiple units and tenants.",
  },
};

export default function PropertyManagementPaymentSystemPage() {
  return (
    <>
      <Script
        id="property-management-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="property-management-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Payments for Property Managers
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Property Management Payment System for Multiple Units and Tenants
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray gives property owners and managers one focused system for
            collecting rent, tracking tenant balances and payment status, and
            managing recurring payments across the property.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Create a Free Account
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Online Payment System Overview
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            One Rent Payment System Across the Property
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Managing rent for multiple tenants creates a different problem
              than collecting a single payment. Property managers need to know
              what is happening across many tenant accounts at the same time.
            </p>

            <p>
              When tenants use different payment methods and records are kept
              separately, managers have to piece together the status of the
              property from multiple sources.
            </p>

            <p>
              RentFray creates a consistent rent collection process so tenant
              payments, balances, and payment status are easier to manage from
              one place.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Property Managers Need to See
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                Keep the amount owed by each tenant visible without
                maintaining a separate manual rent ledger.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                See the status of tenant payments so managers know which
                accounts are current and which require attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Rent</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring rent organized around the units and tenants
                managed by the property.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Property-Level Visibility</h3>
              <p className="mt-2 text-slate-600">
                Get a clearer view of rent collection across the property
                instead of checking individual payment channels one by one.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Consistent Payment Process for Every Tenant
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payment management becomes harder when tenants use different
              methods. One may pay by check, another through a transfer app,
              and another through a separate digital service.
            </p>

            <p>
              Even when every tenant pays, the manager may still have to
              reconcile several sources before knowing the actual status of
              the property.
            </p>

            <p>
              RentFray gives tenants a consistent online payment process while
              giving management a consistent place to monitor rent activity.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How Property Rent Collection Works With RentFray
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">1. Configure the Property</h3>
              <p className="mt-2 text-slate-600">
                Set up the property and the rent information needed to manage
                recurring tenant payments.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                2. Give Tenants Access to RentFray
              </h3>
              <p className="mt-2 text-slate-600">
                Tenants use the property information provided to them to
                access their RentFray payment experience.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                3. Tenants Submit Rent Online
              </h3>
              <p className="mt-2 text-slate-600">
                Tenants submit their rent payments through the browser-based
                payment flow.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">4. Stripe Processes Payments</h3>
              <p className="mt-2 text-slate-600">
                Payments are securely processed through Stripe. RentFray does
                not store tenant banking information or hold tenant funds.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                5. Management Tracks the Property
              </h3>
              <p className="mt-2 text-slate-600">
                Managers use RentFray to monitor tenant balances and payment
                status across the property.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Reduce Manual Rent Reconciliation
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Collecting money in one system and tracking it in another
              creates repeated work. Every payment may require someone to
              verify the transaction and update a separate spreadsheet or
              record.
            </p>

            <p>
              A dedicated property payment system connects the collection
              process with the information management needs to monitor tenant
              accounts.
            </p>

            <p>
              That makes it easier to answer the operational questions that
              matter each month: which tenants have paid, what remains due,
              and where attention is needed.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore rent tracking software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Built for Recurring Rent, Not General Money Transfers
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              General payment apps are designed to transfer money between
              people. Property management requires more context because every
              payment belongs to a tenant account and an ongoing rental
              obligation.
            </p>

            <p>
              RentFray is designed specifically around recurring rent
              collection. That keeps the payment experience tied to the
              property-management information needed after the transaction
              occurs.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Payment Processing Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to securely process tenant payments. This
              separates payment processing from the property-management
              workflow RentFray provides.
            </p>

            <p>
              RentFray does not store tenant banking information and does not
              hold tenant funds.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Browser-Based Payments for Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Tenants do not need to install a separate mobile app to use
              RentFray. The tenant payment experience works through a web
              browser.
            </p>

            <p>
              That gives management a consistent payment system without
              requiring every tenant to download and maintain another app.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/tenant-payment-portal"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the tenant payment portal →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            No Monthly Software Fee for Property Management
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            There is no monthly software subscription required to manage rent
            collection through the platform.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn more about RentFray pricing →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            For Small Properties and Growing Portfolios
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Property payment management matters whether an operator handles
              a small multifamily property or a larger group of rental units.
              As the number of tenant accounts grows, consistent payment
              tracking becomes increasingly important.
            </p>

            <p>
              RentFray stays focused on rent collection rather than requiring
              owners and managers to adopt a broad property-management suite
              simply to organize recurring payments.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2 text-sm">
            <Link
              href="/online-rent-payment-system-apartments"
              className="text-blue-600 hover:underline"
            >
              Apartment rent payment system
            </Link>

            <Link
              href="/mobile-home-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Mobile home park rent collection
            </Link>

            <Link
              href="/rv-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              RV park rent collection
            </Link>

            <Link
              href="/self-storage-payment-system"
              className="text-blue-600 hover:underline"
            >
              Self-storage payment system
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Property Management Payments vs Landlord Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A landlord payment system and a property management payment
              system solve related problems, but the emphasis is different.
            </p>

            <p>
              Individual landlords are often focused on accepting rent from
              their tenants and monitoring those accounts. Property managers
              are more likely to need a broader operational view across
              multiple units and tenants.
            </p>

            <p>
              RentFray supports both workflows while keeping rent collection
              at the center of the system.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/landlord-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the landlord payment system →
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
            Related Property Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/landlord-payment-system"
              className="text-blue-600 hover:underline"
            >
              Landlord Payment System
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/rental-payment-platform"
              className="text-blue-600 hover:underline"
            >
              Rental Payment Platform
            </Link>

            <Link
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Organize Rent Payments Across Your Property
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Give tenants a consistent way to pay while keeping balances and
            payment status easier for property management to monitor.
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