import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/how-to-manage-rent-without-software";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "How to Manage Rent Without Software | RentFray";

const pageDescription =
  "Learn how to manage rent without software using a simple manual system for tenant records, amounts due, payments, balances, receipts, and monthly reconciliation.";

const faqItems = [
  {
    question: "Can I manage rent without property management software?",
    answer:
      "Yes. A landlord can manage rent manually with a consistent system for tenant records, rent amounts, payment dates, balances, receipts, and monthly reconciliation.",
  },
  {
    question: "What do I need to track if I manage rent manually?",
    answer:
      "At minimum, track each tenant or unit, the amount due, due date, payment amount, payment date, payment method, and remaining balance.",
  },
  {
    question: "Can I use a spreadsheet to manage rent?",
    answer:
      "Yes. A spreadsheet can be a practical way to organize manual rent records, especially for a small number of tenants.",
  },
  {
    question: "How should I keep proof of rent payments?",
    answer:
      "Keep consistent payment records and receipts or transaction confirmations so each recorded payment can be tied back to supporting documentation.",
  },
  {
    question: "When does manual rent management become difficult?",
    answer:
      "Manual management becomes harder when payments come through several sources, balances require frequent reconciliation, the number of tenants grows, or records become difficult to keep current.",
  },
  {
    question: "Does RentFray charge landlords a monthly software fee?",
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
      "A practical guide to managing rent manually without property management software.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Learn how to manage tenant rent records manually without property management software.",
  },
};

