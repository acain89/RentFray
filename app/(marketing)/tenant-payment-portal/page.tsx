import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/tenant-payment-portal";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "Tenant Payment Portal | RentFray";

const pageDescription =
  "Give tenants a simple online payment portal for recurring rent. RentFray lets tenants review what they owe and submit payments while landlords track payment status and balances.";

const faqItems = [
  {
    question: "What is a tenant payment portal?",
    answer:
      "A tenant payment portal is an online place where tenants can review what they owe and submit rent payments through a structured payment flow.",
  },
  {
    question: "Does RentFray provide a tenant payment portal?",
    answer:
      "Yes. RentFray gives tenants a web-based payment experience connected to the property's rent records.",
  },
  {
    question: "Do tenants need to install an app?",
    answer:
      "No. RentFray works through a web browser, so tenants do not need to install a separate mobile app.",
  },
  {
    question: "Can landlords track payments submitted through the portal?",
    answer:
      "Yes. Landlords and property managers can review payment status and tenant balances from the management side of RentFray.",
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

export default function TenantPaymentPortalPage() {
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
              A Simple Tenant Payment Portal for Online Rent
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Give tenants one clear online place to review what they owe and
              submit rent payments while keeping payment status and balances
              visible to the property.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray is web-based, so tenants do not need to install a
              separate app. Landlords and property managers pay $0 per month for
              RentFray software, while tenants pay a processing fee when they
              submit payments.
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
                See How Tenant Payments Work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What Is a Tenant Payment Portal?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            A tenant payment portal is the tenant-facing part of an online rent
            collection system. It gives tenants a dedicated place to handle
            their rent payment instead of relying on checks, cash, or unrelated
            money-transfer services.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            The most useful portal does more than accept money. It connects the
            tenant's payment to the property's rent records so both sides have a
            clearer view of what is owed and what has been paid.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading>
            What Tenants Can Do Through RentFray
          </SectionHeading>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <FeatureCard
              title="Access Rent Online"
              description="Tenants have a consistent web-based payment path they can return to when rent is due."
            />

            <FeatureCard
              title="Review the Amount Owed"
              description="The payment experience is connected to the tenant's rent balance so the amount requiring attention is clear."
            />

            <FeatureCard
              title="Submit Payment"
              description="Tenants can follow the online payment flow to submit rent through RentFray."
            />

            <FeatureCard
              title="Use the Same Process Each Month"
              description="A recurring payment portal gives tenants a familiar monthly workflow instead of changing payment methods from one cycle to the next."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What the Property Sees on the Other Side
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            The tenant portal is only one half of the process. Once a payment is
            submitted, landlords and property managers still need to understand
            what happened.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray connects the tenant payment experience to landlord-side
            balance and payment status tracking. That helps the property see
            which tenants have paid, which payments are still processing, and
            which balances still need attention.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              A Web-Based Portal Without a Required App
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Requiring tenants to download another app can add an unnecessary
              step to a task they already need to complete every month.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              RentFray works through the web. Tenants can use the payment flow
              from a browser without installing a separate RentFray mobile app.
            </p>

            <div className="mt-6">
              <Link
                href="/rent-payment-app"
                className="font-semibold text-slate-900 underline underline-offset-4"
              >
                Compare the rent payment app approach
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            How a Tenant Payment Portal Fits Into Rent Collection
          </SectionHeading>

          <div className="mt-8 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900">
                1. The property maintains the rent record
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The tenant or unit has a recurring rent obligation and a balance
                associated with it.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                2. The tenant accesses the payment portal
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The tenant enters RentFray's web-based payment experience and
                reviews the amount requiring payment.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                3. The tenant submits payment
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The tenant follows the payment flow and submits rent online.
                Payment processing is handled through Stripe.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                4. RentFray tracks the payment result
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                The property can review payment status and the tenant's
                remaining balance from the management side.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              Secure Payment Processing Through Stripe
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray uses Stripe for payment processing. RentFray does not
              store tenant banking information or hold tenant funds.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              That allows RentFray to focus on the rent collection workflow,
              tenant balances, and payment visibility while Stripe handles the
              payment-processing infrastructure.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Designed for Recurring Rent, Not Just One-Time Payments
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Rent is different from a typical one-time purchase. The same tenant
            usually has another payment obligation next month, so the payment
            experience needs to work as part of a recurring cycle.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            RentFray keeps the tenant payment experience connected to that
            recurring rent workflow rather than treating each payment as an
            isolated transaction.
          </p>

          <div className="mt-6">
            <Link
              href="/tenant-online-rent-payments"
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Learn more about tenant online rent payments
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              No Monthly RentFray Software Fee for Landlords
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Landlords and property managers do not pay a monthly RentFray
              software subscription.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Tenants pay a processing fee when they submit payments. That gives
              the property a tenant payment portal and rent tracking workflow
              without adding a recurring RentFray software bill.
            </p>
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
                href="/online-rent-payment-system"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Online Rent Payment System
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
              Give tenants one clear place to pay rent.
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray connects a simple tenant payment experience with the
              payment status and balance visibility landlords need each month.
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