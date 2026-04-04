import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Rent Collection System for Mobile Home Parks | RentFray",
  description:
    "Track lot rent and collect payments with a simple, free system built for mobile home parks.",
  alternates: {
    canonical:
      "https://rentfray.com/mobile-home-park-rent-collection",
  },
  openGraph: {
    title:
      "Free Rent Collection System for Mobile Home Parks | RentFray",
    description:
      "Track lot rent and collect payments with a simple, free system built for mobile home parks.",
    url: "https://rentfray.com/mobile-home-park-rent-collection",
    siteName: "RentFray",
    type: "website",
  },
};

export default function MobileHomeParksPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Rent Collection System for Mobile Home Parks
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">
          Track Lot Rent Across Your Park
        </h2>
        <p className="text-slate-600">
          RentFray simplifies rent collection across mobile home parks with a
          clear, structured system.
        </p>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold">
          Built for Park Operators
        </h2>

        <div>
          <h3 className="font-semibold">Organized Lot Tracking</h3>
          <p className="text-slate-600">
            Track rent across every unit.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Clear Payment Visibility</h3>
          <p className="text-slate-600">
            Know who has paid instantly.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">No Software Cost</h3>
          <p className="text-slate-600">
            Operate without monthly fees.
          </p>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold">
          Frequently Asked Questions
        </h2>

        <div>
          <h3 className="font-semibold">
            Can I track lot rent payments?
          </h3>
          <p className="text-slate-600">
            Yes, RentFray is built for mobile home parks.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Simplify lot rent collection with RentFray.
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