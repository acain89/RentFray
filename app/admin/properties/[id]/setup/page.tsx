// app/admin/properties/[id]/setup/page.tsx
// [path: app/admin/properties/[id]/setup/page.tsx]

"use client";

import { useEffect, useState } from "react";

type Unit = {
  id: string;
  unitNumber: string;
  portalActivated?: boolean | null;
};

type Readiness = {
  hasUnits: boolean;
  hasSettings: boolean;
  stripeConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  paymentReady: boolean;
  readyForLive: boolean;
};

type Property = {
  id: string;
  name: string;
  propertyCode: string;
  status: string;
  units: Unit[];
};

const STATUS_OPTIONS = ["SETUP", "TEST", "READY", "LIVE", "SUSPENDED"] as const;

export default function PropertySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [property, setProperty] = useState<Property | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [runningOverride, setRunningOverride] = useState(false);

  const [setupError, setSetupError] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [lifecycleSuccess, setLifecycleSuccess] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideSuccess, setOverrideSuccess] = useState("");





  const [selectedStatus, setSelectedStatus] = useState("SETUP");
  const [statusReason, setStatusReason] = useState("");

  const [overrideReason, setOverrideReason] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => {
    async function resolveParams() {
      const { id } = await params;
      setPropertyId(id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!propertyId) return;
    load();
  }, [propertyId]);

  async function load() {
    try {
      setLoading(true);
      setSetupError("");
      setLifecycleError("");
      setOverrideError("");

      const [setupRes, lifecycleRes] = await Promise.all([
        fetch(`/api/admin/properties/${propertyId}/setup`, { cache: "no-store" }),
        fetch(`/api/admin/properties/${propertyId}/lifecycle`, { cache: "no-store" }),
      ]);

      const setupData = await setupRes.json();
      const lifecycleData = await lifecycleRes.json();

      if (!setupRes.ok) {
        setSetupError(setupData?.error || "Failed to load property setup.");
        return;
      }

      const loadedProperty: Property = {
        ...setupData.property,
        status: lifecycleData?.property?.status || setupData.property.status,
      };

      setProperty(loadedProperty);
      setReadiness(lifecycleRes.ok ? lifecycleData?.readiness || null : null);
      setLifecycleError(lifecycleRes.ok ? "" : lifecycleData?.error || "Failed to load lifecycle state.");



      setSelectedStatus(lifecycleData?.property?.status || loadedProperty.status || "SETUP");

      if (loadedProperty.units.length > 0 && !selectedUnitId) {
        setSelectedUnitId(loadedProperty.units[0].id);
      }
    } catch {
      setSetupError("Failed to load property setup.");
    } finally {
      setLoading(false);
    }
  }

  async function saveLifecycle() {
    if (savingLifecycle || !propertyId || !property) return;

    try {
      setSavingLifecycle(true);
      setLifecycleError("");
      setLifecycleSuccess("");

      const res = await fetch(`/api/admin/properties/${propertyId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          reason: statusReason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLifecycleError(data?.error || "Failed to update property status.");
        return;
      }

      setLifecycleSuccess(
        `Property status updated: ${data.previousStatus} → ${data.property.status}`
      );
      setStatusReason("");
      await load();
    } catch {
      setLifecycleError("Failed to update property status.");
    } finally {
      setSavingLifecycle(false);
    }
  }

  async function runOverride(action: string) {
    if (runningOverride || !propertyId) return;

    try {
      setRunningOverride(true);
      setOverrideError("");
      setOverrideSuccess("");

      const payload: Record<string, string> = {
        action,
        reason: overrideReason,
      };

      if (action === "UNLOCK_UNIT") {
        payload.unitId = selectedUnitId;
      }

      const res = await fetch(`/api/admin/properties/${propertyId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setOverrideError(data?.error || "Override action failed.");
        return;
      }

      if (action === "FORCE_LIVE") {
        setOverrideSuccess("Force LIVE applied.");
      } else if (action === "UNLOCK_UNIT") {
        setOverrideSuccess("Unit unlocked.");
      } else if (action === "REPAIR_PAYMENT_STATUS") {
        setOverrideSuccess("Payment status record repaired.");
      } else {
        setOverrideSuccess("Override action complete.");
      }

      setOverrideReason("");
      await load();
    } catch {
      setOverrideError("Override action failed.");
    } finally {
      setRunningOverride(false);
    }
  }

  if (loading || !property) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {property.name} ({property.propertyCode})
        </h1>
        <p className="text-sm text-neutral-600">Setup Panel</p>
        <div className="text-sm text-neutral-600">Existing Units: {property.units.length}</div>
      </div>

      <div className="border p-4 rounded-xl space-y-3">
        <h2 className="font-semibold">Live Readiness</h2>

        <div className="text-sm">Has units: {readiness?.hasUnits ? "YES" : "NO"}</div>
        <div className="text-sm">Has settings: {readiness?.hasSettings ? "YES" : "NO"}</div>
        <div className="text-sm">Stripe connected: {readiness?.stripeConnected ? "YES" : "NO"}</div>
        <div className="text-sm">Charges enabled: {readiness?.chargesEnabled ? "YES" : "NO"}</div>
        <div className="text-sm">Payouts enabled: {readiness?.payoutsEnabled ? "YES" : "NO"}</div>
        <div className="text-sm">Onboarding complete: {readiness?.onboardingComplete ? "YES" : "NO"}</div>
        <div className="text-sm font-medium">
          Ready for LIVE: {readiness?.readyForLive ? "YES" : "NO"}
        </div>
      </div>

      <div className="border p-4 rounded-xl space-y-3">
        <h2 className="font-semibold">Lifecycle</h2>

        <div className="text-sm">
          <span className="font-medium">Current Status: </span>
          <span>{property.status}</span>
        </div>

        <select
          className="border p-2 w-full rounded-lg"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <textarea
          className="border p-2 w-full rounded-lg min-h-[100px]"
          placeholder="Reason for status change"
          value={statusReason}
          onChange={(e) => setStatusReason(e.target.value)}
        />

        {lifecycleError ? <div className="text-sm text-red-600">{lifecycleError}</div> : null}
        {lifecycleSuccess ? <div className="text-sm text-green-600">{lifecycleSuccess}</div> : null}

        <button
          onClick={saveLifecycle}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
          disabled={savingLifecycle}
        >
          {savingLifecycle ? "Saving..." : "Save Lifecycle Status"}
        </button>
      </div>

      <div className="border p-4 rounded-xl space-y-4">
        <div>
          <h2 className="font-semibold">Admin Override Tools</h2>
          <p className="text-sm text-neutral-600">Emergency-only admin controls.</p>
        </div>

        <textarea
          className="border p-2 w-full rounded-lg min-h-[100px]"
          placeholder="Override reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">Unlock Unit</div>
          <select
            className="border p-2 w-full rounded-lg"
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            {property.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                Unit {unit.unitNumber}
              </option>
            ))}
          </select>

          <button
            onClick={() => runOverride("UNLOCK_UNIT")}
            className="border px-4 py-2 rounded-lg"
            disabled={runningOverride || !selectedUnitId}
          >
            Unlock Selected Unit
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runOverride("FORCE_LIVE")}
            className="border px-4 py-2 rounded-lg"
            disabled={runningOverride}
          >
            Force LIVE
          </button>

          <button
            onClick={() => runOverride("REPAIR_PAYMENT_STATUS")}
            className="border px-4 py-2 rounded-lg"
            disabled={runningOverride}
          >
            Repair Payment Status
          </button>

        </div>

        {overrideError ? <div className="text-sm text-red-600">{overrideError}</div> : null}
        {overrideSuccess ? <div className="text-sm text-green-600">{overrideSuccess}</div> : null}
      </div>

      {setupError ? <div className="text-sm text-red-600">{setupError}</div> : null}
    </div>
  );
}