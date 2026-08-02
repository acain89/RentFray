"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

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

export default function PropertyInformationPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<PropertyForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProperty(): Promise<void> {
      try {
        const response = await fetch(
          "/api/manager/onboarding/property",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const result =
          await readJsonSafely<PropertyResponse>(response);

        if (
          !response.ok ||
          !result ||
          !result.ok
        ) {
          if (response.status === 401) {
            router.replace("/manager/login");
            return;
          }

          throw new Error(
            result && !result.ok && result.error
              ? result.error
              : "Could not load property information."
          );
        }

        if (cancelled) return;

        setForm({
          name:
            result.property.name === "My Property"
              ? ""
              : result.property.name,
          propertyType:
            result.property.propertyType ||
            "MULTIFAMILY",
          addressLine1:
            result.property.addressLine1 || "",
          addressLine2:
            result.property.addressLine2 || "",
          city: result.property.city || "",
          state: result.property.state || "",
          zip: result.property.zip || "",
        });
      } catch (loadError) {
        if (cancelled) return;

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
  }, [router]);

  function updateField<K extends keyof PropertyForm>(
    key: K,
    value: PropertyForm[K]
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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
    setError("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
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
            addressLine1:
              form.addressLine1.trim(),
            addressLine2:
              form.addressLine2.trim(),
            city: form.city.trim(),
            state: form.state
              .trim()
              .toUpperCase(),
            zip: form.zip.replace(/\D/g, ""),
          }),
        }
      );

      const result =
        await readJsonSafely<PropertyResponse>(response);

      if (
        !response.ok ||
        !result ||
        !result.ok
      ) {
        setError(
          result && !result.ok && result.error
            ? result.error
            : "Could not save property information."
        );
        return;
      }

      router.push("/manager/getting-started");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--rf-bg)] px-4 py-8 text-[var(--rf-text)]">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[28px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)] p-6 shadow-[var(--rf-shadow-sm)]">
            Loading property information...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--rf-bg)] px-4 py-8 text-[var(--rf-text)] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/manager/getting-started"
              )
            }
            className="mb-5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            ← Back to Getting Started
          </button>

          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Property information
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tell us about your property
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--rf-text-soft)] sm:text-base">
            This information identifies your
            property and can be updated later
            from your manager dashboard.
          </p>
        </header>

        <section className="rounded-[28px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)] p-5 shadow-[var(--rf-shadow-sm)] sm:p-7">
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <Field
              label="Property name"
              value={form.name}
              placeholder="Oak Ridge Apartments"
              autoComplete="organization"
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
                onChange={(event) =>
                  updateField(
                    "propertyType",
                    event.target.value
                  )
                }
                className="rf-input w-full"
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
              onChange={(value) =>
                updateField(
                  "addressLine1",
                  value
                )
              }
            />

            <Field
              label="Address line 2"
              value={form.addressLine2}
              placeholder="Suite, building, etc. (optional)"
              autoComplete="address-line2"
              required={false}
              onChange={(value) =>
                updateField(
                  "addressLine2",
                  value
                )
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="City"
                value={form.city}
                autoComplete="address-level2"
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
              onChange={(value) =>
                updateField(
                  "zip",
                  value
                    .replace(/\D/g, "")
                    .slice(0, 5)
                )
              }
            />

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/manager/getting-started"
                  )
                }
                className="rf-btn rf-btn-secondary justify-center"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rf-btn rf-btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : "Save & Continue"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal";
  maxLength?: number;
  required?: boolean;
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
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="rf-input w-full"
      />
    </label>
  );
}