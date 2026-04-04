import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Payment Tracking System for Car Lots | RentFray",
  description:
    "Track recurring payments for buy-here-pay-here car lots with a simple, free system.",
  alternates: {
    canonical: "https://rentfray.com/buy-here-pay-here-payment-system",
  },
  openGraph: {
    title: "Free Payment Tracking System for Car Lots | RentFray",
    description:
      "Track recurring payments for buy-here-pay-here car lots with a simple, free system.",
    url: "https://rentfray.com/buy-here-pay-here-payment-system",
    siteName: "RentFray",
    type: "website",
  },
};

export default function CarLotsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Payment Tracking System for Car Lots
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">
          Track Customer Payments Clearly
        </h2>
        <p className="text-slate-600">
          RentFray helps track recurring payments for vehicle financing.
        </p>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Track payments with clarity using RentFray.
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