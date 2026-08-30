import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/how-to-track-tenant-payments";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "How to Track Tenant Payments | RentFray";

const pageDescription =
  "Learn how to track tenant rent payments accurately, including amounts due, payment dates, outstanding balances, payment status, and recurring monthly records.";

const faqItems = [
  {
    question: "What information should I track for tenant rent payments?",
    answer:
      "At minimum, track the tenant, amount due, due date, payment amount, payment date, payment status, and any remaining balance.",
  },
  {
    question: "Can I track tenant payments with a spreadsheet?",
    answer:
      "Yes. A spreadsheet can work for a small number of tenants if it is updated consistently. As the number of tenants or transactions grows, manual updates and payment reconciliation can become harder to maintain.",
  },
  {
    question: "Should I track payments by tenant or by transaction?",
    answer:
      "Both are useful. Transaction records show individual payment activity, while a tenant-level view makes it easier to understand the current balance and whether anything is still owed.",
  },
  {
    question: "How should I track a payment that is still processing?",
    answer:
      "Keep the payment status separate from the amount submitted. A submitted payment may still be processing, so it should not automatically be treated as a completed payment.",
  },
  {
    question: "How can online rent collection make tracking easier?",
    answer:
      "Using the same system for online collection and payment tracking can reduce the need to manually match deposits, notes, and spreadsheet entries from separate sources.",
  },
  {
    question: "Does RentFray charge landlords a monthly fee?",
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
    type: "article",
    url: pagePath,
    siteName: "RentFray",
    title: pageTitle,
    description:
      "A practical guide to tracking rent payments, balances, payment dates, and payment status by tenant.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Learn a practical system for tracking tenant rent payments and balances.",
  },
};

