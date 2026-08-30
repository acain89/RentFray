import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/student-housing-rent-payment";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Student Housing Rent Payment System | RentFray";

const pageDescription =
  "Online rent payment system for student housing. Collect recurring resident payments, track balances and payment status, and keep tenant accounts organized without monthly software fees.";

const faqItems = [
  {
    question: "How can student housing properties collect rent online?",
    answer:
      "Student housing operators can use an online rent payment system that gives residents a consistent payment path while keeping recurring rent, payment activity, and balances organized.",
  },
  {
    question: "Can RentFray track student housing residents separately?",
    answer:
      "Yes. RentFray keeps rent obligations, payment activity, and balances associated with the appropriate tenant and rental account.",
  },
  {
    question: "Do student housing residents need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so residents can access the payment flow without installing an app.",
  },
  {
    question: "Does RentFray handle roommate rent splitting or guarantor billing?",
    answer:
      "RentFray should not be treated as specialized student-housing lease software for roommate splitting, guarantor billing, financial-aid disbursements, or other complex student-housing arrangements. Its focus is recurring payment collection and tenant balance tracking.",
  },
  {
    question: "How are student housing rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge student housing operators a monthly software fee?",
    answer:
      "No. RentFray has no monthly software fee for property owners and managers. Residents pay a small processing fee when they submit payments.",
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
      "Collect student housing rent online and keep recurring resident balances and payment status organized.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online recurring rent collection and payment tracking for student housing.",
  },
};

export default function StudentHousingRentPaymentPage() {
  return (
    <>
      <Script
        id="student-housing-rent-payment-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="student-housing-rent-payment-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Student Housing Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Student Housing Rent Payment System
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Student housing can create a high volume of recurring resident
            payments, each of which needs to stay connected to the correct
            tenant account and outstanding balance.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray provides a focused online rent collection system for
            student housing operators who need to collect payments, track
            balances, and monitor payment status without a monthly software
            subscription.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Student Housing Payment Accounts Separate
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A student housing property may have many residents making
              recurring payments during the same billing cycle.
            </p>

            <p>
              The payment system needs to preserve the connection between the
              resident, the amount due, payment activity, and any remaining
              balance.
            </p>

            <p>
              RentFray keeps those accounts organized so managers can review
              individual tenant balances instead of relying only on a list of
              deposits or transfers.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Student Housing Operators Need to Track
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Resident Account</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring payment obligations associated with the
                appropriate tenant.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Amount Due</h3>
              <p className="mt-2 text-slate-600">
                Maintain the recurring amount expected from each resident
                according to the property's setup.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Distinguish completed payments from activity that is still
                processing or requires attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Remaining Balance</h3>
              <p className="mt-2 text-slate-600">
                See what remains owed after completed payments are applied.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Give Residents a Consistent Online Payment Path
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A consistent online payment process gives residents one place to
              go when their rent is due.
            </p>

            <p>
              RentFray uses a browser-based payment experience, so residents do
              not need to install an app before accessing the payment flow.
            </p>

            <p>
              The payment activity remains connected to the resident's rent
              account, giving the property more context than an isolated money
              transfer.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/tenant-online-rent-payments"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about tenant online rent payments →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recurring Rent Across Many Residents
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Student housing payments repeat according to the property's
              billing schedule. That makes recurring account organization
              especially important.
            </p>

            <p>
              Instead of treating each month's payment as an unrelated
              transaction, RentFray maintains the rent collection workflow
              around recurring obligations and tenant balances.
            </p>

            <p>
              Managers can review the property with the account context intact:
              who owes rent, what payment activity has occurred, and what
              balance remains.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Resident Turnover Makes Clear Payment Records Important
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Student housing can involve residents moving in and out as leases
              change and new occupants take over rental spaces.
            </p>

            <p>
              Clear tenant-specific payment records help prevent one resident's
              payment history from becoming confused with another resident's
              account.
            </p>

            <p>
              The payment system should make it clear which tenant and rental
              account each obligation belongs to rather than relying on a
              general property-level payment list.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track the Resident Balance, Not Just the Payment
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A payment record alone does not always tell staff whether the
              resident's account is current.
            </p>

            <p>
              If a resident owes $900 and a completed payment covers $700, the
              important account information includes the remaining $200
              balance.
            </p>

            <p>
              Tracking the balance alongside payment activity gives managers a
              clearer picture than simply marking that a payment occurred.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-tracking-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about rent tracking software →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Student Housing Payments vs Manual Tracking
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">
                    Rent Payment System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Resident payment</td>
                  <td className="px-3 py-3">
                    May arrive through separate methods
                  </td>
                  <td className="px-3 py-3">
                    Consistent online payment path
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant record</td>
                  <td className="px-3 py-3">
                    Updated separately from payment
                  </td>
                  <td className="px-3 py-3">
                    Payment connected to tenant account
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">
                    Maintained with rent activity
                  </td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Payment status</td>
                  <td className="px-3 py-3">
                    Checked across payment sources
                  </td>
                  <td className="px-3 py-3">
                    Visible in the rent workflow
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Where Specialized Student Housing Software May Be Needed
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Student housing can involve billing arrangements that are more
              specialized than ordinary recurring rent.
            </p>

            <p>
              Properties may need features for per-bed leasing, roommate
              allocation, guarantors, financial-aid timing, semester-based
              billing, university integrations, or other student-specific
              processes.
            </p>

            <p>
              RentFray should not be treated as a replacement for specialized
              student-housing management software when those features are
              required.
            </p>

            <p>
              RentFray's focus is narrower: recurring online payments, tenant
              balances, and payment-status visibility.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Student Housing Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Payments submitted through RentFray are processed through Stripe.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. RentFray organizes the rent collection workflow while
              Stripe handles the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Student Housing Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Residents pay a small processing fee when they submit payments. The
            property does not take on a monthly RentFray software subscription.
          </p>

          <div className="mt-5">
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
            Related Rent Collection Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/online-rent-payment-system-apartments"
              className="text-blue-600 hover:underline"
            >
              Apartment Rent Payment System
            </Link>

            <Link
              href="/tenant-online-rent-payments"
              className="text-blue-600 hover:underline"
            >
              Tenant Online Rent Payments
            </Link>

            <Link
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/property-management-payment-system"
              className="text-blue-600 hover:underline"
            >
              Property Management Payment System
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
            Collect Student Housing Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring resident payments, balances, and payment status
            organized without a monthly software fee for owners or managers.
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