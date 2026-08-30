import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rental-payment-platform";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Rental Payment Platform for Recurring Rent | RentFray";

const pageDescription =
  "A rental payment platform connecting online rent payments, tenant balances, payment status, and recurring rent management for property owners and managers.";

const faqItems = [
  {
    question: "What is a rental payment platform?",
    answer:
      "A rental payment platform gives rental operators and tenants a structured system for recurring payments. It connects the tenant payment experience with the balances and payment information owners and managers need to monitor.",
  },
  {
    question: "What does RentFray include?",
    answer:
      "RentFray combines online rent collection, tenant balance tracking, payment-status visibility, and recurring rent management in one focused platform.",
  },
  {
    question: "Can tenants pay rent online with RentFray?",
    answer:
      "Yes. Tenants can access RentFray through a web browser and submit rent payments online without downloading a separate mobile app.",
  },
  {
    question: "How does RentFray process payments?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "What types of rental properties can use RentFray?",
    answer:
      "RentFray can support recurring payment workflows for rental properties including apartments, smaller rental portfolios, mobile home parks, RV parks, and other rental operations.",
  },
  {
    question: "Does RentFray charge owners or managers a monthly fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners or managers. Tenants pay a small processing fee when they submit payments.",
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
      "One focused platform for recurring rent payments, tenant balances, and payment-status visibility.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "A rental payment platform for recurring rent collection and tracking.",
  },
};

export default function RentalPaymentPlatformPage() {
  return (
    <>
      <Script
        id="rental-payment-platform-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rental-payment-platform-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recurring Rental Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One Rental Payment Platform for Recurring Rent
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray connects online tenant payments with the balances,
            payment status, and recurring rent information property owners and
            managers need to run rent collection from one focused platform.
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
            What Is a Rental Payment Platform?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rental payment platform provides the shared system between
              tenants making recurring payments and the owners or managers
              responsible for monitoring those accounts.
            </p>

            <p>
              The platform is broader than the payment transaction itself. It
              also provides the context around the transaction: which tenant
              owes rent, the tenant balance, payment activity, and the current
              payment status.
            </p>

            <p>
              RentFray brings those pieces together without requiring
              landlords and property managers to adopt a large general-purpose
              property management suite.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            The Two Sides of a Rental Payment Platform
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="text-xl font-semibold">For Tenants</h3>

              <div className="mt-4 space-y-3 text-slate-600">
                <p>Access the rent payment experience online.</p>
                <p>Review rent information associated with the account.</p>
                <p>Submit rent through a browser-based payment flow.</p>
                <p>No separate RentFray app download required.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="text-xl font-semibold">
                For Owners and Managers
              </h3>

              <div className="mt-4 space-y-3 text-slate-600">
                <p>Organize recurring rent around tenant accounts.</p>
                <p>See tenant balances.</p>
                <p>Monitor payment status.</p>
                <p>Keep rent collection activity in one focused system.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            From Amount Due to Payment Status
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">1. Rent Is Organized</h3>
              <p className="mt-2 text-slate-600">
                Recurring rent is associated with the property and tenant
                account so the amount owed is part of the system.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">2. The Tenant Accesses RentFray</h3>
              <p className="mt-2 text-slate-600">
                The tenant uses the property information provided by
                management to access the appropriate payment experience.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">3. The Tenant Pays Online</h3>
              <p className="mt-2 text-slate-600">
                Rent is submitted through RentFray's browser-based online
                payment flow.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">4. Stripe Processes the Payment</h3>
              <p className="mt-2 text-slate-600">
                Stripe provides the underlying payment processing. RentFray
                does not store tenant banking information or hold tenant
                funds.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                5. Management Monitors the Account
              </h3>
              <p className="mt-2 text-slate-600">
                Tenant balances and payment status remain visible so owners
                and managers can see what has been paid and what still needs
                attention.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            One Platform Instead of a Patchwork of Tools
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Rental payment operations become fragmented when different tools
              handle different pieces of the process. A payment app may move
              money, a spreadsheet may track balances, and bank activity may
              be used to confirm what actually arrived.
            </p>

            <p>
              Each tool may handle one part of the job, but somebody still has
              to connect the information.
            </p>

            <p>
              RentFray is designed to keep the core recurring-payment workflow
              together: tenant payment access, online rent collection,
              balances, and payment status.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Built Around Recurring Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Rent is different from an occasional online purchase or
              person-to-person transfer because the obligation repeats. The
              same property manages recurring payments from tenant accounts
              cycle after cycle.
            </p>

            <p>
              A rental payment platform needs to support that ongoing
              relationship rather than treating each transaction as an
              isolated transfer.
            </p>

            <p>
              RentFray keeps recurring rent and tenant payment activity
              connected so the system remains useful after a payment has been
              submitted.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-billing-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about recurring rent billing →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Collection and Tracking in the Same Platform
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Moving money is only one part of rent collection. Owners and
              managers also need to understand what happened after tenants
              were given an amount to pay.
            </p>

            <p>
              RentFray keeps tenant balances and payment status connected to
              the online collection workflow, reducing the need to maintain a
              separate tracking system beside the payment system.
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
            Browser-Based Tenant Payments
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray does not require tenants to install a dedicated mobile
              app. The tenant payment experience works through a web browser.
            </p>

            <p>
              That gives properties a consistent digital payment platform
              without making app installation part of the rent collection
              process.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-payment-app"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about app-free rent payments →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Payment Processing Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to securely process online payments.
              RentFray provides the rental-payment workflow while Stripe
              provides the underlying payment-processing infrastructure.
            </p>

            <p>
              RentFray does not store tenant banking information and does not
              hold tenant funds.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Platform for Different Rental Operations
          </h2>

          <p className="mt-4 text-slate-600">
            The same core need appears across many rental businesses:
            recurring payments need to be collected and tracked against the
            correct account.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/online-rent-payment-system-apartments"
              className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-slate-50"
            >
              Apartments
            </Link>

            <Link
              href="/duplex-landlord-rent-collection"
              className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-slate-50"
            >
              Duplexes and Small Rentals
            </Link>

            <Link
              href="/mobile-home-park-rent-collection"
              className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-slate-50"
            >
              Mobile Home Parks
            </Link>

            <Link
              href="/rv-park-rent-collection"
              className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-slate-50"
            >
              RV Parks
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            $0 Per Month for Property Owners and Managers
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray has no monthly software fee for property owners or
            managers. There is no recurring software subscription required to
            use the platform.
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
            Rental Payment Platform vs Payment System
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The terms are closely related, but a payment system generally
              emphasizes how a transaction is submitted and processed.
            </p>

            <p>
              A rental payment platform describes the broader environment
              around recurring rental payments: tenant access, rent
              information, online payment collection, balances, and payment
              status.
            </p>

            <p>
              RentFray provides that broader rental-payment workflow while
              remaining focused specifically on recurring payments rather than
              becoming a general property-management suite.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/online-rent-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore the online rent payment system →
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
            Related Rental Payment Resources
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
              Rent Billing System
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
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Put Recurring Rent Payments in One Focused Platform
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Give tenants an online payment experience while keeping balances
            and payment status visible to owners and managers.
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