// app/tenant/maintenance/page.tsx

"use client";

import { useEffect, useState } from "react";

type MaintenanceRow = {
  id: string;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type MaintenanceData = {
  ok: true;
  propertyName: string;
  unitNumber: string;
  requests: MaintenanceRow[];
};

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-US");
}

export default function TenantMaintenancePage() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [category, setCategory] = useState("PLUMBING");
  const [urgency, setUrgency] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/tenant/maintenance", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to load maintenance.");
        return;
      }

      setData(json);
    } catch {
      setError("Failed to load maintenance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch("/api/tenant/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          urgency,
          description,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to submit request.");
        return;
      }

      setDescription("");
      await load();
    } catch {
      setError("Failed to submit request.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Maintenance</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {data?.propertyName} — Unit {data?.unitNumber}
        </p>
      </div>

      <form onSubmit={submitRequest} className="border rounded-xl p-4 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Create Request</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm font-medium">Category</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="PLUMBING">PLUMBING</option>
              <option value="ELECTRICAL">ELECTRICAL</option>
              <option value="HVAC">HVAC</option>
              <option value="APPLIANCE">APPLIANCE</option>
              <option value="GENERAL">GENERAL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Urgency</div>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="EMERGENCY">EMERGENCY</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 block">
          <div className="text-sm font-medium">Description</div>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue"
            required
          />
        </label>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Request"}
        </button>
      </form>

      <div className="border rounded-xl p-4 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Request History</h2>

        {!data?.requests?.length ? (
          <div className="text-sm text-neutral-600">No requests yet.</div>
        ) : (
          <div className="space-y-3">
            {data.requests.map((row) => (
              <div key={row.id} className="border rounded-xl p-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <div><span className="font-medium">Category:</span> {row.category}</div>
                  <div><span className="font-medium">Urgency:</span> {row.urgency}</div>
                  <div><span className="font-medium">Status:</span> {row.status}</div>
                </div>

                <div className="mt-3 text-sm whitespace-pre-wrap">{row.description}</div>

                <div className="mt-3 text-xs text-neutral-500">
                  Created: {fmtDateTime(row.createdAt)}
                </div>
                <div className="text-xs text-neutral-500">
                  Updated: {fmtDateTime(row.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}