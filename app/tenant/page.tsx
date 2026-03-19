"use client";

import Link from "next/link";

export default function TenantPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Tenant Portal</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to your tenant portal.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/tenant/balance"
              className="rounded-xl border p-4 transition hover:bg-gray-50"
            >
              <div className="text-base font-medium">Balance</div>
              <div className="mt-1 text-sm text-gray-600">
                View current charges, payments, and running balance.
              </div>
            </Link>

            <Link
              href="/tenant/history"
              className="rounded-xl border p-4 transition hover:bg-gray-50"
            >
              <div className="text-base font-medium">Payment History</div>
              <div className="mt-1 text-sm text-gray-600">
                View posted payment history for your unit.
              </div>
            </Link>

            <Link
              href="/tenant/maintenance"
              className="rounded-xl border p-4 transition hover:bg-gray-50"
            >
              <div className="text-base font-medium">Maintenance</div>
              <div className="mt-1 text-sm text-gray-600">
                Create and track maintenance requests.
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}