"use client";

import { useCallback, useEffect, useState } from "react";
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

const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETE", "THIRD_PARTY"] as const;

export default function MaintenanceDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRequests = useCallback(async (isActive: () => boolean = () => true) => {
    const response = await fetch("/api/maintenance/dashboard", { cache: "no-store" });
    if (!isActive()) return;
    if (response.status === 401) {
      setRequests(null);
      router.replace("/property-code");
      return;
    }
    const data = await response.json();
    if (!isActive()) return;
    if (!response.ok || !data?.ok) throw new Error("Unable to load requests");
    setRequests(data.requests);
  }, [router]);

  useEffect(() => {
    let active = true;
    void loadRequests(() => active).catch(() => {
      if (active) setError("Unable to load maintenance requests. Please refresh to try again.");
    });
    return () => { active = false; };
  }, [loadRequests]);

  async function updateRequest(requestId: string, instruction: { status: string } | { action: "DELETE" }) {
    if (busy) return;
    if ("action" in instruction && !window.confirm("Delete this maintenance request?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/manager/maintenance/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...instruction }),
      });
      if (response.status === 401) {
        setRequests(null);
        router.replace("/property-code");
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error("Unable to update request");
      await loadRequests();
    } catch {
      setError("Unable to update or reload maintenance requests. Please refresh before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error("Logout failed");
      setRequests(null);
      window.location.href = "/property-code";
    } catch {
      setError("Unable to log out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-black">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Maintenance</h1>
          <button type="button" disabled={busy} onClick={() => void logout()} className="rounded-xl border px-4 py-2 disabled:opacity-50">Logout</button>
        </header>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {requests === null && !error && <p>Loading maintenance requests...</p>}
        {requests?.length === 0 && <p>No maintenance requests.</p>}
        {requests?.map(request => (
          <article key={request.id} className="space-y-3 rounded-2xl border border-neutral-200 p-4">
            <h2 className="font-semibold">Unit {request.unitNumber}</h2>
            <p className="text-sm text-neutral-600">{request.category} · {request.urgency}</p>
            <p className="whitespace-pre-wrap break-words">{request.description}</p>
            <p className="text-sm">Created {new Date(request.createdAt).toLocaleString()}</p>
            <label className="block text-sm">
              Status
              <select aria-label={`Status for unit ${request.unitNumber}`} value={request.status} disabled={busy} onChange={event => void updateRequest(request.id, { status: event.target.value })} className="mt-1 block w-full rounded-lg border bg-white p-3 disabled:opacity-50">
                {STATUSES.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void updateRequest(request.id, { action: "DELETE" })} className="rounded-lg border border-red-200 px-4 py-2 text-red-700 disabled:opacity-50">Delete request</button>
          </article>
        ))}
      </div>
    </main>
  );
}
