"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RoleSelectPage() {
  const params = useSearchParams();
  const router = useRouter();

  const code = params.get("code") || "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!code || code.length !== 4) {
        setError("Invalid property code.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/public/property/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Invalid property.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [code]);

  function go(role: "manager" | "tenant" | "maintenance") {
    router.push(`/login/${role}?code=${code}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full border rounded-xl p-6 text-center">
          <div className="text-red-600 text-sm">{error}</div>
          <button
            onClick={() => router.push("/property-code")}
            className="mt-4 w-full border rounded-lg py-2"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border rounded-xl p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold">Select Role</h1>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => go("manager")}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Manager
          </button>

          <button
            onClick={() => go("tenant")}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Tenant
          </button>

          <button
            onClick={() => go("maintenance")}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Maintenance
          </button>
        </div>
      </div>
    </div>
  );
}