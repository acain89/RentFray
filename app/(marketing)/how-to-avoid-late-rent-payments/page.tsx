import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/how-to-avoid-late-rent-payments";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "How to Avoid Late Rent Payments | RentFray";

const pageDescription =
  "Learn practical ways to reduce late rent payments, including clear due dates, consistent payment methods, reminders, payment tracking, and early follow-up.";

const faqItems = [
  {
    question: "How can landlords reduce late rent payments?",
    answer:
      "Landlords can reduce avoidable lateness by keeping due dates clear, using a consistent payment process, communicating expectations, tracking payment status accurately, and following up promptly when rent is not received.",
  },
  {
    question: "Do payment reminders help reduce late rent?",
    answer:
      "They can. A clear reminder before or near the due date can help tenants who simply forgot, but reminders do not solve every cause of late payment.",
  },
  {
    question: "Does online rent collection prevent late payments?",
    answer:
      "No system can guarantee on-time payment, but online collection can remove some friction by giving tenants a consistent payment path and giving landlords clearer visibility into payment activity.",
  },
  {
    question: "Should landlords accept multiple rent payment methods?",
    answer:
      "Multiple methods can provide flexibility, but they can also make tracking and reconciliation more complicated. A consistent primary payment process is generally easier to manage.",
  },
  {
    question: "Why is payment status important when managing late rent?",
    answer:
      "A tenant who has submitted a payment that is still processing is in a different situation from a tenant with no payment activity. Clear status helps landlords respond appropriately.",
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
      "Practical ways landlords can reduce avoidable late rent payments and improve monthly payment follow-up.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Learn practical ways to reduce late rent and improve rent payment follow-up.",
  },
};

