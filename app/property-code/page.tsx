"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PropertyCodePage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 4);
    setCode(clean);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (loading) return;

    setError("");

    if (code.length !== 4) {
      setError("Enter a valid 4-digit code.");
      return;
    }

    setLoading(true);

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
        throw new Error(data?.error || "Invalid property code.");
      }

      router.push(`/role-select?code=${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm border rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-center">
          Enter Property Code
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3 outline-none"
          />

          {error ? (
            <div className="text-sm text-red-600 text-center">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}