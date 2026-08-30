import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/easiest-way-for-tenants-to-pay-rent";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "Easiest Way for Tenants to Pay Rent | RentFray";

const pageDescription =
  "Learn what makes rent payment easy for tenants. RentFray provides a simple web-based payment flow with no required app and clear recurring rent payment access.";

const faqItems = [
  {
    question: "What is the easiest way for tenants to pay rent?",
    answer:
      "The easiest option is usually a consistent online payment process that is simple to access, shows what is owed clearly, and does not require unnecessary steps.",
  },
  {
    question: "Do tenants need to download an app to use RentFray?",
    answer:
      "No. RentFray is web-based, so tenants can use the payment flow through a browser without installing a separate mobile app.",
  },
  {
    question: "Can tenants see what they owe before paying?",
    answer:
      "Yes. RentFray connects the tenant payment flow to the rent balance so the amount requiring attention is clear.",
  },
  {
    question: "Are payments processed through RentFray?",
    answer:
      "Payments are processed through Stripe. RentFray does not store tenant banking information or hold tenant funds.",
  },
  {
    question: "Does RentFray charge landlords a monthly software fee?",
    answer:
      "No. RentFray does not charge landlords, property owners, or property managers a monthly software subscription. Tenants pay a processing fee when they submit payments.",
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
    type: "article",
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

function EaseCard({
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

export default function EasiestWayForTenantsToPayRentPage() {
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
              RentFray Guide
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              The Easiest Way for Tenants to Pay Rent
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              The easiest rent payment process is usually the one tenants can
              understand immediately, access consistently, and repeat each month
              without extra friction.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray gives tenants a web-based payment path with no required
              app while keeping the payment connected to the property's rent
              records.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What Makes Rent Payment Easy for a Tenant?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Convenience is not just about moving money quickly. For recurring
            rent, the tenant also needs to know where to go, what amount needs
            attention, and what happens after payment is submitted.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A simple process removes unnecessary decisions. Instead of choosing
            between different payment methods every month, the tenant can follow
            one familiar path.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading>
            Five Things That Make Rent Easier to Pay
          </SectionHeading>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <EaseCard
              title="One Consistent Payment Location"
              description="Tenants should know exactly where to go when rent is due instead of searching through messages or switching between payment methods."
            />

            <EaseCard
              title="No Required App Download"
              description="A browser-based payment process removes the extra step of installing and maintaining another mobile app."
            />

            <EaseCard
              title="A Clear Amount Due"
              description="Tenants should be able to understand what amount requires payment before beginning the transaction."
            />

            <EaseCard
              title="A Straightforward Payment Flow"
              description="The process should stay focused on the task of paying rent instead of surrounding it with unnecessary software complexity."
            />

            <EaseCard
              title="The Same Routine Next Month"
              description="Because rent is recurring, the easiest system is one that becomes familiar rather than changing from one month to the next."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why Requiring an App Can Add Friction
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Mobile apps can be useful, but an app should not be required simply
            to complete a basic recurring payment. Downloading an app,
            maintaining another login, and keeping the app installed can add
            steps to an otherwise simple task.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray works through a web browser, so tenants can use the payment
            flow without installing a separate RentFray app.
          </p>

          <div className="mt-6">
            <Link
              href="/rent-payment-app"
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Read about rent payment apps
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Why One Clear Payment Path Matters
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              A tenant may technically be able to pay rent through several
              different methods, but more choices do not always create a simpler
              experience.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              When the property uses one consistent rent payment system, the
              tenant knows what process to follow. The landlord also has fewer
              disconnected payment sources to reconcile afterward.
            </p>

            <div className="mt-6">
              <Link
                href="/tenant-rent-payment-options"
                className="font-semibold text-slate-900 underline underline-offset-4"
              >
                Compare tenant rent payment options
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why Seeing the Amount Due Matters
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Payment becomes harder when a tenant has to stop and confirm how
            much is owed before proceeding.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A rent-focused payment process can connect the tenant experience to
            the property's rent records so the payment is tied to an actual
            balance instead of functioning as a completely separate money
            transfer.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              How RentFray Makes the Process Simple
            </SectionHeading>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900">
                  1. The tenant accesses RentFray online
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  The payment experience works through a web browser, so no
                  separate RentFray app is required.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  2. The tenant reviews what is owed
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  The payment flow is connected to the tenant's rent balance.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  3. The tenant submits the payment
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Payment processing is handled through Stripe. RentFray does
                  not store tenant banking information or hold tenant funds.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  4. The property tracks the result
                </h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Landlords and property managers can review payment status and
                  tenant balances from the management side.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Easy for Tenants Should Also Mean Easier to Manage
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            A payment method is less useful if convenience for the tenant creates
            extra reconciliation work for the landlord.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray keeps the tenant payment experience connected to payment
            status and balance tracking, so the property is not left with a
            separate pile of transactions that still need to be manually
            interpreted.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/tenant-payment-portal"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Tenant Payment Portal
            </Link>

            <Link
              href="/how-tenants-pay-rent-online"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              How Tenants Pay Online
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              What Does RentFray Cost?
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray is $0 per month for landlords and property managers.
              There is no monthly RentFray software subscription for the
              property.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments.
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
                href="/tenant-payment-portal"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Payment Portal
              </Link>

              <Link
                href="/tenant-online-rent-payments"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Online Rent Payments
              </Link>

              <Link
                href="/how-tenants-pay-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                How Tenants Pay Rent Online
              </Link>

              <Link
                href="/tenant-rent-payment-options"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tenant Rent Payment Options
              </Link>

              <Link
                href="/collect-rent-online"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Collect Rent Online
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Make rent easier for tenants to pay each month.
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              Give tenants one web-based payment path while keeping payment
              status and balances connected to the property's rent records.
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