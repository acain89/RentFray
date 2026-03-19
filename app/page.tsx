"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold">RentFray</h1>

        <p className="mt-3 text-sm text-gray-600">
          Property management, rebuilt around a ledger-first system.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => router.push("/property-code")}
            className="w-full bg-black text-white py-3 rounded-lg font-medium"
          >
            Existing Members
          </button>
        </div>
      </div>
    </div>
  );
}