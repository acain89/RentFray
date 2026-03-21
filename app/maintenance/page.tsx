// app/maintenance/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RequestRow = {
  id: string;
  unitNumber: string;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
};

export default function MaintenancePage() {
  const router = useRouter();

  const [data, setData] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/manager/maintenance", {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!active) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok || !json?.ok) {
          setError(json?.error || "Failed to load maintenance.");
          return;
        }

        setData(json.requests || []);
      } catch {
        if (!active) return;
        setError("Failed to load maintenance.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-neutral-600">
          Loading...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">
          Maintenance
        </h1>

        {data.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">
            No maintenance requests.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-neutral-200 p-4 space-y-1"
              >
                <div className="text-sm font-medium">
                  Unit {req.unitNumber} · {req.category}
                </div>
                <div className="text-sm text-neutral-600">
                  {req.description}
                </div>
                <div className="text-xs text-neutral-500">
                  {req.status} · {req.urgency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}