// app/manager/maintenance/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

type MaintenanceRequestRow = {
  id: string;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  unit: {
    id: string;
    unitNumber: string;
  } | null;
};

type MaintenanceResponse = {
  ok: true;
  requests: MaintenanceRequestRow[];
};

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED"] as const;

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-US");
}

export default function ManagerMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/manager/maintenance", {
        cache: "no-store",
      });

      const data = (await res.json()) as MaintenanceResponse | { error?: string };

      if (!res.ok) {
        setError(data?.error || "Failed to load maintenance requests.");
        setLoading(false);
        return;
      }

      setRequests(data.requests || []);
      setLoading(false);
    } catch {
      setError("Failed to load maintenance requests.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateStatus(requestId: string, status: string) {
    if (savingId) return;

    setSavingId(requestId);
    setError("");

    try {
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

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to update request.");
        setSavingId("");
        return;
      }

      setRequests((prev) =>
        prev.map((row) =>
          row.id === requestId
            ? {
                ...row,
                status: data.request.status,
                updatedAt: data.request.updatedAt,
              }
            : row
        )
      );

      setSavingId("");
    } catch {
      setError("Failed to update request.");
      setSavingId("");
    }
  }

  const filteredRequests = useMemo(() => {
    if (statusFilter === "ALL") return requests;
    return requests.filter((row) => row.status === statusFilter);
  }, [requests, statusFilter]);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Maintenance</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Review and update property maintenance requests.
            </p>
          </div>

          <div className="w-full sm:w-56">
            <label className="mb-2 block text-sm font-medium">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
            >
              <option value="ALL">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-neutral-600">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-sm text-neutral-600">No maintenance requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-sm">
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Urgency</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top">
                      <td className="px-4 py-3 text-sm">{row.unit?.unitNumber || "—"}</td>
                      <td className="px-4 py-3 text-sm">{row.category}</td>
                      <td className="px-4 py-3 text-sm">{row.urgency}</td>
                      <td className="px-4 py-3 text-sm">{row.status}</td>
                      <td className="px-4 py-3 text-sm">{row.description}</td>
                      <td className="px-4 py-3 text-sm">{fmtDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={row.status}
                          disabled={savingId === row.id}
                          onChange={(e) => updateStatus(row.id, e.target.value)}
                          className="w-full min-w-[160px] rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-black disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}