export default function HowToManageRentWithoutSoftwarePage() {
  return (
    <>
      <Script
        id="how-to-manage-rent-without-software-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="how-to-manage-rent-without-software-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Manual Rent Management Guide
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How to Manage Rent Without Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            You do not need property management software to manage rent
            successfully. A small rental operation can be managed with a
            consistent manual system for amounts due, payments, balances, and
            records.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            The key is consistency. Every tenant should be tracked the same
            way, every payment should be recorded, and the records should be
            reconciled regularly.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What You Need to Manage Rent Manually
          </h2>

          <p className="mt-4 text-slate-600">
            A basic manual rent-management system should keep the following
            information organized for every tenant or unit.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant and Unit</h3>
              <p className="mt-2 text-slate-600">
                Keep each tenant tied to the correct rental unit.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Monthly Rent Amount</h3>
              <p className="mt-2 text-slate-600">
                Record the recurring amount the tenant is expected to pay.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Due Date</h3>
              <p className="mt-2 text-slate-600">
                Keep the due date visible so each payment can be tied to the
                correct billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Amount and Date</h3>
              <p className="mt-2 text-slate-600">
                Record what the tenant paid and when the payment was received.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Method</h3>
              <p className="mt-2 text-slate-600">
                Note whether the payment was made by check, cash, transfer, or
                another method.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                Track what is still owed after payments are applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How to Manage Rent Without Software Step by Step
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 1: Create One Master Tenant Record
              </h3>
              <p className="mt-2 text-slate-600">
                Keep one central record containing every tenant, unit, rent
                amount, due date, and current balance. A spreadsheet works well
                for this because it can be updated and sorted easily.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 2: Assign Each Payment to a Billing Cycle
              </h3>
              <p className="mt-2 text-slate-600">
                Do not record payments only as a running list. Identify which
                month's rent or billing period each payment applies to.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 3: Record Payments Consistently
              </h3>
              <p className="mt-2 text-slate-600">
                Enter every payment using the same fields: tenant, amount,
                date, method, and billing cycle. Consistency makes records much
                easier to review later.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 4: Keep Supporting Payment Records
              </h3>
              <p className="mt-2 text-slate-600">
                Keep receipts, deposit records, check information, or
                transaction confirmations so payments recorded in your master
                record can be verified.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 5: Update the Remaining Balance
              </h3>
              <p className="mt-2 text-slate-600">
                After recording a payment, update the amount still owed. This
                makes it easier to see which tenant accounts still require
                attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Step 6: Reconcile the Records Regularly
              </h3>
              <p className="mt-2 text-slate-600">
                Compare the master record with actual payment or deposit
                records. Correct differences before they carry into another
                billing cycle.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Simple Rent Spreadsheet Can Be Enough
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              If you manage only a small number of units, a spreadsheet can
              serve as the main rent ledger.
            </p>

            <p>
              A simple sheet might include columns for:
            </p>
          </div>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• Tenant name</li>
            <li>• Unit number</li>
            <li>• Billing month</li>
            <li>• Rent due</li>
            <li>• Due date</li>
            <li>• Amount paid</li>
            <li>• Payment date</li>
            <li>• Payment method</li>
            <li>• Remaining balance</li>
            <li>• Notes</li>
          </ul>

          <p className="mt-5 text-slate-600">
            The limitation is that the spreadsheet has to be updated manually.
            It does not automatically know when money is received or whether
            your payment records and tenant balances still match.
          </p>

          <div className="mt-5">
            <Link
              href="/spreadsheet-vs-rent-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare spreadsheets with rent software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep One Source of Truth
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Manual rent management becomes harder when important information
              is split between a spreadsheet, text messages, bank activity,
              paper notes, and memory.
            </p>

            <p>
              Pick one master record and treat everything else as supporting
              documentation.
            </p>

            <p>
              If a tenant sends a message about a partial payment, update the
              master record. If a check clears, update the master record. If a
              balance changes, update the master record.
            </p>

            <p>
              That reduces the chance of conflicting records later.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How to Handle Different Payment Methods
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Checks</h3>
              <p className="mt-2 text-slate-600">
                Record the amount, date received, tenant, billing cycle, and
                any useful check reference information. Keep deposit records
                for reconciliation.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Cash</h3>
              <p className="mt-2 text-slate-600">
                Create a consistent receipt record and update the tenant
                account immediately so there is a written record of the
                transaction.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Bank Transfers</h3>
              <p className="mt-2 text-slate-600">
                Match the transaction to the correct tenant and billing cycle,
                then update the master record and resulting balance.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Online Payment Services</h3>
              <p className="mt-2 text-slate-600">
                Save enough transaction information to verify the payment and
                update the tenant record consistently.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track What Is Still Owed, Not Just What Was Paid
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A common weakness in manual systems is tracking payment activity
              without maintaining a current tenant balance.
            </p>

            <p>
              If the tenant owes $1,000 and pays $750, the important
              management information is not only that a $750 payment occurred.
              It is also that $250 remains outstanding.
            </p>

            <p>
              Keeping the remaining balance visible makes the manual record
              much more useful for day-to-day management.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/how-to-track-tenant-payments"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn how to track tenant payments →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Reconcile Your Rent Records
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Manual records need to be checked against the payment evidence
              periodically.
            </p>

            <p>
              Compare recorded payments with bank deposits, checks,
              transaction confirmations, or other supporting records. Make
              sure the tenant, amount, billing cycle, and resulting balance all
              agree.
            </p>

            <p>
              Regular reconciliation is easier than discovering months later
              that a payment was entered incorrectly or never recorded.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When Managing Rent Without Software Works Well
          </h2>

          <p className="mt-4 text-slate-600">
            A manual system can remain practical when:
          </p>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• You have a small number of tenants.</li>
            <li>• Rent amounts and due dates are straightforward.</li>
            <li>• Payments come through a limited number of methods.</li>
            <li>• Records are updated immediately and consistently.</li>
            <li>• Reconciliation takes very little time.</li>
            <li>• Outstanding balances are easy to identify.</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Signs the Manual System Is Becoming Too Much Work
          </h2>

          <p className="mt-4 text-slate-600">
            Manual rent management may be reaching its practical limit if:
          </p>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• You regularly forget or delay updating records.</li>
            <li>• You need to check several places to confirm one payment.</li>
            <li>• Tenant balances frequently require corrections.</li>
            <li>• The number of units makes reconciliation time-consuming.</li>
            <li>• Payment status is difficult to determine quickly.</li>
            <li>
              • You are spending meaningful time transferring information from
              payment systems into tracking records.
            </li>
          </ul>

          <p className="mt-5 text-slate-600">
            At that point, dedicated rent software may reduce the amount of
            manual work required to keep the same information accurate.
          </p>

          <div className="mt-5">
            <Link
              href="/manual-rent-tracking-vs-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare manual rent tracking with software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            You Do Not Need a Full Property Management Suite
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              If manual rent management becomes too cumbersome, the next step
              does not have to be a large all-in-one property management
              platform.
            </p>

            <p>
              A focused rent system can handle the narrower problem of
              recurring rent, online collection, payment status, and tenant
              balances without requiring a landlord to adopt unrelated
              property-management features.
            </p>

            <p>
              RentFray is designed around that narrower use case.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            If You Outgrow the Manual System
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray combines online rent collection, recurring rent, tenant
            balances, and payment-status tracking in one focused system.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore rent tracking software →
            </Link>

            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore free rent collection software →
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
            Related Rent Management Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/how-to-track-tenant-payments"
              className="text-blue-600 hover:underline"
            >
              How to Track Tenant Payments
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
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/rent-collection-software-alternative"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software Alternative
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Ready for a Simpler Rent Workflow?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            If manual tracking is becoming more work than you want to maintain,
            RentFray gives owners and managers a focused way to collect and
            track rent without a monthly software fee.
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