import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://rentfray.com";
const pagePath = "/online-rent-payment-system";
const pageUrl = `${siteUrl}${pagePath}`;
const pageTitle =
  "Free Online Rent Payment System for Landlords and Property Managers | RentFray";
const pageDescription =
  "Free online rent payment system for landlords and property managers. Collect rent, track tenant payments, and manage billing with no software cost. Built for apartments, mobile home parks, and RV parks.";

const faqItems = [
  {
    question: "How can I collect rent online?",
    answer:
      "RentFray allows landlords and property managers to collect rent through a centralized online payment system that tenants can access anytime.",
  },
  {
    question: "Is RentFray free for landlords and property managers?",
    answer:
      "Yes. RentFray is free for businesses. Tenants pay a small processing fee when making payments.",
  },
  {
    question: "What is the best way to track tenant payments?",
    answer:
      "Using a system like RentFray provides a clear view of all payments, balances, and due amounts in one place.",
  },
  {
    question: "Is there an affordable way to collect rent online?",
    answer:
      "Yes. RentFray offers a free system for businesses, making it one of the most affordable ways to manage rent collection.",
  },
] as const;

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

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RentFray",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: pageUrl,
  description: pageDescription,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RentFray",
  url: siteUrl,
};

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    siteName: "RentFray",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
      {children}
    </h2>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

export default function OnlineRentPaymentSystemPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              RentFray
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Free Online Rent Payment System for Landlords and Property
              Managers
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Stop chasing rent. Start collecting it with a system designed for
              clarity, accuracy, and simplicity.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Get Started
              </Link>
              <Link
                href="/rent-collection-software-landlords"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                For Landlords
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>A Clear Way to Collect and Track Rent</SectionHeading>
          <p className="mt-5 text-base leading-8 text-slate-600">
            RentFray gives property owners and managers a direct way to collect
            rent online and track every payment in real time. No spreadsheets,
            no manual tracking, and no confusion about who has paid and who has
            not.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>Built for Property-Based Businesses</SectionHeading>
            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray is designed specifically for property-based businesses
              that need simple, structured rent collection with clear payment
              tracking.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-800">
              Apartment complexes
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-800">
              Rental housing
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-800">
              Mobile home parks
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-800">
              RV parks
            </div>
          </div>

          <p className="mt-8 max-w-4xl text-base leading-8 text-slate-600">
            It also supports other recurring-payment businesses like storage
            facilities and vehicle financing operations, while keeping the core
            experience focused on rent collection.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading>Everything You Need to Manage Rent</SectionHeading>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Collect Rent Online"
            description="Tenants pay through a simple, guided payment flow designed to reduce friction and increase completion."
          />
          <FeatureCard
            title="Track Payments in Real Time"
            description="See exactly who has paid, who has not, and what is due across all units."
          />
          <FeatureCard
            title="Clear, Accurate Totals"
            description="All balances, fees, and totals are visible and consistent across the system."
          />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>No Software Cost for Businesses</SectionHeading>
            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray is free for property owners and managers. There are no
              monthly platform fees or subscriptions. Tenants pay a small
              processing fee when submitting payments.
            </p>
            <p className="mt-4 text-base leading-8 text-slate-600">
              This provides a more affordable alternative to traditional rent
              collection software without sacrificing functionality or
              visibility.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>Designed for Simplicity and Control</SectionHeading>
          <p className="mt-5 text-base leading-8 text-slate-600">
            RentFray removes unnecessary complexity while giving managers full
            visibility into payment activity. Every transaction is clearly
            tracked, and every unit has a defined payment status.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Know Exactly What Is Paid and What Is Not
            </SectionHeading>

            <ul className="mt-6 space-y-3 text-base leading-8 text-slate-600">
              <li>Real-time payment status</li>
              <li>Clear due amounts</li>
              <li>Consistent tracking across all units</li>
            </ul>

            <p className="mt-6 text-base leading-8 text-slate-600">
              No guessing, no delays, and no hidden calculations.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading>Frequently Asked Questions</SectionHeading>

        <div className="mt-8 space-y-4">
          {faqItems.map((item) => (
            <div
              key={item.question}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {item.question}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Collect rent with clarity, accuracy, and full visibility using
              RentFray.
            </h2>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Start Setup
              </Link>
              <Link
                href="/online-rent-payment-system-apartments"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apartment Page
              </Link>
              <Link
                href="/rent-collection-software-landlords"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Landlord Page
              </Link>
              <Link
                href="/mobile-home-park-rent-collection"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Mobile Home Parks
              </Link>
              <Link
                href="/rv-park-rent-collection"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                RV Parks
              </Link>
              <Link
                href="/self-storage-payment-system"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Self Storage
              </Link>
              <Link
                href="/buy-here-pay-here-payment-system"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Car Lots
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}