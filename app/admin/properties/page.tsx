"use client";

import { useEffect, useState } from "react";

type PropertyRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  settings?: {
    baseRentDefault: number;
    convenienceFee: number;
  } | null;
  _count?: {
    units: number;
    managementUsers: number;
    maintenanceUsers: number;
    maintenanceRequests: number;
    ledgerEntries: number;
  };
};

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-US");
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [baseRent, setBaseRent] = useState("");
  const [convenienceFee, setConvenienceFee] = useState("");

  async function loadProperties() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/properties", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to load properties.");
        return;
      }

      setProperties(data.properties || []);
    } catch {
      setError("Failed to load properties.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          legalName,
          address1,
          address2,
          city,
          state,
          zip,
          phone,
          email,
          unitCount,
          baseRent,
          convenienceFee,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to create property.");
        return;
      }

      setSuccess(`Property created. Code: ${data.property.code}`);

      setName("");
      setLegalName("");
      setAddress1("");
      setAddress2("");
      setCity("");
      setState("");
      setZip("");
      setPhone("");
      setEmail("");
      setUnitCount("");
      setBaseRent("");
      setConvenienceFee("");

      await loadProperties();
    } catch {
      setError("Failed to create property.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin Properties</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Create properties, assign unique 4-digit codes, and begin setup.
        </p>
      </div>

      <form onSubmit={handleCreate} className="border rounded-xl p-4 space-y-4 bg-white">
        <h2 className="text-lg font-semibold">Create Property</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm font-medium">Property Name *</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunset Villas"
              required
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Legal Name</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Sunset Villas LLC"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Address 1</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Address 2</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">City</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">State</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="TX"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">ZIP</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Phone</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Email</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Planned Unit Count</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
              inputMode="numeric"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Base Rent Default</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={baseRent}
              onChange={(e) => setBaseRent(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Convenience Fee</div>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={convenienceFee}
              onChange={(e) => setConvenienceFee(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {success ? <div className="text-sm text-green-600">{success}</div> : null}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Property"}
        </button>
      </form>

      <div className="border rounded-xl p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4">Existing Properties</h2>

        {loading ? (
          <div className="text-sm text-neutral-600">Loading...</div>
        ) : properties.length === 0 ? (
          <div className="text-sm text-neutral-600">No properties yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Base Rent</th>
                  <th className="py-2 pr-4">Conv. Fee</th>
                  <th className="py-2 pr-4">Units</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b align-top">
                    <td className="py-2 pr-4">{property.name}</td>
                    <td className="py-2 pr-4 font-mono">{property.code}</td>
                    <td className="py-2 pr-4">{property.status}</td>
                    <td className="py-2 pr-4">
                      {money(property.settings?.baseRentDefault)}
                    </td>
                    <td className="py-2 pr-4">
                      {money(property.settings?.convenienceFee)}
                    </td>
                    <td className="py-2 pr-4">{property._count?.units || 0}</td>
                    <td className="py-2 pr-4">{fmtDate(property.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}