export default function HowToAvoidLateRentPaymentsPage() {
  return (
    <>
      <Script
        id="how-to-avoid-late-rent-payments-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="how-to-avoid-late-rent-payments-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Collection Guide
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How to Avoid Late Rent Payments
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            No landlord can completely eliminate late rent. Tenants may pay
            late because of income problems, emergencies, forgetfulness,
            disputes, or other circumstances outside the payment system itself.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            What landlords can do is reduce avoidable friction, make payment
            expectations clear, keep accurate records, and identify unpaid rent
            quickly enough to follow up consistently.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Start With a Clear Rent Due Date
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Tenants should know exactly when rent is due and how the payment
              schedule works.
            </p>

            <p>
              Keep the due date consistent with the lease or rental agreement
              and avoid creating informal payment expectations that conflict
              with the written terms.
            </p>

            <p>
              If a grace period applies, keep that distinction clear as well:
              the rent due date and the end of a grace period are not
              necessarily the same thing.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Use a Consistent Payment Process
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A consistent payment process makes the monthly routine easier for
              both the tenant and the landlord.
            </p>

            <p>
              If tenants are regularly switching between checks, cash,
              transfers, payment apps, and other arrangements, it becomes
              harder to know whether a payment has been submitted and harder
              to keep the records current.
            </p>

            <p>
              Providing one primary payment path can reduce that uncertainty
              while still allowing other methods when needed.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/best-way-to-collect-rent"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare ways to collect rent →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Make It Easy for Tenants to Know How to Pay
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Avoid making tenants search through old messages or ask where a
              payment should be sent each month.
            </p>

            <p>
              The payment instructions should be consistent and easy to find.
              If you use an online system, tenants should have a clear path to
              the payment page and should understand which property or account
              they are paying.
            </p>

            <p>
              This will not prevent financial hardship, but it can remove
              unnecessary delay caused by an unclear payment process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Send Clear, Consistent Reminders
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A reminder can help when a tenant simply forgot or lost track of
              the date.
            </p>

            <p>
              Keep reminders factual and consistent. State the amount due, the
              due date, and how the tenant can pay rather than sending a vague
              message that requires another conversation.
            </p>

            <p>
              Avoid relying on reminders as the only thing holding the payment
              process together. They should reinforce the rent schedule, not
              replace it.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track Payment Status, Not Just Deposits
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              One of the easiest ways to create unnecessary late-payment
              confusion is to treat every account with no completed deposit as
              the same.
            </p>

            <p>
              A tenant may have submitted an online payment that is still
              processing. Another tenant may have no payment activity at all.
              Those situations should be distinguishable.
            </p>

            <p>
              Clear payment-status tracking helps landlords know which
              accounts actually need follow-up.
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
            Keep Tenant Balances Current
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Late-rent follow-up becomes much easier when you know exactly what
              the tenant still owes.
            </p>

            <p>
              A tenant who paid part of the rent has a different account status
              from a tenant who paid nothing. The remaining balance should be
              visible without having to recalculate the account from scratch.
            </p>

            <p>
              Keeping balances current also reduces the risk of contacting a
              tenant with an incorrect amount.
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
            Follow Up Early When Rent Is Missing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Once the applicable due date or grace-period rules have passed,
              do not let an unpaid balance sit unnoticed.
            </p>

            <p>
              Prompt follow-up helps establish whether the payment was missed,
              delayed, submitted through another method, or affected by a
              larger tenant issue.
            </p>

            <p>
              Early communication can also prevent a small recordkeeping
              problem from turning into a much larger reconciliation problem
              later in the month.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep the Process Consistent From Tenant to Tenant
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rent collection process becomes harder to manage when every
              tenant has a different informal arrangement.
            </p>

            <p>
              Consistent payment instructions, recordkeeping, and follow-up
              make it easier to understand what happened each month.
            </p>

            <p>
              Any exceptions should still be documented so your records reflect
              the actual agreement or payment activity.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Avoid Confusing the Due Date With the Payment Method
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Changing from checks to an online payment system does not change
              when rent is due.
            </p>

            <p>
              The payment method is simply the mechanism tenants use to submit
              money. The rent obligation still comes from the lease, rental
              agreement, and applicable rules.
            </p>

            <p>
              Keeping that distinction clear helps prevent software or payment
              instructions from accidentally creating conflicting
              expectations.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Common Causes of Late Rent That Software Cannot Fix
          </h2>

          <p className="mt-4 text-slate-600">
            A better payment system can reduce friction, but it cannot solve
            every reason rent is late.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Income Shortfalls</h3>
              <p className="mt-2 text-slate-600">
                A tenant may simply not have enough money available by the due
                date.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Unexpected Expenses</h3>
              <p className="mt-2 text-slate-600">
                Emergencies or sudden expenses can affect a tenant's ability to
                pay on schedule.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Disputes</h3>
              <p className="mt-2 text-slate-600">
                A payment may be delayed because of a disagreement unrelated to
                the payment method itself.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Intentional Nonpayment</h3>
              <p className="mt-2 text-slate-600">
                No payment platform can force a tenant to submit rent.
              </p>
            </div>
          </div>

          <p className="mt-5 text-slate-600">
            This is why online rent collection should be treated as a tool for
            reducing administrative friction and improving visibility—not as a
            guarantee against late rent.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Practical Late-Rent Prevention Checklist
          </h2>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• Keep the rent due date clear and consistent.</li>
            <li>• Give tenants a clear primary payment method.</li>
            <li>• Make payment instructions easy to find.</li>
            <li>• Send consistent reminders when appropriate.</li>
            <li>• Track payment status accurately.</li>
            <li>• Keep remaining tenant balances current.</li>
            <li>• Follow up promptly when rent remains unpaid.</li>
            <li>• Document exceptions and payment arrangements.</li>
            <li>• Reconcile records so follow-up is based on accurate data.</li>
          </ul>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            How RentFray Can Help With the Payment Process
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray gives property owners and managers a consistent online
            rent collection workflow with recurring rent, tenant balances, and
            payment-status tracking.
          </p>

          <p className="mt-3 text-slate-600">
            Payments are processed through Stripe. RentFray does not store
            tenant banking information or hold tenant funds.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray cannot guarantee that a tenant will pay on time, but it
            can reduce payment-process friction and give landlords a clearer
            picture of payment activity and outstanding balances.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link
              href="/collect-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn how to collect rent online →
            </Link>

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
            Related Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/best-way-to-collect-rent"
              className="text-blue-600 hover:underline"
            >
              Best Way to Collect Rent
            </Link>

            <Link
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/how-to-collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              How to Collect Rent Online
            </Link>

            <Link
              href="/how-to-track-tenant-payments"
              className="text-blue-600 hover:underline"
            >
              How to Track Tenant Payments
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/tenant-rent-payment-options"
              className="text-blue-600 hover:underline"
            >
              Tenant Rent Payment Options
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Make the Rent Payment Process Easier to Manage
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            RentFray gives owners and managers online rent collection, tenant
            balances, and payment-status tracking without a monthly software
            fee.
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