// app/login/manager/ManagerLoginClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ManagerLoginClientProps = {
  propertyCode: string;
};

export default function ManagerLoginClient({
  propertyCode,
}: ManagerLoginClientProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (!propertyCode) {
      setError("Missing property code.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Enter email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/manager/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          propertyCode,
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Login failed.");
        setLoading(false);
        return;
      }

      router.replace("/manager/dashboard");
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
              Manager Login
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Enter your email and password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                placeholder="manager@test.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                placeholder="••••••••"
                autoComplete="current-password"
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