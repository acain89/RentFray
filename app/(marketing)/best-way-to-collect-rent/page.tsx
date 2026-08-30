import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/best-way-to-collect-rent";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Best Way to Collect Rent from Tenants | RentFray";

const pageDescription =
  "Compare the best ways to collect rent from tenants, including checks, cash, bank transfers, payment apps, and dedicated online rent collection systems.";

const faqItems = [
  {
    question: "What is the best way to collect rent from tenants?",
    answer:
      "For many landlords, the best method is one that is easy for tenants to use, creates clear payment records, reduces manual reconciliation, and keeps tenant balances and payment status organized.",
  },
  {
    question: "Are checks still a reasonable way to collect rent?",
    answer:
      "Yes. Checks can still work, especially for a small number of tenants, but they require physical handling, deposits, and manual recordkeeping.",
  },
  {
    question: "Is cash a good way to collect rent?",
    answer:
      "Cash can work, but it requires careful receipt and recordkeeping procedures because there is no automatic electronic transaction record.",
  },
  {
    question: "Can landlords collect rent by bank transfer?",
    answer:
      "Yes. Bank transfers can move rent electronically, but landlords may still need a separate system for identifying tenants, billing cycles, payment status, and remaining balances.",
  },
  {
    question: "Are generic payment apps good for collecting rent?",
    answer:
      "They can be convenient for transferring money, but they generally provide less rent-specific structure than a dedicated system built around recurring tenant payments and balances.",
  },
  {
    question: "How much does RentFray cost landlords?",
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
      "Compare common rent collection methods and choose the best fit for your rental operation.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Compare checks, cash, bank transfers, payment apps, and online rent collection systems.",
  },
};

