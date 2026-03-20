// app/login/maintenance/MaintenanceLoginClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  propertyCode: string;
};

export default function MaintenanceLoginClient({ propertyCode }: Props) {
  const router = useRouter();

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
        credentials: "include",
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

      router.replace("/maintenance");
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
              Enter your 4-digit PIN.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                4-Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                placeholder="••••"
                autoComplete="off"
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