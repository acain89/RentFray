// app/login/maintenance/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MaintenanceLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyCode = searchParams.get("code") || "";

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (!propertyCode) {
      setError("Missing property code.");
      return;
    }

    if (!pin.trim()) {
      setError("Enter PIN.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "MAINTENANCE",
          propertyCode,
          pin: pin.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Login failed.");
        setLoading(false);
        return;
      }

      router.push("/maintenance");
    } catch {
      setError("Login error.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Maintenance Login
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Enter your maintenance PIN.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                placeholder="••••"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}