export default function HowToTrackTenantPaymentsPage() {
  return (
    <>
      <Script
        id="how-to-track-tenant-payments-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="how-to-track-tenant-payments-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Tracking Guide
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How to Track Tenant Payments
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Reliable tenant payment tracking comes down to keeping a clear
            record of what each tenant owes, what they paid, when they paid it,
            the status of the payment, and any balance that remains.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            The method can be as simple as a carefully maintained spreadsheet
            or as structured as dedicated rent tracking software. What matters
            is that the same information is recorded consistently every month.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What You Need to Track
          </h2>

          <p className="mt-4 text-slate-600">
            A useful rent payment record should answer the important questions
            about each tenant account without requiring you to reconstruct the
            month from bank activity, messages, and memory.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant and Unit</h3>
              <p className="mt-2 text-slate-600">
                Identify exactly which tenant and rental unit the payment
                belongs to.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Record the rent amount the tenant is expected to pay for the
                billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Due Date</h3>
              <p className="mt-2 text-slate-600">
                Keep the payment obligation tied to the correct due date and
                monthly cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Amount</h3>
              <p className="mt-2 text-slate-600">
                Record how much the tenant actually submitted or paid.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Date</h3>
              <p className="mt-2 text-slate-600">
                Record when payment activity occurred so the account has a
                useful history.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish between payment activity that is still processing
                and payment that has completed.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                Keep track of what the tenant still owes after completed
                payments are considered.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Billing Cycle</h3>
              <p className="mt-2 text-slate-600">
                Keep each payment and balance associated with the correct
                recurring rent period.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How to Track Tenant Payments Step by Step
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 1: Establish the Amount Due
              </h3>
              <p className="mt-2 text-slate-600">
                Start each billing cycle with a clear record of what the tenant
                owes. Without an amount due, a list of payments cannot tell you
                whether the tenant account is actually current.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 2: Keep Each Tenant Separate
              </h3>
              <p className="mt-2 text-slate-600">
                Organize records by tenant or unit so every payment can be
                matched to the correct account. Avoid relying only on a
                chronological list of deposits.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 3: Record Payment Activity
              </h3>
              <p className="mt-2 text-slate-600">
                Record the amount and date when payment activity occurs. If
                payments can remain in processing, record the status as well
                instead of assuming submission means completion.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 4: Update the Tenant Balance
              </h3>
              <p className="mt-2 text-slate-600">
                Use completed payment activity to determine what remains owed.
                The balance is what turns a payment log into a useful tenant
                account record.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 5: Review Outstanding Accounts
              </h3>
              <p className="mt-2 text-slate-600">
                Review accounts that still show an outstanding balance instead
                of checking every tenant individually to determine who still
                owes rent.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 6: Preserve the Payment History
              </h3>
              <p className="mt-2 text-slate-600">
                Keep prior billing cycles and payment activity available so
                you can review what happened without relying on bank
                statements or old messages.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track the Balance, Not Just the Payment
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              One of the most important differences between a payment log and
              a useful rent tracking system is the tenant balance.
            </p>

            <p>
              Suppose a tenant owes $1,000. Recording a $700 payment tells you
              what happened, but it does not immediately tell you the current
              state of the account unless the remaining $300 balance is also
              tracked.
            </p>

            <p>
              For that reason, tenant-level balances are usually more useful
              for day-to-day rent management than a simple list of
              transactions.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              See how RentFray tracks rent and balances →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Do Not Treat Every Submitted Payment as Completed
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Online payments can move through processing before reaching a
              final result. That makes payment status an important part of
              accurate tenant payment tracking.
            </p>

            <p>
              A submitted payment should not automatically be treated the same
              as a completed payment. Keeping payment status separate helps
              prevent the tenant balance from being interpreted incorrectly
              while a payment is still being processed.
            </p>

            <p>
              The tracking system should make it possible to distinguish
              accounts with no payment activity from accounts where payment
              activity is already underway.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Tracking Tenant Payments With a Spreadsheet
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A spreadsheet can be a workable starting point for a landlord
              with a small number of tenants. Create one row for each tenant
              and maintain consistent columns for the billing cycle, amount
              due, payment amount, payment date, payment status, and remaining
              balance.
            </p>

            <p>
              The main limitation is that a spreadsheet depends on manual
              updates. If a tenant pays through another system, somebody still
              has to verify the transaction and accurately update the
              spreadsheet.
            </p>

            <p>
              As the number of tenants and transactions grows, the amount of
              reconciliation work can grow with it.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link
              href="/spreadsheet-vs-rent-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Spreadsheet vs rent software →
            </Link>

            <Link
              href="/manual-rent-tracking-vs-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Manual tracking vs software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Tracking Payments From Multiple Sources
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payment tracking becomes more complicated when rent arrives
              through several unrelated channels. Checks, cash, transfers, and
              online payment tools may all produce different types of records.
            </p>

            <p>
              If you accept multiple methods, establish one central record and
              update it consistently. Every payment should ultimately be
              matched to the correct tenant account and billing cycle.
            </p>

            <p>
              The alternative is to use a rent collection system that also
              maintains the payment and balance information, reducing the
              amount of manual reconciliation between separate systems.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Records Should Answer Three Questions
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="text-lg font-semibold">What was owed?</p>
              <p className="mt-2 text-slate-600">
                The record needs the tenant's rent obligation for the billing
                cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="text-lg font-semibold">What was paid?</p>
              <p className="mt-2 text-slate-600">
                Payment amount, date, and status provide the transaction
                history.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="text-lg font-semibold">What is still owed?</p>
              <p className="mt-2 text-slate-600">
                The remaining tenant balance tells you whether the account
                still requires attention.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When Dedicated Rent Tracking Software Makes Sense
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Manual tracking can be sufficient when the number of tenants is
              small and payment activity is easy to reconcile. Dedicated
              software becomes more useful when maintaining the records starts
              requiring repeated manual work.
            </p>

            <p>
              The advantage of a dedicated rent system is not simply that the
              records are digital. The larger advantage is connecting the rent
              obligation, tenant payment, payment status, and resulting
              balance in the same workflow.
            </p>

            <p>
              RentFray is designed around that connection. Owners and managers
              can collect rent online while keeping tenant balances and payment
              status visible in the same system.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore RentFray rent tracking software →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Tracking and Online Collection in One System
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray combines online rent collection with tenant balance and
            payment-status tracking, so owners and managers do not need a
            separate monthly software subscription for the business side.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about free rent collection software →
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
            Related Rent Tracking Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/spreadsheet-vs-rent-software"
              className="text-blue-600 hover:underline"
            >
              Spreadsheet vs Rent Software
            </Link>

            <Link
              href="/manual-rent-tracking-vs-software"
              className="text-blue-600 hover:underline"
            >
              Manual Rent Tracking vs Software
            </Link>

            <Link
              href="/rent-billing-system"
              className="text-blue-600 hover:underline"
            >
              Rent Billing System
            </Link>

            <Link
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Ready to Stop Tracking Rent by Hand?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Collect rent online while keeping tenant balances and payment
            status organized in the same system.
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