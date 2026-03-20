// app/maintenance/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RequestRow = {
  id: string;
  unitNumber: string;
  tenantName: string | null;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-US");
}

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default function MaintenancePage() {
  const router = useRouter();

  const [data, setData] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/manager/maintenance", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.status === 401) {
        router.replace("/");
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to load requests.");
        return;
      }

      setData(json.requests || []);
    } catch {
      setError("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(requestId: string, status: string) {
    try {
      setSavingId(requestId);
      setError("");

      const res = await fetch("/api/manager/maintenance/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          status,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to update request.");
        return;
      }

      await load();
    } catch {
      setError("Failed to update request.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Maintenance Portal</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Property maintenance requests
        </p>
      </div>

      {error ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="border rounded-xl p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4">Open Requests</h2>

        {data.length === 0 ? (
          <div className="text-sm text-neutral-600">No maintenance requests found.</div>
        ) : (
          <div className="space-y-3">
            {data.map((row) => (
              <div key={row.id} className="border rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <div><span className="font-medium">Unit:</span> {row.unitNumber}</div>
                  <div><span className="font-medium">Tenant:</span> {row.tenantName || "—"}</div>
                  <div><span className="font-medium">Category:</span> {row.category}</div>
                  <div><span className="font-medium">Urgency:</span> {row.urgency}</div>
                  <div><span className="font-medium">Status:</span> {row.status}</div>
                </div>

                <div className="text-sm whitespace-pre-wrap">{row.description}</div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
                  <select
                    className="border rounded-lg px-3 py-2"
                    value={row.status}
                    onChange={(e) => updateStatus(row.id, e.target.value)}
                    disabled={savingId === row.id}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <div className="text-xs text-neutral-500">
                    Updated: {fmtDateTime(row.updatedAt)}
                  </div>
                </div>

                <div className="text-xs text-neutral-500">
                  Created: {fmtDateTime(row.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}