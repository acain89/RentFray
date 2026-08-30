import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/no-fee-rent-collection-system";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle =
  "No-Fee Rent Collection for Landlords | No Monthly Software Fee | RentFray";

const pageDescription =
  "Looking for rent collection with no monthly software fee? RentFray is free for landlords and property managers. Tenants pay a processing fee when they submit payments.";

const faqItems = [
  {
    question: "Does RentFray charge landlords a monthly fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software fee.",
  },
  {
    question: "Is RentFray completely fee-free?",
    answer:
      "RentFray is free for the business side, but tenant payments are not completely fee-free. Tenants pay a processing fee when they submit payments.",
  },
  {
    question: "Who pays the RentFray processing fee?",
    answer:
      "Tenants pay the processing fee when they submit rent payments. The landlord or property business does not pay a monthly software subscription.",
  },
  {
    question: "Can landlords collect rent online without paying for software?",
    answer:
      "Yes. RentFray gives landlords and property managers an online rent collection system without a monthly software charge to the business.",
  },
  {
    question: "What can landlords track with RentFray?",
    answer:
      "RentFray helps landlords and property managers track tenant balances, payment status, amounts due, and recurring rent collection in one system.",
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

export default function NoFeeRentCollectionSystemPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              RentFray
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              No Monthly Software Fee for Landlords Collecting Rent Online
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              RentFray gives landlords and property managers a structured online
              rent collection system without charging the business a monthly
              software fee.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments, so
              &quot;no fee&quot; does not mean that every transaction is
              completely fee-free. It means landlords and property businesses
              can use RentFray without paying a monthly software subscription.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Start Free Setup
              </Link>

              <Link
                href="/free-rent-collection-software"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Free Rent Collection Software
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What Does &quot;No-Fee Rent Collection&quot; Actually Mean?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            When landlords search for a no-fee rent collection system, they are
            often trying to avoid another monthly software bill. They want a
            better way to collect and track rent without paying for a large
            property management platform every month.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            That distinction matters. A rent collection platform can be free
            for the landlord without every payment transaction being free.
            RentFray uses that model: property owners and managers do not pay a
            monthly software fee, while tenants pay a processing fee when they
            submit payments.
          </p>

          <p className="mt-4 text-base font-medium leading-8 text-slate-800">
            The business gets the rent collection software without another
            recurring software subscription.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Why the Difference Between Software Fees and Payment Fees Matters
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              &quot;Free&quot; can mean different things in payment software.
              Some platforms charge the property business a subscription. Some
              charge transaction fees. Some use a combination of both.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray keeps the pricing model straightforward for the property
              business: there is no monthly software subscription for landlords
              or property managers. Tenants pay a processing fee when they make
              their payments.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              That allows the landlord to move away from checks, spreadsheets,
              scattered records, and manual payment tracking without replacing
              those problems with another recurring software expense.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading>
          What Landlords Get Without a Monthly Software Fee
        </SectionHeading>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Online Rent Collection</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Give tenants one clear online path for submitting their rent
              payments.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Payment Status Tracking</h3>
            <p className="mt-3 leading-7 text-slate-600">
              See which payments have been made and which tenants or units still
              need attention.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Clear Tenant Balances</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Keep amounts due and tenant balances organized instead of
              reconstructing the month from separate records.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Recurring Rent Management</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Use one consistent system for the recurring monthly rent cycle.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              No Monthly Subscription Does Not Have to Mean Manual Rent Tracking
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Avoiding software subscriptions often pushes landlords toward
              spreadsheets, checks, cash, bank transfers, or generic payment
              apps. Those methods can avoid a monthly software bill, but they
              can also leave the landlord responsible for matching payments,
              updating records, and figuring out who still owes money.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is designed to provide another option: a dedicated rent
              collection system that organizes the recurring payment workflow
              while remaining free for the property business to use.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Who Is No-Monthly-Fee Rent Collection Useful For?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            The model can be especially useful for landlords and property
            operators that want dedicated rent collection without paying for a
            larger all-in-one property management suite.
          </p>

          <ul className="mt-6 space-y-3 text-base leading-8 text-slate-600">
            <li>Small and independent landlords</li>
            <li>Apartment owners and property managers</li>
            <li>Mobile home park operators</li>
            <li>RV park operators</li>
            <li>Other recurring-payment property businesses</li>
          </ul>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              No Monthly Software Fee, With a Clear Rent Collection Workflow
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              The goal is not simply to avoid paying for software. The goal is
              to make rent collection easier to manage without adding another
              monthly operating expense.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray combines online tenant payments, balance visibility, and
              payment tracking in one focused system. Property owners and
              managers use the software without a monthly subscription, while
              tenants pay a processing fee when they submit payments.
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
              Collect rent online without adding a monthly software subscription
              to your property business.
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              Start using RentFray for $0 per month on the business side.
              Tenants pay a processing fee when they submit payments.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Start Free Setup
              </Link>

              <Link
                href="/free-rent-collection-software"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Free Rent Collection Software
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Online Rent Payment System
              </Link>

              <Link
                href="/rent-collection-software-landlords"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Rent Collection for Landlords
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}