import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Free Online Rent Payment System for Apartment Complexes | RentFray",
  description:
    "Collect rent online and track tenant payments with a simple, free system built for apartment complexes. No software cost for property managers.",
  alternates: {
    canonical:
      "https://rentfray.com/online-rent-payment-system-apartments",
  },
  openGraph: {
    title:
      "Free Online Rent Payment System for Apartment Complexes | RentFray",
    description:
      "Collect rent online and track tenant payments with a simple, free system built for apartment complexes.",
    url: "https://rentfray.com/online-rent-payment-system-apartments",
    siteName: "RentFray",
    type: "website",
  },
};

export default function ApartmentsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">
        Free Online Rent Payment System for Apartment Complexes
      </h1>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">
          Stop Chasing Rent Across Multiple Units
        </h2>
        <p className="text-slate-600">
          Managing rent across dozens of tenants shouldn’t require spreadsheets,
          reminders, and manual tracking. RentFray gives apartment managers a
          clear, structured system to collect rent and track every payment in
          one place.
        </p>
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-xl font-semibold">
          Built for Apartment Operations
        </h2>

        <div>
          <h3 className="font-semibold">Collect Rent Online</h3>
          <p className="text-slate-600">
            Tenants pay through a simple, guided payment flow with full
            transparency.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">Track Every Unit in Real Time</h3>
          <p className="text-slate-600">
            See exactly who has paid, who has not, and what is due across all
            units.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">No Software Cost for Managers</h3>
          <p className="text-slate-600">
            RentFray is free for apartment owners and managers. Tenants pay a
            small processing fee.
          </p>
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">
          Full Visibility Without Complexity
        </h2>
        <p className="text-slate-600">
          RentFray provides a clear, real-time view of payment status across
          every unit. No guessing, no delays, no hidden data.
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>

        <div>
          <h3 className="font-semibold">
            How do I collect rent online for an apartment complex?
          </h3>
          <p className="text-slate-600">
            RentFray allows apartment managers to collect rent through a
            centralized online payment system.
          </p>
        </div>

        <div>
          <h3 className="font-semibold">
            Is RentFray free for apartment managers?
          </h3>
          <p className="text-slate-600">
            Yes. RentFray is free for businesses. Tenants pay a small processing
            fee.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-lg font-semibold">
          Collect rent with clarity and full visibility using RentFray.
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-3 text-sm">
        <a
          href="/rent-collection-software-landlords"
          className="text-blue-600 hover:underline"
        >
          Landlord Rent Collection Software
        </a>
        <a
          href="/mobile-home-park-rent-collection"
          className="text-blue-600 hover:underline"
        >
          Mobile Home Park Payment System
        </a>
      </section>
    </main>
  );
}