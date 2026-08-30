import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/tenant-online-rent-payments";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "Tenant Online Rent Payments | RentFray";

const pageDescription =
  "Offer tenants a simple way to pay rent online with RentFray. Landlords and property managers can track payment status and balances without a monthly software subscription.";

const faqItems = [
  {
    question: "Can tenants pay rent online with RentFray?",
    answer:
      "Yes. RentFray gives tenants an online payment flow for recurring rent while giving the property visibility into payment status and balances.",
  },
  {
    question: "Do tenants need a separate mobile app?",
    answer:
      "No separate app is required. Tenants can use RentFray through a web browser.",
  },
  {
    question: "Can landlords see whether a tenant has paid?",
    answer:
      "Yes. RentFray helps landlords and property managers see payment status and tenant balances from the management side.",
  },
  {
    question: "Does RentFray charge landlords a monthly fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software subscription.",
  },
  {
    question: "Do tenants pay a processing fee?",
    answer:
      "Yes. Tenants pay a processing fee when they submit payments through RentFray.",
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

export default function TenantOnlineRentPaymentsPage() {
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
              Give Tenants a Simple Way to Pay Rent Online
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              RentFray gives tenants a clear online rent payment path while
              giving landlords and property managers visibility into payment
              status and balances.
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
                Start Free Setup
              </Link>

              <Link
                href="/how-tenants-pay-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                See How Tenants Pay Online
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Online Rent Payments Should Be Simple for Tenants
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            The tenant side of rent collection should be straightforward.
            Tenants should know where to go, what they owe, and how to submit
            their payment without having to navigate a complicated property
            management system.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray focuses on a clear payment workflow while keeping the
            property side connected to the same recurring rent records.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading>
            What Tenant Online Rent Payments Look Like With RentFray
          </SectionHeading>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <FeatureCard
              title="Clear Online Payment Path"
              description="Tenants have one consistent place to access their rent payment process instead of relying on changing or disconnected payment methods."
            />

            <FeatureCard
              title="Visible Amount Due"
              description="The tenant payment flow is connected to the rent balance so the amount that needs attention is clear."
            />

            <FeatureCard
              title="Payment Status Tracking"
              description="The property can see the status of submitted payments instead of manually confirming whether money arrived."
            />

            <FeatureCard
              title="Recurring Monthly Workflow"
              description="The same rent collection process can be used month after month instead of recreating the routine each cycle."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why a Rent Payment System Is Different From a General Payment App
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            A general payment app can move money, but rent collection involves
            more than the transaction itself. The property still needs to know
            which tenant paid, what amount was due, and whether a balance
            remains.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A dedicated rent payment system connects the tenant payment process
            to the recurring rent record. That gives the tenant a clear place to
            pay and gives the landlord a clearer picture of the month.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              A Better Payment Experience for Both Sides
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              The tenant experience and the landlord experience are closely
              connected. When tenants have a consistent way to pay, the property
              has fewer payment methods and records to reconcile.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              At the same time, tenants benefit from a payment process built
              specifically around rent instead of a generic money-transfer
              workflow.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            How Tenant Payments Connect to Landlord Tracking
          </SectionHeading>

          <div className="mt-8 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900">
                1. Rent is associated with the tenant or unit
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The property has a recurring rent record showing what is owed.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                2. The tenant submits payment online
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The tenant uses RentFray's online payment flow to submit rent.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                3. Stripe handles payment processing
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                Payment processing is handled through Stripe. RentFray does not
                store tenant banking information or hold tenant funds.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                4. The property sees the payment status
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                Owners and managers can review payment status and balances from
                the management side of RentFray.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              No Monthly RentFray Software Fee for the Property
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray does not charge landlords or property managers a monthly
              software subscription.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments. That means
              the property can offer an online rent payment system without
              adding a recurring RentFray software bill.
            </p>

            <div className="mt-6">
              <Link
                href="/free-rent-collection-software-no-monthly-fee"
                className="font-semibold text-slate-900 underline underline-offset-4"
              >
                Learn more about RentFray pricing
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
            <SectionHeading>Related Tenant Payment Resources</SectionHeading>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/how-tenants-pay-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                How Tenants Pay Rent Online
              </Link>

              <Link
                href="/tenant-payment-portal"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>

              <Link
                href="/tenant-rent-payment-options"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Rent Payment Options
              </Link>

              <Link
                href="/easiest-way-for-tenants-to-pay-rent"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Easiest Way for Tenants to Pay Rent
              </Link>

              <Link
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Online Rent Payment System
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Give tenants a clearer way to pay rent online.
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray combines tenant online payments with payment status and
              balance tracking while remaining $0 per month for landlords and
              property managers.
            </p>

            <div className="mt-8">
              <Link
                href="/setup"
                className="inline-block rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Start Free Setup
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}