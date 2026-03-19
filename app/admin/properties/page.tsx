"use client";

import { useEffect, useMemo, useState } from "react";

type PropertyStatus = "PREVIEW" | "READY" | "LIVE";
type LateFeeType = "FLAT" | "PERCENT";

type PropertyRecord = {
  id: string;
  name: string;
  code: string;
  status: PropertyStatus;
  billingDay: number;
  graceDays: number;
  lateFeeType: LateFeeType;
  lateFeeAmount: number;
  createdAt?: string;
};

type FormState = {
  name: string;
  code: string;
  status: PropertyStatus;
  billingDay: string;
  graceDays: string;
  lateFeeType: LateFeeType;
  lateFeeAmount: string;
};

const DEFAULT_CREATE_FORM: FormState = {
  name: "",
  code: "",
  status: "PREVIEW",
  billingDay: "1",
  graceDays: "5",
  lateFeeType: "FLAT",
  lateFeeAmount: "50",
};

function isFourDigitCode(value: string) {
  return /^\d{4}$/.test(value);
}

function toNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(DEFAULT_CREATE_FORM);
  const [editForms, setEditForms] = useState<Record<string, FormState>>({});

  async function loadProperties() {
    setLoading(true);
    setPageError("");

    try {
      const res = await fetch("/api/admin/properties", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load properties.");
      }

      const rows: PropertyRecord[] = Array.isArray(data?.properties)
        ? data.properties
        : [];

      setProperties(rows);

      const nextEditForms: Record<string, FormState> = {};
      for (const p of rows) {
        nextEditForms[p.id] = {
          name: p.name ?? "",
          code: p.code ?? "",
          status: (p.status as PropertyStatus) ?? "PREVIEW",
          billingDay: String(p.billingDay ?? 1),
          graceDays: String(p.graceDays ?? 0),
          lateFeeType: (p.lateFeeType as LateFeeType) ?? "FLAT",
          lateFeeAmount: String(p.lateFeeAmount ?? 0),
        };
      }
      setEditForms(nextEditForms);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  const sortedProperties = useMemo(() => {
    return [...properties].sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  function updateCreateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditForm(id: string, key: keyof FormState, value: string) {
    setEditForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!createForm.name.trim()) {
      setCreateError("Property name is required.");
      return;
    }

    if (!isFourDigitCode(createForm.code.trim())) {
      setCreateError("Property code must be exactly 4 digits.");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          code: createForm.code.trim(),
          status: createForm.status,
          billingDay: toNumber(createForm.billingDay, 1),
          graceDays: toNumber(createForm.graceDays, 0),
          lateFeeType: createForm.lateFeeType,
          lateFeeAmount: toNumber(createForm.lateFeeAmount, 0),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create property.");
      }

      setCreateForm(DEFAULT_CREATE_FORM);
      setCreateSuccess("Property created.");
      await loadProperties();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create property.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleSave(id: string) {
    const form = editForms[id];
    if (!form) return;

    if (!form.name.trim()) {
      setPageError("Property name is required.");
      return;
    }

    if (!isFourDigitCode(form.code.trim())) {
      setPageError("Property code must be exactly 4 digits.");
      return;
    }

    setPageError("");
    setSavingId(id);

    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          status: form.status,
          billingDay: toNumber(form.billingDay, 1),
          graceDays: toNumber(form.graceDays, 0),
          lateFeeType: form.lateFeeType,
          lateFeeAmount: toNumber(form.lateFeeAmount, 0),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update property.");
      }

      await loadProperties();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to update property.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Admin Properties</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create and manage property setup, codes, status, and billing rules.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create Property</h2>

          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Property Name</label>
              <input
                value={createForm.name}
                onChange={(e) => updateCreateForm("name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 outline-none"
                placeholder="Oak Terrace Apartments"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">4-Digit Property Code</label>
              <input
                value={createForm.code}
                onChange={(e) =>
                  updateCreateForm("code", e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-lg border px-3 py-2 outline-none"
                placeholder="1234"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                value={createForm.status}
                onChange={(e) =>
                  updateCreateForm("status", e.target.value as PropertyStatus)
                }
                className="w-full rounded-lg border px-3 py-2 outline-none"
              >
                <option value="PREVIEW">PREVIEW</option>
                <option value="READY">READY</option>
                <option value="LIVE">LIVE</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Billing Day</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={createForm.billingDay}
                  onChange={(e) => updateCreateForm("billingDay", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Grace Days</label>
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={createForm.graceDays}
                  onChange={(e) => updateCreateForm("graceDays", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Late Fee Type</label>
                <select
                  value={createForm.lateFeeType}
                  onChange={(e) =>
                    updateCreateForm("lateFeeType", e.target.value as LateFeeType)
                  }
                  className="w-full rounded-lg border px-3 py-2 outline-none"
                >
                  <option value="FLAT">FLAT</option>
                  <option value="PERCENT">PERCENT</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Late Fee Amount</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={createForm.lateFeeAmount}
                  onChange={(e) => updateCreateForm("lateFeeAmount", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none"
                />
              </div>
            </div>

            {createError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            ) : null}

            {createSuccess ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {createSuccess}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={createLoading}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {createLoading ? "Creating..." : "Create Property"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Properties</h2>
            <button
              type="button"
              onClick={loadProperties}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {pageError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {pageError}
            </div>
          ) : null}

          {loading ? (
            <div className="text-sm text-gray-600">Loading properties...</div>
          ) : sortedProperties.length === 0 ? (
            <div className="text-sm text-gray-600">No properties yet.</div>
          ) : (
            <div className="space-y-4">
              {sortedProperties.map((property) => {
                const form = editForms[property.id];
                if (!form) return null;

                return (
                  <div
                    key={property.id}
                    className="rounded-xl border p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="xl:col-span-2">
                        <label className="mb-1 block text-sm font-medium">Property Name</label>
                        <input
                          value={form.name}
                          onChange={(e) =>
                            updateEditForm(property.id, "name", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">4-Digit Code</label>
                        <input
                          value={form.code}
                          onChange={(e) =>
                            updateEditForm(
                              property.id,
                              "code",
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            )
                          }
                          inputMode="numeric"
                          maxLength={4}
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) =>
                            updateEditForm(property.id, "status", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        >
                          <option value="PREVIEW">PREVIEW</option>
                          <option value="READY">READY</option>
                          <option value="LIVE">LIVE</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Billing Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={form.billingDay}
                          onChange={(e) =>
                            updateEditForm(property.id, "billingDay", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Grace Days</label>
                        <input
                          type="number"
                          min={0}
                          max={31}
                          value={form.graceDays}
                          onChange={(e) =>
                            updateEditForm(property.id, "graceDays", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Late Fee Type</label>
                        <select
                          value={form.lateFeeType}
                          onChange={(e) =>
                            updateEditForm(property.id, "lateFeeType", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        >
                          <option value="FLAT">FLAT</option>
                          <option value="PERCENT">PERCENT</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Late Fee Amount</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.lateFeeAmount}
                          onChange={(e) =>
                            updateEditForm(property.id, "lateFeeAmount", e.target.value)
                          }
                          className="w-full rounded-lg border px-3 py-2 outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        ID: {property.id}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSave(property.id)}
                        disabled={savingId === property.id}
                        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {savingId === property.id ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}