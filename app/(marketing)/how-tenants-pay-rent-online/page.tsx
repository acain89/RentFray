import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/how-tenants-pay-rent-online";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "How Tenants Pay Rent Online | RentFray";

const pageDescription =
  "Learn how tenants pay rent online with a simple recurring process. See how RentFray connects tenant payments with payment status and balance tracking for landlords and property managers.";

const faqItems = [
  {
    question: "How do tenants pay rent online with RentFray?",
    answer:
      "Tenants use RentFray's online payment flow to review what they owe and submit their rent payment through the web.",
  },
  {
    question: "Do tenants need to install an app?",
    answer:
      "No separate app is required. Tenants can use RentFray through a web browser.",
  },
  {
    question: "What happens after a tenant submits payment?",
    answer:
      "The payment is processed through Stripe, and the property can track the payment status and tenant balance from the management side.",
  },
  {
    question: "Does RentFray store tenant banking information?",
    answer:
      "No. RentFray does not store tenant banking information or hold tenant funds. Payment processing is handled through Stripe.",
  },
  {
    question: "Do tenants pay a processing fee?",
    answer:
      "Yes. Tenants pay a processing fee when they submit payments through RentFray.",
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
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    siteName: "RentFray",
    type: "article",
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

export default function HowTenantsPayRentOnlinePage() {
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
              RentFray Guide
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              How Tenants Pay Rent Online
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Online rent payment should be a straightforward recurring process:
              the tenant sees what is owed, submits payment, and the property can
              track what happened.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is designed to keep that process simple for the tenant
              while giving landlords and property managers clear payment and
              balance visibility.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tenant-online-rent-payments"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Tenant Online Rent Payments
              </Link>

              <Link
                href="/tenant-payment-portal"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            The Basic Online Rent Payment Process
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            The exact details can vary by rent collection system, but the basic
            process should be simple. The tenant accesses the payment system,
            reviews the amount due, submits payment, and receives a clear result.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            On the property side, the payment should connect back to the tenant's
            recurring rent record so the landlord does not have to manually
            piece together what happened.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 1: The Tenant Accesses the Rent Payment System
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              The first step is simply getting to the correct payment flow.
              Tenants should have one clear place to go when rent is due instead
              of trying to remember which payment method or account to use.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is web-based, so tenants do not need to install a separate
              mobile app just to make a rent payment.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Step 2: The Tenant Sees What Is Owed
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Before submitting payment, the tenant should be able to understand
            the amount that needs to be paid.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Connecting the tenant payment flow to the property's rent records
            helps reduce confusion about balances and gives both sides a clearer
            understanding of the current amount due.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 3: The Tenant Submits Payment
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              The tenant follows the online payment flow and submits the rent
              payment through RentFray.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Payment processing is handled through Stripe. RentFray does not
              store tenant banking information or hold tenant funds.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Step 4: The Payment Receives a Status
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Submitting an online payment does not always mean the payment is
            instantly complete. Payments can move through processing states
            before they are finalized.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray tracks payment status so the property can distinguish
            between payments that have completed, payments that are still
            processing, and payments that have failed.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 5: The Landlord Sees the Result
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              The management side of the system gives the landlord or property
              manager visibility into the tenant's payment status and remaining
              balance.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              That connection between the payment and the rent record is what
              makes a dedicated rent collection system different from simply
              receiving money through an unrelated payment service.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Step 6: The Process Repeats Next Month
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Rent is recurring, so an online rent payment system should make the
            next month's process familiar rather than forcing the tenant and
            landlord to start over.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A consistent recurring workflow makes it easier for tenants to know
            what to do and easier for the property to review the month's
            payment activity.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              What the Landlord Sees vs. What the Tenant Sees
            </SectionHeading>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Tenant Side
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  The tenant focuses on the amount owed and the payment process.
                  The goal is to keep the experience direct and easy to
                  understand.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Property Side
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  The landlord or manager focuses on balances, payment status,
                  and which tenants or units still require attention.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why Online Rent Payment Is More Than Moving Money
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            There are many ways to send money electronically. The important
            difference with rent is that the payment belongs to a recurring
            obligation that the property has to track every month.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A rent-focused system connects the transaction to the tenant balance
            and payment record. That reduces the amount of manual reconciliation
            needed after the payment is submitted.
          </p>

          <div className="mt-6">
            <Link
              href="/tenant-rent-payment-options"
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Compare tenant rent payment options
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              How RentFray Fits Into the Process
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray combines the tenant payment flow with landlord-side
              payment status and balance tracking.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              It is $0 per month for landlords and property managers. Tenants
              pay a processing fee when they submit payments.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/tenant-online-rent-payments"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Online Rent Payments
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Online Rent Payment System
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>Frequently Asked Questions</SectionHeading>

          <div className="mt-8 space-y-4">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-slate-200 bg-white p-6"
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
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>Related Tenant Payment Resources</SectionHeading>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/tenant-online-rent-payments"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Online Rent Payments
              </Link>

              <Link
                href="/tenant-payment-portal"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>

              <Link
                href="/tenant-rent-payment-options"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Rent Payment Options
              </Link>

              <Link
                href="/easiest-way-for-tenants-to-pay-rent"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Easiest Way for Tenants to Pay Rent
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Want to offer tenants online rent payments?
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray gives tenants a web-based payment flow while giving
              landlords and property managers visibility into payment status and
              balances.
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