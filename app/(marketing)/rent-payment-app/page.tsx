import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rent-payment-app";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Rent Payment App Without an App Download | RentFray";

const pageDescription =
  "Looking for a rent payment app? RentFray lets tenants pay rent online through a web browser with no app download while landlords track balances and payment status.";

const faqItems = [
  {
    question: "Is RentFray a rent payment app?",
    answer:
      "RentFray provides the online rent payment experience people expect from a rent payment app, but it works through a web browser instead of requiring tenants to download a separate mobile app.",
  },
  {
    question: "Do tenants need to download RentFray?",
    answer:
      "No. Tenants can access RentFray through a web browser, so there is no app download or app-store installation required.",
  },
  {
    question: "Can tenants pay rent from a phone?",
    answer:
      "Yes. Tenants can use the browser-based RentFray payment experience from a compatible phone, tablet, or computer.",
  },
  {
    question: "Can landlords track rent payments with RentFray?",
    answer:
      "Yes. RentFray gives landlords and property managers visibility into tenant balances and payment status while keeping recurring rent organized.",
  },
  {
    question: "How are payments processed?",
    answer:
      "RentFray uses Stripe to securely process payments. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Is RentFray free for landlords?",
    answer:
      "Yes. RentFray has no monthly software fee for landlords or property managers. Tenants pay a small processing fee when they submit payments.",
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
    type: "website",
    url: pagePath,
    siteName: "RentFray",
    title: pageTitle,
    description:
      "Give tenants an online rent payment experience without requiring them to download another app.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Browser-based online rent payments with no app download required.",
  },
};

