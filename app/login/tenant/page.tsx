"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const code = params.get("code") || "";

  const [unitNumber, setUnitNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function cleanUnit(value: string) {
    return value.trim().toUpperCase();
  }

  function cleanPin(value: string) {
    return value.replace(/\D/g, "").slice(0, 4);
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();

    if (loading) return;

    setError("");

    if (!code || code.length !== 4) {
      setError("Invalid property code.");
      return;
    }

    if (!unitNumber.trim()) {
      setError("Unit number required.");
      return;
    }

    if (pin.length !== 4) {
      setError("Enter 4-digit PIN.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/tenant/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyCode: code,
          unitNumber: cleanUnit(unitNumber),
          pin: pin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Login failed.");
      }

      // redirect to tenant dashboard
      router.push("/tenant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-center">
          Tenant Login
        </h1>

        <div className="mt-2 text-center text-sm text-gray-500">
          Property Code: {code}
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Unit Number (e.g. 101)"
              className="w-full border rounded-lg px-3 py-3 outline-none text-center"
            />
          </div>

          <div>
            <input
              value={pin}
              onChange={(e) => setPin(cleanPin(e.target.value))}
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit PIN"
              className="w-full border rounded-lg px-3 py-3 outline-none text-center tracking-widest"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600 text-center">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}