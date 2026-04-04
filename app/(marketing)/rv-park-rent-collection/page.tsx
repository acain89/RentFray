import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Rent Payment System for RV Parks | RentFray",
  description:
    "Collect rent and track payments across RV park spaces with a simple, free system.",
  alternates: {
    canonical: "https://rentfray.com/rv-park-rent-collection",
  },
  openGraph: {
    title: "Free Rent Payment System for RV Parks | RentFray",
    description:
      "Collect rent and track payments across RV park spaces with a simple, free system.",
    url: "https://rentfray.com/rv-park-rent-collection",
    siteName: "RentFray",
    type: "website",
  },
};

export default function RVParksPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Rent Payment System for RV Parks
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Manage Rent Across Every Space</h2>
        <p className="text-slate-600">
          RentFray provides a clean system to manage rent across RV spaces.
        </p>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold">Built for RV Park Operators</h2>

        <div>
          <h3 className="font-semibold">Track Payments Easily</h3>
          <p className="text-slate-600">Know who has paid instantly.</p>
        </div>

        <div>
          <h3 className="font-semibold">Simple Tenant Payments</h3>
          <p className="text-slate-600">Tenants pay quickly and easily.</p>
        </div>

        <div>
          <h3 className="font-semibold">No Software Cost</h3>
          <p className="text-slate-600">Operate without platform fees.</p>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>

        <div>
          <h3 className="font-semibold">Can RV parks collect rent online?</h3>
          <p className="text-slate-600">
            Yes, RentFray supports RV park rent collection.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Track RV rent payments clearly with RentFray.
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
          href="/rent-collection-software-landlords"
          className="text-blue-600 hover:underline"
        >
          Rent Collection Software for Landlords
        </a>
      </section>
    </main>
  );
}