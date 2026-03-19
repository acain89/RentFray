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
    const unitId = localStorage.getItem("unitId");

    if (!unitId) {
      window.location.href = "/tenant";
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/tenant/maintenance/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result?.error || "Failed to load maintenance.");
        return;
      }

      setData(result);
    } catch {
      setError("Failed to load maintenance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRequest() {
    const unitId = localStorage.getItem("unitId");

    if (!unitId) {
      window.location.href = "/tenant";
      return;
    }

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch("/api/tenant/maintenance/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          category,
          urgency,
          description,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result?.error || "Failed to submit request.");
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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Maintenance</h1>
        <div className="text-sm text-gray-600">
          {data?.propertyName} · Unit {data?.unitNumber}
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="space-y-3 rounded border p-4">
        <div className="font-medium">Submit Request</div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="PLUMBING">Plumbing</option>
          <option value="ELECTRICAL">Electrical</option>
          <option value="HVAC">HVAC</option>
          <option value="APPLIANCE">Appliance</option>
          <option value="PEST">Pest</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="EMERGENCY">Emergency</option>
        </select>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue"
          className="w-full rounded border px-3 py-2"
          rows={4}
        />

        <button
          type="button"
          onClick={submitRequest}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Request"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="font-medium">Request History</div>

        {!data?.requests?.length ? (
          <div className="rounded border p-3 text-sm text-gray-500">
            No maintenance requests yet.
          </div>
        ) : (
          data.requests.map((row) => (
            <div
              key={row.id}
              className="space-y-3 rounded border p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="font-medium">{row.category}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Urgency</div>
                  <div>{row.urgency}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div>{row.status}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Submitted</div>
                  <div>{fmtDateTime(row.createdAt)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Description</div>
                <div>{row.description}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Last Updated</div>
                <div>{fmtDateTime(row.updatedAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}