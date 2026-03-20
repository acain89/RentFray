// app/property-code/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PropertyCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length !== 4) {
      setError("Enter a valid 4-digit property code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/property/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Invalid property code.");
        setLoading(false);
        return;
      }

      router.replace(`/role-select?code=${encodeURIComponent(cleanCode)}`);
    } catch {
      setError("Unable to verify property code.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Property Code
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Enter your 4-digit property code to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="property-code"
                className="mb-2 block text-sm font-medium"
              >
                Property Code
              </label>
              <input
                id="property-code"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="one-time-code"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  const next = e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4);
                  setCode(next);
                }}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-black"
                placeholder="1234"
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
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}