export default function RentPaymentAppPage() {
  return (
    <>
      <Script
        id="rent-payment-app-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rent-payment-app-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Browser-Based Rent Payments
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Rent Payment App Convenience Without an App Download
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray gives tenants a simple way to pay rent online from their
            phone or computer without installing another app. Landlords and
            property managers get a structured system for tracking tenant
            balances and payment status.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Create a Free Account
            </Link>

            <Link
              href="/tenant-payment-portal"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              See the Tenant Payment Experience
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Does Paying Rent Really Need Another App?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A dedicated mobile app can add steps before a tenant ever reaches
              the payment screen. The tenant has to find the app, install it,
              sign in, keep it updated, and remember it is there the next time
              rent is due.
            </p>

            <p>
              RentFray takes a different approach. The payment experience works
              through a web browser, giving tenants the convenience of online
              rent payments without requiring a separate app installation.
            </p>

            <p>
              For a task tenants typically perform once each rent cycle, a
              direct browser-based experience can keep the process simpler.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What You Actually Need From a Rent Payment App
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Pay Rent Online</h3>
              <p className="mt-2 text-slate-600">
                Tenants get an online payment experience they can access
                through a web browser.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Use a Phone or Computer</h3>
              <p className="mt-2 text-slate-600">
                The browser-based experience can be used without installing a
                dedicated RentFray mobile app.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">See Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                Landlords and managers can keep the amount owed by each tenant
                visible in the rent collection system.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Track Payment Status</h3>
              <p className="mt-2 text-slate-600">
                Payment status stays connected to the tenant account instead
                of being separated across unrelated payment tools.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            How Tenants Pay Rent Without Downloading an App
          </h2>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                1. Access RentFray in the Browser
              </h3>
              <p className="mt-2 text-slate-600">
                The tenant opens RentFray using the browser on a phone,
                tablet, or computer.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                2. Access the Property and Tenant Account
              </h3>
              <p className="mt-2 text-slate-600">
                The tenant uses the property information provided by the
                landlord to reach the appropriate rent payment experience.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">3. Review Rent Information</h3>
              <p className="mt-2 text-slate-600">
                The tenant can see the rent information associated with the
                account before submitting payment.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">4. Submit the Payment Online</h3>
              <p className="mt-2 text-slate-600">
                The tenant completes the online payment flow without needing
                to install a RentFray app.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">
                5. RentFray Updates Payment Visibility
              </h3>
              <p className="mt-2 text-slate-600">
                The landlord or property manager can monitor payment status
                and the tenant balance through RentFray.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/how-tenants-pay-rent-online"
              className="font-semibold text-blue-600 hover:underline"
            >
              See how tenants pay rent online →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Payment App vs Browser-Based Rent Payments
          </h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-3 font-semibold">Feature</th>
                  <th className="px-3 py-3 font-semibold">
                    Downloaded App
                  </th>
                  <th className="px-3 py-3 font-semibold">RentFray</th>
                </tr>
              </thead>

              <tbody className="text-slate-600">
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">App installation</td>
                  <td className="px-3 py-3">Required</td>
                  <td className="px-3 py-3">Not required</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">App-store visit</td>
                  <td className="px-3 py-3">Usually required</td>
                  <td className="px-3 py-3">Not required</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Browser access</td>
                  <td className="px-3 py-3">Varies</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3">Online rent payment</td>
                  <td className="px-3 py-3">Depends on the app</td>
                  <td className="px-3 py-3">Yes</td>
                </tr>

                <tr>
                  <td className="px-3 py-3">Separate app updates</td>
                  <td className="px-3 py-3">May be required</td>
                  <td className="px-3 py-3">
                    No RentFray app to update
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Better Fit for Something You Use Once a Month
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Most tenants do not need to interact with rent collection
              software every day. They need a clear payment experience when
              rent is due.
            </p>

            <p>
              A browser-based system keeps that interaction lightweight.
              Instead of asking tenants to maintain another installed app,
              RentFray lets them access the payment experience online when
              they need it.
            </p>

            <p>
              The landlord still gets the structure of dedicated rent
              collection software without making app installation part of the
              tenant payment process.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            More Than a Generic Payment App
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Peer-to-peer payment apps are designed for general money
              transfers. They can move money, but they are not centered on
              recurring rent, tenant balances, or property-specific payment
              tracking.
            </p>

            <p>
              RentFray is built around the rental payment relationship.
              Payments stay connected to the information landlords and
              property managers need to manage rent collection.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/tenant-rent-payment-options"
              className="font-semibold text-blue-600 hover:underline"
            >
              Compare tenant rent payment options →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Processing Through Stripe
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray uses Stripe to securely process tenant payments.
              RentFray does not store tenant banking information or hold
              tenant funds.
            </p>

            <p>
              RentFray provides the rent collection and account-management
              experience while Stripe provides the underlying payment
              processing infrastructure.
            </p>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            No Monthly Software Fee for Landlords and Managers
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray costs $0 per month for property owners and managers.
            There is no monthly software subscription required to use the rent
            collection platform.
          </p>

          <p className="mt-3 text-slate-600">
            Tenants pay a small processing fee when they submit payments.
          </p>

          <div className="mt-5">
            <Link
              href="/free-rent-collection-software-no-monthly-fee"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn more about RentFray pricing →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Payment App or Rent Payment System?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              People often use these terms for the same general goal, but the
              emphasis is different. A search for a rent payment app usually
              focuses on the tenant experience: how easy is it to access and
              submit rent from a phone?
            </p>

            <p>
              A rent payment system focuses more broadly on the payment
              workflow for the property, including how payments are processed
              and how landlords monitor tenant accounts.
            </p>

            <p>
              RentFray provides both sides of that experience without
              requiring a native app download.
            </p>
          </div>

          <div className="mt-5">
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
            Related Rent Payment Resources
          </h2>

          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/tenant-payment-portal"
              className="text-blue-600 hover:underline"
            >
              Tenant Payment Portal
            </Link>

            <Link
              href="/tenant-online-rent-payments"
              className="text-blue-600 hover:underline"
            >
              Tenant Online Rent Payments
            </Link>

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
              href="/rent-tracking-software"
              className="text-blue-600 hover:underline"
            >
              Rent Tracking Software
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Give Tenants an Easier Way to Pay Rent Online
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Use RentFray for browser-based rent payments without requiring
            tenants to download another app.
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