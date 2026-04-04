import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Rent Collection Software for Landlords | RentFray",
  description:
    "Simple rent collection software for landlords. Collect rent online and track tenant payments with no software cost.",
  alternates: {
    canonical: "https://rentfray.com/rent-collection-software-landlords",
  },
  openGraph: {
    title: "Free Rent Collection Software for Landlords | RentFray",
    description:
      "Simple rent collection software for landlords. Collect rent online and track tenant payments with no software cost.",
    url: "https://rentfray.com/rent-collection-software-landlords",
    siteName: "RentFray",
    type: "website",
  },
};

export default function LandlordsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Rent Collection Software for Landlords
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">
          A Simple Way to Collect and Track Rent
        </h2>
        <p className="text-slate-600">
          Managing rent should be simple. RentFray allows landlords to collect
          payments and track balances without complicated tools.
        </p>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold">Built for Landlords</h2>

        <div>
          <h3 className="font-semibold">Clear Payment Tracking</h3>
          <p className="text-slate-600">
            See exactly who has paid and what is due.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Simple Tenant Experience</h3>
          <p className="text-slate-600">
            Tenants pay through an easy-to-follow process.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">No Software Cost</h3>
          <p className="text-slate-600">RentFray is free for landlords.</p>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>

        <div>
          <h3 className="font-semibold">
            How can landlords collect rent online?
          </h3>
          <p className="text-slate-600">
            Using RentFray, landlords can accept payments through a simple
            online system.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Does RentFray cost money?</h3>
          <p className="text-slate-600">No. It is free for landlords.</p>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Manage rent collection without complexity using RentFray.
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-3 text-sm">
        <a
          href="/online-rent-payment-system-apartments"
          className="text-blue-600 hover:underline"
        >
          Online Rent Payment System for Apartment Complexes
        </a>
        <a
          href="/rv-park-rent-collection"
          className="text-blue-600 hover:underline"
        >
          RV Park Rent Collection
        </a>
      </section>
    </main>
  );
}