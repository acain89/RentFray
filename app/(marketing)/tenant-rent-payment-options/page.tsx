import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = "https://www.rentfray.com";
const pagePath = "/tenant-rent-payment-options";
const pageUrl = `${siteUrl}${pagePath}`;

const pageTitle = "Tenant Rent Payment Options | RentFray";

const pageDescription =
  "Compare common tenant rent payment options including checks, cash, bank transfers, payment apps, and dedicated online rent payment systems.";

const faqItems = [
  {
    question: "What are common ways tenants can pay rent?",
    answer:
      "Common rent payment options include checks, cash, bank transfers, general payment apps, and dedicated online rent payment systems.",
  },
  {
    question: "Can tenants pay rent online?",
    answer:
      "Yes. Online rent payment systems give tenants a digital way to submit rent while helping the property keep payment records organized.",
  },
  {
    question: "Do tenants need an app to pay rent with RentFray?",
    answer:
      "No. RentFray is web-based, so tenants do not need to install a separate mobile app.",
  },
  {
    question: "What is the advantage of a dedicated rent payment system?",
    answer:
      "A dedicated rent payment system can connect the payment to the tenant's recurring rent obligation, balance, and payment status instead of treating it as an unrelated money transfer.",
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

function OptionCard({
  title,
  description,
  advantages,
  limitations,
}: {
  title: string;
  description: string;
  advantages: string;
  limitations: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>

      <p className="mt-3 leading-7 text-slate-600">{description}</p>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-900">Advantages</p>
        <p className="mt-1 text-sm leading-7 text-slate-600">{advantages}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">Limitations</p>
        <p className="mt-1 text-sm leading-7 text-slate-600">{limitations}</p>
      </div>
    </div>
  );
}

export default function TenantRentPaymentOptionsPage() {
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
              Tenant Rent Payment Options
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Tenants can pay rent in several ways, from traditional checks and
              cash to bank transfers, payment apps, and dedicated online rent
              payment systems.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Each method can work, but they differ in convenience, record
              keeping, recurring use, and how much manual tracking they create
              for the landlord.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What Makes a Good Rent Payment Option?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            A rent payment method needs to work for both sides. Tenants need a
            clear and practical way to pay, while landlords need accurate
            records showing who paid, what was paid, and what remains due.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Because rent repeats every month, consistency also matters. A method
            that works for a one-time transaction may become cumbersome when it
            has to be received, identified, and recorded across many tenants and
            many rent cycles.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading>
            Comparing Common Tenant Rent Payment Methods
          </SectionHeading>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <OptionCard
              title="Checks"
              description="Paper checks remain a familiar way for tenants to pay rent and provide a physical record of the transaction."
              advantages="Familiar to many tenants and landlords, and does not require the tenant to use an online payment system."
              limitations="Checks have to be delivered, deposited, and matched to the correct tenant and rent cycle. Processing can also take time."
            />

            <OptionCard
              title="Cash"
              description="Cash provides a direct way for a tenant to pay the landlord or property manager."
              advantages="The payment can be handed directly to the property without requiring a banking or online payment account."
              limitations="Cash requires careful receipt and record keeping. Both the tenant and landlord need documentation showing that the payment was received."
            />

            <OptionCard
              title="Bank Transfers"
              description="Electronic bank transfers can move rent from the tenant's bank account without using a paper check."
              advantages="They remove the need to physically deliver and deposit a check."
              limitations="A standalone transfer may still require the landlord to identify the payment and manually connect it to the correct tenant balance."
            />

            <OptionCard
              title="General Payment Apps"
              description="Consumer payment apps can give tenants a convenient digital way to send money."
              advantages="Many tenants are already familiar with digital money-transfer apps and may find them easy to use."
              limitations="General payment apps are designed primarily to transfer money, not to manage recurring rent obligations, tenant balances, or property payment status."
            />

            <OptionCard
              title="Dedicated Online Rent Payment Systems"
              description="A rent-focused system combines the tenant's payment process with the property's recurring rent records."
              advantages="Payments can be connected to tenant balances and payment status, reducing the need to maintain separate payment and tracking systems."
              limitations="Tenants need to use the property's chosen payment process rather than sending rent through whichever method they prefer."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            Why Record Keeping Matters as Much as the Payment Method
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Receiving the money is only part of rent collection. The landlord
            also needs an accurate record showing which tenant paid, which rent
            cycle the payment belongs to, and whether anything remains due.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            When the payment method and the rent tracking system are separate,
            that information often has to be reconciled manually. A dedicated
            rent payment system can keep the transaction and the rent record
            connected.
          </p>

          <div className="mt-6">
            <Link
              href="/how-to-track-tenant-payments"
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Learn how to track tenant payments
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              One-Time Payments vs. Recurring Rent
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              Rent is not a one-time transaction. The same payment process
              usually repeats every month, which changes what makes a payment
              option practical.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              A method that requires manual matching, recording, or follow-up
              once may not seem difficult. Repeating those tasks every month
              across multiple tenants can create substantially more
              administrative work.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              A recurring rent payment system is designed around that repetition
              rather than treating each month's rent as an unrelated
              transaction.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What About Convenience for Tenants?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            Convenience matters because tenants have to use the payment process
            repeatedly. A complicated system can add unnecessary friction to a
            routine monthly obligation.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            A straightforward online payment flow can give tenants a consistent
            place to handle rent without requiring paper payments or a separate
            trip to deliver them.
          </p>

          <div className="mt-6">
            <Link
              href="/easiest-way-for-tenants-to-pay-rent"
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Explore simpler ways for tenants to pay rent
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>
              How RentFray Handles Tenant Rent Payments
            </SectionHeading>

            <p className="mt-5 text-base leading-8 text-slate-600">
              RentFray provides a web-based rent payment flow connected to the
              property's recurring rent records. Tenants can review what they
              owe and submit payment without installing a separate RentFray
              mobile app.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              On the management side, landlords and property managers can review
              payment status and tenant balances instead of treating each
              payment as an isolated transfer.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Payment processing is handled through Stripe. RentFray does not
              store tenant banking information or hold tenant funds.
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SectionHeading>
            What Does RentFray Cost?
          </SectionHeading>

          <p className="mt-5 text-base leading-8 text-slate-600">
            RentFray is $0 per month for landlords and property managers. There
            is no monthly RentFray software subscription for the property.
          </p>

          <p className="mt-4 text-base leading-8 text-slate-600">
            Tenants pay a processing fee when they submit payments. That pricing
            model allows the property to use RentFray's rent collection and
            tracking workflow without adding a recurring monthly software bill.
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
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <SectionHeading>Frequently Asked Questions</SectionHeading>

            <div className="mt-8 space-y-4">
              {faqItems.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
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
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Want a simpler online rent payment option?
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-slate-300">
              RentFray gives tenants a web-based way to submit rent while
              keeping payment status and balances organized for the property.
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