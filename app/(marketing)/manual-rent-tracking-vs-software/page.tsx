import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/manual-rent-tracking-vs-software";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Manual Rent Tracking vs Software | RentFray";

const pageDescription =
  "Compare manual rent tracking with rent tracking software, including spreadsheets, payment reconciliation, tenant balances, payment status, cost, and when it makes sense to switch.";

const faqItems = [
  {
    question: "Can landlords track rent manually?",
    answer:
      "Yes. Manual tracking can work well for a small number of tenants when records are updated consistently and payment activity is easy to reconcile.",
  },
  {
    question: "What are the disadvantages of manual rent tracking?",
    answer:
      "Manual tracking requires someone to record payments, update balances, reconcile payment sources, and keep the records current. The workload generally increases as the number of tenants and transactions grows.",
  },
  {
    question: "What does rent tracking software do differently?",
    answer:
      "Rent tracking software can connect tenant accounts, amounts due, payment activity, payment status, and balances in one system instead of requiring those records to be maintained separately.",
  },
  {
    question: "When should a landlord switch from manual tracking to software?",
    answer:
      "Software becomes worth considering when manual updates, reconciliation, outstanding-balance checks, or multiple payment sources are taking enough time that the manual system is becoming difficult to maintain accurately.",
  },
  {
    question: "Is a spreadsheet considered manual rent tracking?",
    answer:
      "Usually, yes. A spreadsheet stores digital records, but the process is still manual when someone must enter payments, update balances, and reconcile the spreadsheet with payment activity.",
  },
  {
    question: "Is RentFray free for landlords and property managers?",
    answer:
      "RentFray has no monthly software fee for property owners and managers. Tenants pay a small processing fee when they submit payments.",
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
      "A practical comparison of manual rent tracking and dedicated rent tracking software.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Compare manual rent tracking with software and decide when it makes sense to switch.",
  },
};

