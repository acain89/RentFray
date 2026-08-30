import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/landlord-payment-system";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Landlord Payment System for Online Rent Payments | RentFray";

const pageDescription =
  "A landlord payment system for collecting rent online. Give tenants a consistent payment process, track payment status and balances, and receive rent through Stripe.";

const faqItems = [
  {
    question: "What is a landlord payment system?",
    answer:
      "A landlord payment system gives property owners a structured way to accept rent payments from tenants and keep payment activity connected to tenant balances and recurring rent.",
  },
  {
    question: "How do tenants pay rent through RentFray?",
    answer:
      "Tenants use RentFray's online payment flow to access their rent information and submit payment through a web browser.",
  },
  {
    question: "How are RentFray payments processed?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Can landlords track payment status?",
    answer:
      "Yes. RentFray gives landlords visibility into tenant balances and payment status so they can see what has been paid and what still needs attention.",
  },
  {
    question: "Is there a monthly fee for landlords?",
    answer:
      "No. RentFray has no monthly software fee for landlords or property managers. Tenants pay a small processing fee when they submit payments.",
  },
  {
    question: "Do tenants need to download an app?",
    answer:
      "No. RentFray works through a web browser, so tenants do not need to install a separate mobile app to pay rent.",
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
      "Collect rent through a consistent online payment process while keeping tenant balances and payment status easier to track.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "An online landlord payment system for collecting and tracking rent.",
  },
};

export default function LandlordPaymentSystemPage() {
  return (
    <>
      <Script
        id="landlord-payment-system-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="landlord-payment-system-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Online Payments for Landlords
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            A Landlord Payment System Built for Rent
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray gives landlords a consistent way to accept rent online,
            keep payments connected to tenant balances, and monitor payment
            status without relying on checks, cash, or scattered transfer
            apps.
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
            What a Landlord Payment System Actually Does
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A landlord payment system is more than a way to move money from
              a tenant to a property owner. Rent payments happen repeatedly,
              and each payment belongs to a specific tenant, balance, and
              rental account.
            </p>

            <p>
              A dedicated system keeps that payment process structured.
              Tenants get a consistent way to submit rent, while landlords get
              a clearer view of payment activity and outstanding balances.
            </p>

            <p>
              That is the role RentFray is designed to fill: a focused payment
              system for recurring rent collection rather than a
              general-purpose money transfer tool.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How Rent Payments Work With RentFray
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">1. Set Up the Property</h3>
              <p className="mt-2 text-slate-600">
                The landlord creates the property and configures the
                information RentFray needs to organize recurring rent.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                2. Tenants Access the Payment Flow
              </h3>
              <p className="mt-2 text-slate-600">
                Tenants use the property information provided by the landlord
                to access RentFray and reach their online rent payment
                experience.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">3. The Tenant Submits Payment</h3>
              <p className="mt-2 text-slate-600">
                The tenant submits the rent payment online through the
                browser-based payment flow.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                4. Stripe Processes the Payment
              </h3>
              <p className="mt-2 text-slate-600">
                Payments are securely processed through Stripe. RentFray does
                not store tenant banking information or hold tenant funds.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                5. The Landlord Tracks the Account
              </h3>
              <p className="mt-2 text-slate-600">
                RentFray keeps tenant balances and payment status visible so
                the landlord can see which accounts are current and which
                still need attention.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why a Dedicated Rent Payment System Is Different
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Checks, cash, bank transfers, and general payment apps can all
              move money. The problem is that the landlord may still need a
              separate system to determine what the payment was for, update a
              balance, and keep track of who has or has not paid.
            </p>

            <p>
              RentFray is built around the rental relationship. The payment
              process and the information a landlord needs to manage rent live
              in the same system.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/landlord-rent-payment-options"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare landlord rent payment options →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Visibility After the Tenant Pays
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Receiving the payment is only part of rent collection.
              Landlords also need to know whether a payment is still
              processing, whether the tenant has an outstanding balance, and
              which accounts require attention.
            </p>

            <p>
              RentFray keeps payment status and tenant balances visible so the
              landlord does not have to reconstruct the month from bank
              deposits, messages, and a separate spreadsheet.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about rent payment tracking →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Payment Processing Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe for payment processing. This gives the
              payment flow established payment infrastructure while allowing
              RentFray to stay focused on the rent collection experience.
            </p>

            <p>
              RentFray does not store tenant banking information and does not
              hold tenant funds.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            One Payment Process Instead of Several
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Rent collection becomes harder to follow when one tenant pays by
              check, another uses a transfer app, and another uses a different
              method entirely. The landlord ends up managing both the money
              and the collection process around it.
            </p>

            <p>
              A dedicated landlord payment system creates a consistent process
              tenants can use each month. That consistency makes payment
              activity easier to understand and reduces the number of separate
              places a landlord has to check.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            No App Download Required for Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Tenants can use RentFray through a web browser. They do not need
              to install a dedicated mobile app simply to submit their rent
              payment.
            </p>

            <p>
              That keeps the tenant side focused on the task that matters:
              accessing their rent information and making the payment.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/tenant-payment-portal"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the tenant payment experience →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            $0 Monthly Software Fee for Landlords
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray has no monthly software fee for landlords or property
            managers. There is no recurring software subscription required to
            use the rent collection platform.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about the RentFray pricing model →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment System or Rent Collection Software?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The terms overlap, but they describe slightly different needs.
              A landlord searching for a payment system is usually focused on
              how tenants submit money and how the landlord receives and
              monitors those payments.
            </p>

            <p>
              Rent collection software describes the broader workflow around
              recurring rent, including balances, payment status, and ongoing
              account management.
            </p>

            <p>
              RentFray handles both, but separating the concepts makes it
              easier to choose the information most relevant to what you are
              trying to solve.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-collection-software-landlords"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore rent collection software for landlords →
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
            Related Rent Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/rent-collection-software-landlords"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software for Landlords
            </Link>

            <Link
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>

            <Link
              href="/landlord-rent-payment-options"
              className="text-blue-600 hover:underline"
            >
              Landlord Rent Payment Options
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Give Your Property a Consistent Rent Payment Process
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Use RentFray to collect rent online while keeping tenant balances
            and payment status organized in one focused system.
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