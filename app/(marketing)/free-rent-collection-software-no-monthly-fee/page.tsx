import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/free-rent-collection-software-no-monthly-fee";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle =
  "Free Rent Collection Software With No Monthly Fee | RentFray";

const pageDescription =
  "RentFray is free rent collection software for landlords and property managers with no monthly software subscription. Tenants pay a processing fee when they submit payments.";

const faqItems = [
  {
    question: "Does RentFray charge a monthly software fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software subscription.",
  },
  {
    question: "Is RentFray free for landlords?",
    answer:
      "Yes. Landlords and property managers can use RentFray without paying a monthly software fee. Tenants pay a processing fee when they submit payments.",
  },
  {
    question: "Are tenant payments completely fee-free?",
    answer:
      "No. Tenants pay a processing fee when they submit payments. RentFray's free pricing applies to the business-side software subscription.",
  },
  {
    question: "Can I collect rent online without paying a monthly software subscription?",
    answer:
      "Yes. RentFray provides landlords and property managers with online rent collection, payment tracking, and balance visibility without a monthly software subscription.",
  },
  {
    question: "What can I do with RentFray?",
    answer:
      "RentFray helps property owners and managers collect rent online, track tenant balances, monitor payment status, and manage recurring rent collection.",
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

export default function FreeRentCollectionSoftwareNoMonthlyFeePage() {
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
              Free Rent Collection Software With No Monthly Fee
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Collect rent online, track tenant payments, and manage recurring
              balances without paying a monthly software subscription.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is free for landlords, property owners, and property
              managers. Tenants pay a processing fee when they submit payments.
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
            What Does &quot;No Monthly Fee&quot; Mean With RentFray?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            RentFray does not charge landlords or property managers a recurring
            monthly software subscription. You can use the platform to organize
            rent collection without adding another monthly software bill to the
            property.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            The distinction is important: the software is free for the business
            side, but tenant payment transactions are not completely fee-free.
            Tenants pay a processing fee when they submit payments.
          </p>

          <p className="mt-4 text-base font-medium leading-8 text-slate-800">
            $0 per month for landlords and property managers. No recurring
            software subscription.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Why Monthly Software Costs Matter to Landlords
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              A monthly property software subscription can be difficult to
              justify when the main problem you are trying to solve is simply
              collecting rent and keeping payment records organized.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Small landlords and owner-managed properties especially may not
              need a large property management suite with dozens of features.
              They may simply need a clear way for tenants to pay, an accurate
              view of balances, and an easier way to see what has and has not
              been paid.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray focuses on that rent collection workflow without charging
              the property business a monthly software subscription.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading>
          Rent Collection Features Without a Monthly Subscription
        </SectionHeading>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <FeatureCard
            title="Collect Rent Online"
            description="Give tenants a clear online payment path instead of relying on checks, cash, or disconnected payment methods."
          />

          <FeatureCard
            title="Track Payment Status"
            description="See what has been paid, what remains due, and which tenant or unit still needs attention."
          />

          <FeatureCard
            title="Track Tenant Balances"
            description="Keep balances visible and organized without depending on a separate spreadsheet as the main record."
          />

          <FeatureCard
            title="Manage Recurring Rent"
            description="Use one consistent workflow for recurring monthly rent instead of rebuilding the process every month."
          />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Free Software Does Not Have to Mean a Manual System
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Many landlords avoid monthly software costs by combining
              spreadsheets, checks, bank transfers, text reminders, and manual
              notes. That can reduce direct software expenses, but it often
              leaves the rent collection process fragmented.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray provides a dedicated rent collection system without
              requiring a monthly subscription from the landlord. Payment
              activity, balances, and recurring rent stay together in one
              workflow.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Who Benefits From No-Monthly-Fee Rent Collection Software?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            RentFray can be useful for property businesses that want dedicated
            rent collection without paying for a larger software subscription.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">Independent Landlords</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Organize recurring rent without adding another monthly operating
                expense.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">Apartment Properties</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Track rent across multiple units with clearer payment and
                balance visibility.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">Mobile Home Parks</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use one recurring rent workflow across multiple tenant spaces.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">RV Parks</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Keep recurring monthly payments organized without another
                software subscription.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">Owner-Managed Properties</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Reduce manual tracking while keeping software overhead low.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">Property Managers</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Maintain clearer payment visibility without a recurring
                RentFray software bill.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Free Rent Collection Software vs. Free Payment Methods
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              A payment method and a rent collection system are not necessarily
              the same thing. A bank transfer or general-purpose payment app can
              move money, but the landlord may still need separate records to
              determine who paid, what remains due, and which balance is current.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Dedicated rent collection software adds structure around the
              payment itself. RentFray combines the payment workflow with tenant
              balances and payment status so the landlord can manage the month
              from one place.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            How RentFray's No-Monthly-Fee Model Works
          </SectionHeading>

          <div className="mt-8 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900">
                1. The property business uses RentFray
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                Landlords and property managers set up their property and manage
                rent collection without paying a monthly software subscription.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                2. Tenants use the online payment flow
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                Tenants submit their rent payments through RentFray's online
                payment process.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                3. Tenants pay the processing fee
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The processing fee is paid by the tenant when the payment is
                submitted rather than through a monthly RentFray software
                subscription charged to the landlord.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                4. The property tracks rent in one system
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                Owners and managers can monitor payment status and tenant
                balances from the same recurring rent collection workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>Frequently Asked Questions</SectionHeading>

            <div className="mt-8 space-y-4">
              {faqItems.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>Related Rent Collection Resources</SectionHeading>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/free-rent-collection-software"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Free Rent Collection Software
            </Link>

            <Link
              href="/no-fee-rent-collection-system"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              No-Fee Rent Collection
            </Link>

            <Link
              href="/collect-rent-online"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Online Rent Payment System
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Collect and track rent without a monthly RentFray software
              subscription.
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray is $0 per month for landlords and property managers.
              Tenants pay a processing fee when they submit payments.
            </p>

            <div className="mt-8">
              <Link
                href="/setup"
                className="inline-block rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Start Free Setup
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}