import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Payment System for Self Storage Facilities | RentFray",
  description:
    "Manage storage unit payments with a simple, free system. Track billing and payments clearly.",
  alternates: {
    canonical: "https://rentfray.com/self-storage-payment-system",
  },
  openGraph: {
    title: "Free Payment System for Self Storage Facilities | RentFray",
    description:
      "Manage storage unit payments with a simple, free system.",
    url: "https://rentfray.com/self-storage-payment-system",
    siteName: "RentFray",
    type: "website",
  },
};

export default function SelfStoragePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Payment System for Self Storage Facilities
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">
          Track Payments Across Units
        </h2>
        <p className="text-slate-600">
          RentFray provides clear payment tracking for storage businesses.
        </p>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Simplify storage billing with RentFray.
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