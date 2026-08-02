"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type PropertyForm = {
  name: string;
  propertyType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
};

type PropertyResponse =
  | {
      ok: true;
      property: {
        id: string;
        name: string;
        propertyType: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
      };
    }
  | {
      ok: false;
      error?: string;
    };

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const INITIAL_FORM: PropertyForm = {
  name: "",
  propertyType: "MULTIFAMILY",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
};

async function readJsonSafely<T>(
  response: Response
): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function OverlayShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#173024]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)] shadow-[var(--rf-shadow-lg)] sm:h-auto sm:max-h-[90vh] sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rf-border)] bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--rf-text)]">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-[var(--rf-text-soft)]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rf-btn rf-btn-secondary px-3 text-sm"
          >
            Close
          </button>
        </div>

        <div className="rf-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PropertyPanel({
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<PropertyForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProperty(): Promise<void> {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/manager/onboarding/property",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const result =
          await readJsonSafely<PropertyResponse>(response);

        if (!response.ok || !result || !result.ok) {
          throw new Error(
            result && !result.ok && result.error
              ? result.error
              : "Could not load property information."
          );
        }

        if (cancelled) {
          return;
        }

        setForm({
          name:
            result.property.name === "My Property"
              ? ""
              : result.property.name,
          propertyType:
            result.property.propertyType || "MULTIFAMILY",
          addressLine1: result.property.addressLine1 || "",
          addressLine2: result.property.addressLine2 || "",
          city: result.property.city || "",
          state: result.property.state || "",
          zip: result.property.zip || "",
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load property information."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProperty();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof PropertyForm>(
    key: K,
    value: PropertyForm[K]
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (error) {
      setError("");
    }

    if (saveState !== "idle") {
      setSaveState("idle");
    }
  }

  function validate(): string | null {
    if (!form.name.trim()) {
      return "Enter the property name.";
    }

    if (!form.addressLine1.trim()) {
      return "Enter the street address.";
    }

    if (!form.city.trim()) {
      return "Enter the city.";
    }

    if (form.state.trim().length !== 2) {
      return "Enter a valid two-letter state.";
    }

    if (form.zip.replace(/\D/g, "").length !== 5) {
      return "Enter a valid five-digit ZIP code.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (saveState === "saving") {
      return;
    }

    setError("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSaveState("error");
      return;
    }

    try {
      setSaveState("saving");

      const response = await fetch(
        "/api/manager/onboarding/property",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            propertyType: form.propertyType,
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim(),
            city: form.city.trim(),
            state: form.state.trim().toUpperCase(),
            zip: form.zip.replace(/\D/g, ""),
          }),
        }
      );

      const result =
        await readJsonSafely<PropertyResponse>(response);

      if (!response.ok || !result || !result.ok) {
        throw new Error(
          result && !result.ok && result.error
            ? result.error
            : "Could not save property information."
        );
      }

      setSaveState("saved");

      await onSaved();

      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Network error. Please try again."
      );

      setSaveState("error");
    }
  }

  return (
    <OverlayShell
      title="Property Information"
      subtitle="Update the property name, type, and address used throughout RentFray."
      onClose={onClose}
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <section className="rounded-[24px] border border-[var(--rf-border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-5">
              <Field
                label="Property name"
                value={form.name}
                placeholder="Oak Ridge Apartments"
                autoComplete="organization"
                disabled={saveState === "saving"}
                onChange={(value) =>
                  updateField("name", value)
                }
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Property type
                </span>

                <select
                  value={form.propertyType}
                  disabled={saveState === "saving"}
                  onChange={(event) =>
                    updateField(
                      "propertyType",
                      event.target.value
                    )
                  }
                  className="rf-input w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="MULTIFAMILY">
                    Apartments / Multifamily
                  </option>

                  <option value="MOBILE_HOME">
                    Mobile Home Park
                  </option>

                  <option value="RV_PARK">
                    RV Park
                  </option>

                  <option value="SELF_STORAGE">
                    Self Storage
                  </option>

                  <option value="BHPH">
                    Buy Here Pay Here Car Lot
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <Field
                label="Street address"
                value={form.addressLine1}
                placeholder="123 Main Street"
                autoComplete="address-line1"
                disabled={saveState === "saving"}
                onChange={(value) =>
                  updateField("addressLine1", value)
                }
              />

              <Field
                label="Address line 2"
                value={form.addressLine2}
                placeholder="Suite, building, etc."
                autoComplete="address-line2"
                required={false}
                disabled={saveState === "saving"}
                onChange={(value) =>
                  updateField("addressLine2", value)
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={form.city}
                  autoComplete="address-level2"
                  disabled={saveState === "saving"}
                  onChange={(value) =>
                    updateField("city", value)
                  }
                />

                <Field
                  label="State"
                  value={form.state}
                  placeholder="TX"
                  autoComplete="address-level1"
                  maxLength={2}
                  disabled={saveState === "saving"}
                  onChange={(value) =>
                    updateField(
                      "state",
                      value
                        .replace(/[^a-z]/gi, "")
                        .toUpperCase()
                        .slice(0, 2)
                    )
                  }
                />
              </div>

              <Field
                label="ZIP code"
                value={form.zip}
                placeholder="77701"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={5}
                disabled={saveState === "saving"}
                onChange={(value) =>
                  updateField(
                    "zip",
                    value
                      .replace(/\D/g, "")
                      .slice(0, 5)
                  )
                }
              />
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className={`inline-flex min-h-11 min-w-[140px] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${
                saveState === "saved"
                  ? "bg-emerald-700"
                  : saveState === "error"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-[#173024] hover:bg-[#10241b]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                  ? "Saved!"
                  : saveState === "error"
                    ? "Try Again"
                    : "Save"}
            </button>
          </div>
        </form>
      )}
    </OverlayShell>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal";
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode = "text",
  maxLength,
  required = true,
  disabled = false,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">
        {label}

        {!required ? (
          <span className="ml-1 font-normal text-slate-500">
            Optional
          </span>
        ) : null}
      </span>

      <input
        type="text"
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="rf-input w-full disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}