import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/how-to-collect-rent-online";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "How to Collect Rent Online | RentFray";

const pageDescription =
  "Learn how to collect rent online with a simple, organized process. See how landlords and property managers can reduce manual tracking and manage recurring rent with RentFray.";

const faqItems = [
  {
    question: "How can landlords collect rent online?",
    answer:
      "Landlords can use an online rent collection system that gives tenants a clear payment path and gives the property a way to track payment status and balances.",
  },
  {
    question: "What is the easiest way to collect rent online?",
    answer:
      "A simple system with one payment process, clear tenant balances, and organized payment tracking is usually easier to manage than combining checks, spreadsheets, texts, and separate payment apps.",
  },
  {
    question: "Can RentFray replace manual rent tracking?",
    answer:
      "RentFray can reduce the need for manual tracking by keeping recurring rent, payment status, and tenant balances together in one system.",
  },
  {
    question: "Does RentFray charge landlords a monthly software fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software subscription. Tenants pay a processing fee when they submit payments.",
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

export default function HowToCollectRentOnlinePage() {
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
              How to Collect Rent Online
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Moving rent collection online can make the monthly process easier
              for both landlords and tenants when the system is simple,
              organized, and easy to repeat.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              The goal is not just to move money electronically. A good online
              rent collection process should also help you know who paid, what
              remains due, and what needs attention.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/collect-rent-online"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Collect Rent Online
              </Link>

              <Link
                href="/free-rent-collection-software"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                View Free Rent Collection Software
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What You Need to Collect Rent Online
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            At a minimum, an online rent collection process needs a reliable way
            for tenants to submit payments and a clear way for the property to
            keep track of those payments.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            The strongest setup goes one step further by connecting the payment
            process to tenant balances and recurring rent records. That reduces
            the need to manually compare bank activity, spreadsheets, texts, and
            other records every month.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 1: Choose One Consistent Payment Process
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Tenants should not have to guess how rent is supposed to be paid
              each month. A consistent payment process reduces confusion and
              makes it easier for the property to maintain clean records.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Instead of accepting different payment methods through unrelated
              channels, a dedicated rent collection system gives tenants one
              clear place to submit rent and gives the landlord one place to
              review the result.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Step 2: Connect Payments to Tenant Balances
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Accepting money online solves only part of the problem. The property
            still needs to know which tenant paid, how much was owed, and
            whether any balance remains.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A structured rent collection system should make that information
            visible without requiring the landlord to manually rebuild the
            payment history in a spreadsheet.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 3: Track Payment Status
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Online payments can have different statuses during processing.
              Being able to distinguish between completed, pending, failed, and
              unpaid rent helps the property understand what is actually
              happening.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is designed to keep payment status and tenant balances
              visible so owners and managers can quickly see what needs
              attention.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Step 4: Use the Same Workflow Every Month
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Rent is recurring, so the collection process should be recurring too.
            A good system should reduce the amount of work that has to be
            recreated at the beginning of every rent cycle.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Keeping recurring rent, balances, and payment activity together
            creates a more consistent process for both the landlord and the
            tenant.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Step 5: Keep the Tenant Experience Simple
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              A system can be powerful for the landlord and still fail if it is
              confusing for tenants. The payment process should be easy to
              understand and should not require unnecessary steps.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is designed around a straightforward tenant payment flow
              while giving the property the visibility it needs on the
              management side.
            </p>

            <div className="mt-6">
              <Link
                href="/how-tenants-pay-rent-online"
                className="font-semibold text-slate-900 underline underline-offset-4"
              >
                See how tenants pay rent online
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Online Rent Collection vs. Manual Rent Tracking
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Many landlords collect rent successfully with checks, bank
            transfers, spreadsheets, and manual records. The problem is that
            each additional tool creates another place where information has to
            be checked or updated.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Online rent collection becomes especially useful when the payment
            process and the tracking process are connected. Instead of recording
            the same information in several places, the property can manage the
            recurring workflow from one system.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/manual-rent-tracking-vs-software"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Manual Tracking vs. Software
            </Link>

            <Link
              href="/spreadsheet-vs-rent-software"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Spreadsheet vs. Rent Software
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
              RentFray combines online rent collection with payment status and
              tenant balance tracking. It is designed for landlords and
              property managers who want a focused rent collection system rather
              than a large property management suite.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Payment processing is handled through Stripe. RentFray does not
              store tenant banking information or hold tenant funds.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is $0 per month for landlords and property managers.
              Tenants pay a processing fee when they submit payments.
            </p>
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
            <SectionHeading>Related Rent Collection Resources</SectionHeading>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/collect-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Collect Rent Online
              </Link>

              <Link
                href="/best-way-to-collect-rent"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Best Way to Collect Rent
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Online Rent Payment System
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

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Want to start collecting rent online?
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray gives landlords and property managers an organized way
              to collect rent online and track payment status without a monthly
              software subscription.
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