"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ManagerLoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const code = params.get("code") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();

    if (loading) return;

    setError("");

    if (!code || code.length !== 4) {
      setError("Invalid property code.");
      return;
    }

    if (!email.trim()) {
      setError("Email required.");
      return;
    }

    if (!password) {
      setError("Password required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/manager/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyCode: code,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Login failed.");
      }

      router.push("/manager");
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
          Manager Login
        </h1>

        <div className="mt-2 text-center text-sm text-gray-500">
          Property Code: {code}
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Manager Email"
              className="w-full border rounded-lg px-3 py-3 outline-none text-center"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border rounded-lg px-3 py-3 outline-none text-center"
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
}s