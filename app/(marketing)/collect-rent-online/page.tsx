import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/collect-rent-online";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "Collect Rent Online | RentFray";

const pageDescription =
  "Collect rent online with RentFray. Landlords and property managers can track payments and tenant balances without a monthly software subscription. Tenants pay a processing fee when they submit payments.";

const faqItems = [
  {
    question: "Can I collect rent online with RentFray?",
    answer:
      "Yes. RentFray gives landlords and property managers an online rent collection system for recurring tenant payments.",
  },
  {
    question: "Does RentFray charge landlords a monthly fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software subscription.",
  },
  {
    question: "Do tenants pay a fee?",
    answer:
      "Yes. Tenants pay a processing fee when they submit payments through RentFray.",
  },
  {
    question: "Can I track who has paid?",
    answer:
      "Yes. RentFray helps owners and managers track payment status and tenant balances so they can quickly see what has been paid and what remains due.",
  },
  {
    question: "What types of properties can use RentFray?",
    answer:
      "RentFray can be used for apartments, rental homes, mobile home parks, RV parks, and other properties that collect recurring rent.",
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
    type: "website",
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

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

export default function CollectRentOnlinePage() {
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
              RentFray
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Collect Rent Online Without a Monthly Software Subscription
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Give tenants a clear way to pay rent online while keeping payment
              status and balances organized in one place.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is $0 per month for landlords and property managers.
              Tenants pay a processing fee when they submit payments.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Start Collecting Rent
              </Link>

              <Link
                href="/how-to-collect-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                How Online Rent Collection Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            A Simpler Way to Collect Rent Online
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Online rent collection should make the monthly process easier, not
            add another layer of complexity. Tenants should know where to pay,
            and the property should be able to see what has been paid and what
            still needs attention.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray is built around that basic workflow. Instead of relying on
            a mix of checks, spreadsheets, text messages, and separate payment
            records, owners and managers can use one system for recurring rent
            collection and payment visibility.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading>
            What You Can Do When You Collect Rent With RentFray
          </SectionHeading>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <FeatureCard
              title="Accept Rent Online"
              description="Give tenants an online payment path instead of depending on checks, cash, or disconnected payment methods."
            />

            <FeatureCard
              title="Track Payment Status"
              description="See which payments have been completed, which are pending, and which balances still require attention."
            />

            <FeatureCard
              title="See Tenant Balances"
              description="Keep rent balances visible by tenant or unit without using a spreadsheet as the primary record."
            />

            <FeatureCard
              title="Manage Recurring Rent"
              description="Use one consistent monthly workflow instead of rebuilding the rent collection process each cycle."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why Landlords Move Rent Collection Online
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Manual rent collection can create unnecessary work. Checks have to
            be received and recorded. Cash has to be documented. Bank transfers
            can require manual matching. Spreadsheets only stay accurate if
            someone keeps updating them.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Moving rent collection online can reduce that fragmentation. A
            dedicated system gives tenants one payment path and gives the
            landlord one place to review payment activity and balances.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            That does not mean every landlord needs a large property management
            suite. For many properties, a focused rent collection system is
            enough.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              How Online Rent Collection Works With RentFray
            </SectionHeading>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900">
                  1. Set up the property
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  The landlord or property manager sets up the property and the
                  recurring rent collection workflow.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  2. Tenants access the payment process
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Tenants use RentFray's online payment flow to submit their rent.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  3. Payments are processed securely
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Payment processing is handled through Stripe. RentFray does not
                  store tenant banking information or hold tenant funds.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  4. The property tracks the result
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Owners and managers can review payment status and balances from
                  the same rent collection system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Online Rent Collection for Different Property Types
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            The basic rent collection problem is similar across many property
            types: recurring payments need to be collected, recorded, and easy
            to review.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/online-rent-payment-system-apartments"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">Apartments</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Collect recurring rent across multiple units.
              </p>
            </Link>

            <Link
              href="/mobile-home-park-rent-collection"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">Mobile Home Parks</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Keep monthly lot and home rent organized.
              </p>
            </Link>

            <Link
              href="/rv-park-rent-collection"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">RV Parks</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Manage recurring rent for long-term spaces.
              </p>
            </Link>

            <Link
              href="/duplex-landlord-rent-collection"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">Duplexes</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use a lightweight collection workflow for smaller properties.
              </p>
            </Link>

            <Link
              href="/commercial-property-rent-collection"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">Commercial Properties</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Organize recurring tenant payments and balances.
              </p>
            </Link>

            <Link
              href="/student-housing-rent-payment"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
            >
              <h3 className="font-semibold">Student Housing</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Give residents a clear online rent payment path.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Online Rent Collection Without a Monthly RentFray Subscription
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray is free for landlords and property managers. There is no
              monthly RentFray software subscription for the business.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments. This keeps
              the pricing model clear while allowing the property to use the rent
              collection software without a recurring monthly software charge.
            </p>

            <div className="mt-6">
              <Link
                href="/free-rent-collection-software-no-monthly-fee"
                className="font-semibold text-slate-900 underline underline-offset-4"
              >
                Learn more about RentFray's no-monthly-fee model
              </Link>
            </div>
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
                href="/free-rent-collection-software"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Free Rent Collection Software
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Online Rent Payment System
              </Link>

              <Link
                href="/how-to-collect-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                How to Collect Rent Online
              </Link>

              <Link
                href="/tenant-payment-portal"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to collect rent online?
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              Give tenants a clear online payment path and keep rent payment
              status and balances organized without a monthly RentFray software
              subscription.
            </p>

            <div className="mt-8">
              <Link
                href="/setup"
                className="inline-block rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Start Collecting Rent
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}