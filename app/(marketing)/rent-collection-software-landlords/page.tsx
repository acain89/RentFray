import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

const pagePath = "/rent-collection-software-landlords";
const pageUrl = `https://www.rentfray.com${pagePath}`;

const pageTitle = "Free Rent Collection Software for Landlords | RentFray";

const pageDescription =
  "Free rent collection software for landlords. Collect rent online, track tenant balances and payment status, and manage recurring rent without monthly software fees.";

const faqItems = [
  {
    question: "What is rent collection software for landlords?",
    answer:
      "Rent collection software gives landlords a structured way to collect rent online, track tenant balances, monitor payment status, and keep recurring rent organized.",
  },
  {
    question: "Can landlords collect rent online with RentFray?",
    answer:
      "Yes. RentFray gives landlords an online rent collection system that tenants can use to submit rent payments while landlords track balances and payment status.",
  },
  {
    question: "Is RentFray free for landlords?",
    answer:
      "Yes. RentFray has no monthly software fee for landlords and property managers. Tenants pay a small processing fee when they submit payments.",
  },
  {
    question: "Can I see which tenants have paid?",
    answer:
      "Yes. RentFray helps landlords track tenant balances and payment status so they can quickly see which accounts are paid and which still need attention.",
  },
  {
    question: "Does RentFray require tenants to download an app?",
    answer:
      "No. Tenants can use RentFray through a web browser, so a separate mobile app download is not required.",
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
      "Collect rent online, track tenant balances and payment status, and manage recurring rent without monthly software fees.",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description:
      "Free online rent collection software built for landlords.",
  },
};

export default function RentCollectionSoftwareLandlordsPage() {
  return (
    <>
      <Script
        id="rent-collection-software-landlords-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <Script
        id="rent-collection-software-landlords-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageSchema),
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
        <section className="mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rent Collection for Landlords
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Free Rent Collection Software for Landlords
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            RentFray gives landlords a simple way to collect rent online,
            track tenant balances and payment status, and keep recurring rent
            organized without paying a monthly software subscription.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Create a Free Account
            </Link>

            <Link
              href="/free-rent-collection-software"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              See How RentFray Works
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            A Rent Collection System Built Around the Landlord
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Collecting rent involves more than receiving money. Landlords
              also need to know what each tenant owes, whether a payment has
              been made, and which accounts still need attention.
            </p>

            <p>
              When those details are spread across checks, payment apps,
              spreadsheets, text messages, and handwritten notes, monthly rent
              collection becomes harder to manage than it needs to be.
            </p>

            <p>
              RentFray puts rent collection and payment tracking into one
              focused system so landlords can manage recurring rent with a
              clearer view of what is happening across their properties.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            What Landlords Can Do With RentFray
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Collect Rent Online</h3>
              <p className="mt-2 text-slate-600">
                Give tenants a straightforward online payment flow for
                recurring rent instead of relying on checks, cash, or
                general-purpose payment apps.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Track Tenant Balances</h3>
              <p className="mt-2 text-slate-600">
                Keep the amount each tenant owes visible without maintaining a
                separate spreadsheet or manual rent log.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Monitor Payment Status</h3>
              <p className="mt-2 text-slate-600">
                See payment status in the same system used to manage rent so
                you have a clearer picture of which accounts need attention.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold">Manage Recurring Rent</h3>
              <p className="mt-2 text-slate-600">
                Keep recurring rent information organized around the tenants
                and properties you actually manage.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Why Use Dedicated Rent Collection Software?
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A general payment app can move money, but landlords usually need
              more context than a transaction alone provides. They need to
              connect payments to tenants, balances, recurring rent, and the
              property being managed.
            </p>

            <p>
              Dedicated rent collection software keeps that information
              together. Instead of receiving a payment and then updating
              another record manually, landlords can use a system designed
              specifically around rent.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/landlord-payment-system"
              className="font-semibold text-blue-600 hover:underline"
            >
              Learn about landlord payment systems →
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Rent Tracking Without Another Spreadsheet
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Manual tracking can work when there are only a few transactions,
              but it creates another task every time rent is paid. The payment
              happens in one place and the landlord then has to record it
              somewhere else.
            </p>

            <p>
              RentFray is designed to keep rent collection and payment
              visibility connected. That makes it easier to answer the
              questions landlords repeatedly face: Who paid? What is still
              owed? Which tenant needs attention?
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
            Simple for Tenants, Useful for Landlords
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              A rent collection system only works well when tenants can
              actually use it. RentFray provides a browser-based payment
              experience, so tenants do not need to install a separate app
              just to pay rent.
            </p>

            <p>
              Tenants use the online payment flow while landlords use RentFray
              to manage balances and payment status. Each side gets the part
              of the system relevant to them without unnecessary complexity.
            </p>
          </div>

          <div className="mt-5">
            <Link
              href="/tenant-payment-portal"
              className="font-semibold text-blue-600 hover:underline"
            >
              See the tenant payment portal →
            </Link>
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-bold tracking-tight">
            $0 Per Month for Landlords
          </h2>

          <p className="mt-4 text-slate-600">
            RentFray has no monthly software fee for landlords or property
            managers. There is no software subscription required to keep using
            the platform.
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
            Rent Collection for Small and Growing Landlords
          </h2>

          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              RentFray is useful for landlords who want a focused rent
              collection system without adopting a large property-management
              suite just to accept and track rent.
            </p>

            <p>
              Whether you manage a duplex, a small apartment property, or a
              growing group of rental units, the goal is the same: make rent
              collection easier to see and easier to manage.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2 text-sm">
            <Link
              href="/duplex-landlord-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Rent collection for duplex landlords
            </Link>

            <Link
              href="/online-rent-payment-system-apartments"
              className="text-blue-600 hover:underline"
            >
              Online rent payments for apartments
            </Link>

            <Link
              href="/mobile-home-park-rent-collection"
              className="text-blue-600 hover:underline"
            >
              Mobile home park rent collection
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
              href="/free-rent-collection-software"
              className="text-blue-600 hover:underline"
            >
              Free Rent Collection Software
            </Link>

            <Link
              href="/collect-rent-online"
              className="text-blue-600 hover:underline"
            >
              Collect Rent Online
            </Link>

            <Link
              href="/online-rent-payment-system"
              className="text-blue-600 hover:underline"
            >
              Online Rent Payment System
            </Link>

            <Link
              href="/landlord-payment-system"
              className="text-blue-600 hover:underline"
            >
              Landlord Payment System
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
            Start Collecting Rent With RentFray
          </h2>

          <p className="mt-3 max-w-2xl text-slate-200">
            Create your property, organize your tenants, and use a rent
            collection system built to keep payments and balances easier to
            manage.
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