export default function BestWayToCollectRentPage() {
  return (
    <>
      <Script
        id="best-way-to-collect-rent-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="best-way-to-collect-rent-webpage"
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
            Best Way to Collect Rent from Tenants
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            There is no single rent collection method that is best for every
            landlord. A landlord with two tenants may be perfectly comfortable
            with checks or bank transfers, while someone managing dozens of
            recurring payments may benefit from a dedicated online rent
            collection system.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            The best choice is the one that fits your property while keeping
            payments easy for tenants, records clear, and monthly
            reconciliation manageable.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Makes a Rent Collection Method Good?
          </h2>

          <p className="mt-4 text-slate-600">
            Before comparing specific methods, evaluate them using the same
            basic criteria.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Convenience</h3>
              <p className="mt-2 text-slate-600">
                Tenants should clearly understand how and where to pay.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Reliable Records</h3>
              <p className="mt-2 text-slate-600">
                Each payment should leave a clear record that can be tied to
                the correct tenant and billing cycle.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Low Administrative Work</h3>
              <p className="mt-2 text-slate-600">
                The method should not require unnecessary payment matching,
                deposit handling, or repeated data entry.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Balance Visibility</h3>
              <p className="mt-2 text-slate-600">
                You should be able to determine what each tenant still owes
                after payments are recorded.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Use</h3>
              <p className="mt-2 text-slate-600">
                Rent happens month after month, so the method should be easy to
                repeat consistently.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Appropriate Cost</h3>
              <p className="mt-2 text-slate-600">
                Consider both direct fees and the administrative time required
                to operate the system.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Common Ways to Collect Rent
          </h2>

          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Checks</h3>

              <p className="mt-2 text-slate-600">
                Checks remain a workable option for landlords who have a small
                number of tenants and do not mind handling deposits manually.
              </p>

              <p className="mt-3 text-slate-600">
                The tradeoff is administrative work. Checks must be received,
                deposited, matched to the correct tenant, and recorded in your
                rent ledger.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Cash</h3>

              <p className="mt-2 text-slate-600">
                Cash is immediate and does not require electronic payment
                processing.
              </p>

              <p className="mt-3 text-slate-600">
                However, landlords need a consistent receipt process and
                accurate records because cash does not automatically create an
                electronic transaction history.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">Bank Transfers</h3>

              <p className="mt-2 text-slate-600">
                Direct bank transfers can be convenient and remove the need to
                handle paper payments.
              </p>

              <p className="mt-3 text-slate-600">
                The landlord may still need to identify the payment, match it
                to the correct tenant and billing cycle, and maintain balances
                in another system.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">
                Generic Payment Apps
              </h3>

              <p className="mt-2 text-slate-600">
                General-purpose payment apps can provide an easy way for two
                people to transfer money.
              </p>

              <p className="mt-3 text-slate-600">
                Their limitation for rent collection is context. They are
                usually built around individual transactions rather than
                recurring rent obligations, tenant balances, and property
                records.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">
                Dedicated Online Rent Collection
              </h3>

              <p className="mt-2 text-slate-600">
                Dedicated rent collection systems connect the payment process
                with the tenant's rental account.
              </p>

              <p className="mt-3 text-slate-600">
                Depending on the system, that can include recurring rent,
                online payment processing, tenant balances, and payment-status
                tracking in the same workflow.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Collection Methods Compared
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Method</th>
                  <th className="px-3 py-3 font-semibold">Online</th>
                  <th className="px-3 py-3 font-semibold">
                    Manual Recordkeeping
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    Rent-Specific Tracking
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Check</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Cash</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">No</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Bank transfer</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Usually</td>
                  <td className="px-3 py-3">Usually no</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Generic payment app</td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">Often</td>
                  <td className="px-3 py-3">Usually no</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">
                    Dedicated rent collection system
                  </td>
                  <td className="px-3 py-3">Yes</td>
                  <td className="px-3 py-3">
                    Reduced when tracking is integrated
                  </td>
                  <td className="px-3 py-3">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Best Way to Collect Rent for a Small Landlord
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A landlord with only one or two tenants may not need dedicated
              software if the existing payment method is easy to manage.
            </p>

            <p>
              If payments arrive reliably through one method and maintaining
              the records only takes a few minutes each month, a simple manual
              process may be perfectly adequate.
            </p>

            <p>
              Dedicated software becomes more attractive when the landlord
              wants payment collection, balances, and payment status connected
              rather than managed separately.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Best Way to Collect Rent from Multiple Tenants
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              As the number of tenants grows, consistency becomes more
              important.
            </p>

            <p>
              Ten different tenants paying through several unrelated methods
              can create a larger reconciliation job than ten tenants using one
              common payment process.
            </p>

            <p>
              For multi-unit properties, a centralized online system can make
              it easier to match payments to tenant accounts and see which
              balances still require attention.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/collect-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn how to collect rent online →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            The Best Payment Method Is Not Always the Best Rent System
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              It is useful to separate two questions: how should the tenant move
              the money, and how should the landlord manage the rent account?
            </p>

            <p>
              A bank transfer may be an excellent way to move money while still
              leaving the landlord with separate work for billing, balances,
              and recordkeeping.
            </p>

            <p>
              A dedicated rent system addresses both sides by connecting the
              payment with the tenant account and recurring rent obligation.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Payment Status Matters
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Online payment activity does not always move directly from
              submitted to completed.
            </p>

            <p>
              A good rent collection workflow should let the landlord
              distinguish payment activity that is still processing from a
              completed payment rather than treating both as the same thing.
            </p>

            <p>
              That distinction helps keep tenant balances and monthly records
              accurate.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Keep Rent Collection and Tracking Connected
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              The more often payment information has to be copied from one
              system into another, the more administrative work the landlord
              has to perform.
            </p>

            <p>
              Connecting collection and tracking means the payment activity,
              tenant account, and resulting balance can live in the same
              workflow.
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
            What About Full Property Management Software?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Full property-management software may be the best choice if you
              also need accounting, leasing, maintenance management, screening,
              documents, and other operational features.
            </p>

            <p>
              If your main need is collecting and tracking rent, a focused
              payment system may be easier to adopt because it solves a smaller
              problem.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/rent-collection-software-alternative"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare rent collection software alternatives →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            How RentFray Approaches Rent Collection
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray is built as a focused online rent collection system for
            property owners and managers. It combines recurring rent, tenant
            balances, payment status, and online payment collection without
            requiring a full property-management suite.
          </p>

          <p className="mt-3 text-slate-600">
            Payments are processed through Stripe. RentFray does not store
            tenant banking information or hold tenant funds.
          </p>

          <p className="mt-3 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link
              href="/free-rent-collection-software"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore free rent collection software →
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              Explore the online rent payment system →
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
              href="/free-rent-collection-software"
              className="text-blue-600 hover:underline"
            >
              Free Rent Collection Software
            </Link>

            <Link
              href="/landlord-rent-payment-options"
              className="text-blue-600 hover:underline"
            >
              Landlord Rent Payment Options
            </Link>

            <Link
              href="/rent-collection-software-alternative"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software Alternative
            </Link>

            <Link
              href="/how-to-avoid-late-rent-payments"
              className="text-blue-600 hover:underline"
            >
              How to Avoid Late Rent Payments
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Want a Focused Way to Collect Rent Online?
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            RentFray combines online rent collection, recurring rent, tenant
            balances, and payment status without a monthly software fee for
            owners or managers.
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