import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/online-rent-payment-system-apartments";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle =
  "Online Rent Payment System for Apartment Complexes | RentFray";

const pageDescription =
  "Online rent payment system for apartment complexes and multi-unit properties. Collect rent online, track tenant balances and payment status, and manage recurring rent without monthly software fees.";

const faqItems = [
  {
    question: "How can apartment complexes collect rent online?",
    answer:
      "Apartment owners and managers can use an online rent payment system that gives residents a consistent payment path while keeping rent balances and payment activity organized by unit.",
  },
  {
    question: "Can apartment managers track rent by unit?",
    answer:
      "Yes. RentFray is designed to help property managers see what each unit owes, what has been paid, and what balance remains.",
  },
  {
    question: "Can RentFray handle recurring apartment rent?",
    answer:
      "Yes. RentFray supports recurring rent obligations so apartment managers can maintain an organized monthly rent collection cycle across multiple units.",
  },
  {
    question: "Do apartment residents need to download an app?",
    answer:
      "No. RentFray uses a browser-based payment experience, so residents can access the payment flow without installing an app.",
  },
  {
    question: "How are apartment rent payments processed?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Is RentFray free for apartment owners and managers?",
    answer:
      "RentFray has no monthly software fee for property owners and managers. Residents pay a small processing fee when they submit payments.",
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
      "Collect apartment rent online and track balances and payment status across multiple units.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Online rent collection for apartment complexes and multi-unit properties.",
  },
};

export default function ApartmentsPage() {
  return (
    <>
      <Script
        id="apartment-rent-payment-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="apartment-rent-payment-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Apartment Rent Collection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Online Rent Payment System for Apartment Complexes
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Apartment rent collection becomes more complicated as the number of
            units grows. Property managers need to know what each resident owes,
            which payments have been completed, which are still processing, and
            which balances still need attention.
          </p>

          <p className="mt-4 max-w-3xl text-slate-600">
            RentFray gives apartment owners and managers a focused online rent
            collection system built around recurring rent, tenant balances, and
            payment-status visibility.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Manage Rent Across Multiple Apartment Units
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              With a single rental unit, keeping track of rent may be simple.
              Across an apartment property, the same monthly process repeats
              across many residents at once.
            </p>

            <p>
              One resident may have paid in full. Another may still have an
              outstanding balance. Another payment may still be processing.
              Keeping those accounts separate and current is an important part
              of managing apartment rent accurately.
            </p>

            <p>
              RentFray keeps rent activity connected to the appropriate tenant
              and unit so managers do not have to reconstruct the month from
              unrelated payment records.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Apartment Managers Need From a Rent Payment System
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Unit-Level Rent Records</h3>
              <p className="mt-2 text-slate-600">
                Keep rent obligations and payment activity associated with the
                correct tenant and unit.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Recurring Rent</h3>
              <p className="mt-2 text-slate-600">
                Manage the monthly rent cycle without rebuilding each tenant's
                obligation from scratch.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                See what each tenant owes after completed payments are applied.
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
              <h3 className="font-semibold">Online Resident Payments</h3>
              <p className="mt-2 text-slate-600">
                Give residents a consistent browser-based way to submit rent
                payments.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Centralized Visibility</h3>
              <p className="mt-2 text-slate-600">
                Review apartment rent activity without relying on separate
                spreadsheets, notes, and payment records.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Track What Each Apartment Unit Owes
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Apartment rent tracking should answer a simple question for every
              occupied unit: how much is still owed?
            </p>

            <p>
              That requires more than knowing that a payment occurred. The
              manager also needs the amount due, completed payment amount, and
              remaining balance associated with the correct tenant.
            </p>

            <p>
              Keeping that information together makes it easier to review the
              property without calculating balances manually.
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
            Give Apartment Residents a Consistent Online Payment Path
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A consistent payment process reduces the number of unrelated
              payment methods a manager has to reconcile each month.
            </p>

            <p>
              RentFray provides a browser-based tenant payment experience, so
              residents do not need to download an app to access the payment
              flow.
            </p>

            <p>
              Payment activity stays connected to the rent account rather than
              existing only as an isolated money transfer.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Apartment Rent Payment Status Matters
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A submitted payment is not always the same as a completed
              payment.
            </p>

            <p>
              Apartment managers need enough visibility to distinguish payment
              activity that is still processing from completed rent and from an
              account that still has no successful payment.
            </p>

            <p>
              That distinction helps keep unit balances and follow-up decisions
              based on the actual payment status.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Online Apartment Rent Collection vs Manual Tracking
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Task</th>
                  <th className="px-3 py-3 font-semibold">Manual Process</th>
                  <th className="px-3 py-3 font-semibold">
                    Rent Collection System
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Tenant payment</td>
                  <td className="px-3 py-3">May come from multiple sources</td>
                  <td className="px-3 py-3">Consistent online payment path</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Unit balance</td>
                  <td className="px-3 py-3">Calculated manually</td>
                  <td className="px-3 py-3">Tracked with the account</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Payment status</td>
                  <td className="px-3 py-3">
                    Checked across outside records
                  </td>
                  <td className="px-3 py-3">Visible in the rent workflow</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Monthly records</td>
                  <td className="px-3 py-3">Repeated manual updates</td>
                  <td className="px-3 py-3">
                    Organized around recurring rent
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Useful for Small Apartment Buildings and Multi-Unit Properties
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A property does not need hundreds of units before organized rent
              collection becomes useful.
            </p>

            <p>
              Even a smaller apartment building can become difficult to track
              when tenants use different payment methods or rent records live in
              multiple places.
            </p>

            <p>
              A focused rent collection system can provide the same consistent
              workflow across the occupied units without requiring a broad
              property-management software suite.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Secure Apartment Rent Payment Processing
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe for payment processing.
            </p>

            <p>
              RentFray does not store tenant banking information or hold tenant
              funds. Its role is to organize the rent collection workflow while
              Stripe handles the payment-processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Apartment Rent Collection Without a Monthly Software Fee
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for apartment owners and managers.
          </p>

          <p className="mt-3 text-slate-600">
            Residents pay a small processing fee when they submit payments.
            That means the business can use the rent collection software
            without taking on a monthly software subscription.
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
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/rent-collection-software-landlords"
              className="text-blue-600 hover:underline"
            >
              Rent Collection Software for Landlords
            </Link>

            <Link
              href="/property-management-payment-system"
              className="text-blue-600 hover:underline"
            >
              Property Management Payment System
            </Link>

            <Link
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>

            <Link
              href="/student-housing-rent-payment"
              className="text-blue-600 hover:underline"
            >
              Student Housing Rent Payments
            </Link>

            <Link
              href="/duplex-landlord-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Duplex Rent Collection
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Collect Apartment Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Keep recurring apartment rent, tenant balances, and payment status
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