export default function ManualRentTrackingVsSoftwarePage() {
  return (
    <>
      <Script
        id="manual-rent-tracking-vs-software-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="manual-rent-tracking-vs-software-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Tracking Comparison
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Manual Rent Tracking vs Software
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Manual rent tracking can work perfectly well for a small rental
            operation. The tradeoff is that every payment, balance update, and
            reconciliation depends on someone keeping the records current.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            Rent tracking software becomes more useful when that manual work
            starts taking enough time—or involves enough tenants and payment
            activity—that maintaining an accurate picture becomes difficult.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Manual Tracking and Software Can Both Work
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              There is no universal number of units where a landlord suddenly
              needs software. A well-maintained spreadsheet can be enough for
              one landlord, while another may prefer dedicated software with
              the same number of tenants.
            </p>

            <p>
              The better question is how much work is required to keep the
              records accurate.
            </p>

            <p>
              If you can quickly determine what each tenant owes, what has
              been paid, what is still processing, and what balance remains,
              your current system may be doing its job.
            </p>

            <p>
              If answering those questions requires checking bank activity,
              payment apps, spreadsheets, messages, and separate notes,
              dedicated software may reduce the amount of reconciliation
              required each month.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Manual Rent Tracking vs Software: Side by Side
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Area</th>
                  <th className="px-3 py-3 font-semibold">Manual Tracking</th>
                  <th className="px-3 py-3 font-semibold">
                    Rent Tracking Software
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Setup</td>
                  <td className="px-3 py-3">
                    Can be very simple to start
                  </td>
                  <td className="px-3 py-3">
                    Requires initial account and property setup
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment entry</td>
                  <td className="px-3 py-3">
                    Usually entered or verified manually
                  </td>
                  <td className="px-3 py-3">
                    Can be connected to online payment activity
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant balances</td>
                  <td className="px-3 py-3">
                    Calculated and updated manually
                  </td>
                  <td className="px-3 py-3">
                    Maintained within tenant accounts
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment status</td>
                  <td className="px-3 py-3">
                    Requires checking the payment source
                  </td>
                  <td className="px-3 py-3">
                    Can be visible in the tracking system
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Reconciliation</td>
                  <td className="px-3 py-3">
                    Records and payments must be matched
                  </td>
                  <td className="px-3 py-3">
                    Reduced when collection and tracking are connected
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Scaling</td>
                  <td className="px-3 py-3">
                    Manual workload generally grows with activity
                  </td>
                  <td className="px-3 py-3">
                    Designed to organize multiple tenant accounts
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Software cost</td>
                  <td className="px-3 py-3">
                    Can be $0 if using tools you already have
                  </td>
                  <td className="px-3 py-3">
                    Depends on the software; RentFray is $0/month for owners
                    and managers
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            When Manual Rent Tracking Makes Sense
          </h2>

          <p className="mt-4 text-slate-600">
            Staying manual can be a reasonable choice when:
          </p>

          <ul className="mt-5 space-y-3 text-slate-600">
            <li>• You manage a small number of tenant accounts.</li>
            <li>• Payment activity is easy to verify.</li>
            <li>• Tenants use a limited number of payment methods.</li>
            <li>• Updating balances takes very little time.</li>
            <li>• Your records remain accurate without frequent corrections.</li>
            <li>
              • You can quickly identify outstanding balances without checking
              several different sources.
            </li>
          </ul>

          <p className="mt-5 text-slate-600">
            If those conditions describe your current process, switching
            systems solely for the sake of using software may not provide much
            benefit.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Where Manual Tracking Starts to Become Difficult
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Payment Information Lives in Several Places
              </h3>
              <p className="mt-2 text-slate-600">
                When payments, bank activity, spreadsheets, messages, and
                notes all contain different pieces of the record, determining
                the current state of a tenant account requires reconciliation.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Balances Require Repeated Calculation
              </h3>
              <p className="mt-2 text-slate-600">
                A payment log shows what came in. It does not necessarily show
                what remains owed unless the tenant balance is also updated.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Submitted and Completed Payments Are Hard to Distinguish
              </h3>
              <p className="mt-2 text-slate-600">
                Online payments can have processing states. A manual system
                may require additional checking before you know whether a
                payment has actually completed.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                More Tenants Create More Monthly Updates
              </h3>
              <p className="mt-2 text-slate-600">
                Each additional tenant adds another recurring obligation,
                payment record, balance, and account to review.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                The Record Is Only Current After You Update It
              </h3>
              <p className="mt-2 text-slate-600">
                A spreadsheet can be accurate, but its accuracy depends on
                someone consistently entering and reconciling the information.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Rent Tracking Software Changes
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Dedicated rent tracking software can connect information that a
              manual system often keeps separate.
            </p>

            <p>
              Instead of maintaining a payment list in one place and tenant
              balances somewhere else, the rent obligation, payment activity,
              payment status, and remaining balance can be part of the same
              tenant account.
            </p>

            <p>
              When the software also handles online rent collection, there is
              less need to transfer payment information manually from one
              system into another.
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
            A Spreadsheet Is Digital, but It Is Still Manual
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Using a spreadsheet does not necessarily mean your tracking
              process is automated. If someone must enter every payment,
              calculate every balance, and compare the spreadsheet with bank
              or payment records, the workflow is still manual.
            </p>

            <p>
              That is not inherently bad. Spreadsheets are flexible, familiar,
              and inexpensive. The tradeoff is the ongoing work required to
              keep them synchronized with what actually happened.
            </p>
          </div>

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
            How to Decide Whether It Is Time to Switch
          </h2>

          <p className="mt-4 text-slate-600">
            Consider these questions about your current process:
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="font-semibold">
                Can I see every tenant's current balance quickly?
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="font-semibold">
                Can I tell which payments are completed and which are still
                processing?
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="font-semibold">
                How many separate places do I check to verify rent payments?
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="font-semibold">
                How much time do I spend entering or reconciling payment
                information?
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <p className="font-semibold">
                Does adding another tenant noticeably increase my monthly
                tracking work?
              </p>
            </div>
          </div>

          <p className="mt-5 text-slate-600">
            If the current system answers these questions easily, manual
            tracking may still be sufficient. If the administrative work is
            becoming a recurring problem, software may be worth the change.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Software Does Not Have to Mean a Large Property Management Suite
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Moving beyond manual tracking does not necessarily mean adopting
              accounting, leasing, maintenance, screening, and every other
              property-management function at once.
            </p>

            <p>
              A landlord who primarily wants to improve rent collection and
              tracking can choose software focused on that narrower job.
            </p>

            <p>
              RentFray is built around online rent collection, recurring rent,
              tenant balances, and payment status rather than requiring
              landlords to adopt a broad property-management suite.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            What RentFray Costs
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <p className="mt-3 text-slate-600">
            That changes part of the manual-versus-software calculation:
            landlords can move rent collection and tracking into dedicated
            software without adding a monthly software subscription for the
            business.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about RentFray pricing →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Manual Tracking, Software, or Something in Between?
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Stay Manual</h3>
              <p className="mt-2 text-slate-600">
                A good fit when there are few tenants, little reconciliation,
                and the existing records are easy to maintain accurately.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Use Focused Rent Software</h3>
              <p className="mt-2 text-slate-600">
                A good fit when rent collection and tracking are the main
                problems you want to solve without adopting a much larger
                property-management system.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                Use Full Property Management Software
              </h3>
              <p className="mt-2 text-slate-600">
                A better fit when you also need a broader set of operational
                features beyond rent collection and payment tracking.
              </p>
            </div>
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
              href="/how-to-manage-rent-without-software"
              className="text-blue-600 hover:underline"
            >
              How to Manage Rent Without Software
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
            Ready to Move Beyond Manual Rent Tracking?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Collect rent online and keep tenant balances and payment status in
            one focused system without a monthly software fee for owners or
            managers.
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