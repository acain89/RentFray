"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TenantActivateClientProps = {
  propertyCode: string;
};

function inputClass(hasError: boolean) {
  return [
    "w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition",
    "focus:border-slate-900 focus:ring-2 focus:ring-sky-200",
    hasError ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white",
  ].join(" ");
}

export default function TenantActivateClient({
  propertyCode,
}: TenantActivateClientProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [unitNumber, setUnitNumber] = useState<string>("");
  const [confirmUnitNumber, setConfirmUnitNumber] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");

  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [alreadyActivated, setAlreadyActivated] = useState<boolean>(false);

  useEffect(() => {
    if (!propertyCode) {
      router.replace("/property-code");
      return;
    }

    // Persist property context
    localStorage.setItem("rf_property_code", propertyCode);
  }, [propertyCode, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanUnitNumber = unitNumber.trim().toUpperCase();
    const cleanConfirmUnitNumber = confirmUnitNumber.trim().toUpperCase();
    const cleanPin = pin.trim();
    const cleanConfirmPin = confirmPin.trim();

    if (!propertyCode) {
      setError("Missing property code.");
      return;
    }

    if (!cleanFirstName || !cleanLastName) {
      setError("Enter your first and last name.");
      return;
    }

    if (!cleanUnitNumber || !cleanConfirmUnitNumber) {
      setError("Enter and confirm your unit number.");
      return;
    }

    if (cleanUnitNumber !== cleanConfirmUnitNumber) {
      setError("Unit numbers do not match.");
      return;
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      setError("PIN must be 4 digits.");
      return;
    }

    if (cleanPin !== cleanConfirmPin) {
      setError("PINs do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setAlreadyActivated(false);

    try {
      const res = await fetch("/api/tenant/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          propertyCode,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          unitNumber: cleanUnitNumber,
          confirmUnitNumber: cleanConfirmUnitNumber,
          pin: cleanPin,
          confirmPin: cleanConfirmPin,
        }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        const message = data.error || "Activation failed.";

        if (message.toLowerCase().includes("already been activated")) {
          setAlreadyActivated(true);
        }

        setError(message);
        setLoading(false);
        return;
      }

      // Success → go straight to dashboard (session already created)
      router.replace("/tenant/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (!propertyCode) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-xs font-semibold tracking-[0.2em] text-slate-700">
          RENTFRAY
        </div>

        <section className="rounded-[28px] border border-sky-200 bg-white/95 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Activate your account
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Property code{" "}
              <span className="font-mono font-semibold text-slate-900">
                {propertyCode}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* name */}
            <div className="grid grid-cols-2 gap-3">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass(false)}
                placeholder="First name"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass(false)}
                placeholder="Last name"
              />
            </div>

            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value.toUpperCase())}
              className={inputClass(false)}
              placeholder="Unit ID"
            />

            <input
              value={confirmUnitNumber}
              onChange={(e) =>
                setConfirmUnitNumber(e.target.value.toUpperCase())
              }
              className={inputClass(false)}
              placeholder="Confirm Unit ID"
            />

            <input
              type="password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className={inputClass(false)}
              placeholder="PIN"
            />

            <input
              type="password"
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className={inputClass(false)}
              placeholder="Confirm PIN"
            />

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {alreadyActivated && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/login/tenant?code=${propertyCode}`)
                }
                className="w-full rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white"
              >
                Go to Tenant Login
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white"
            >
              {loading ? "Activating..." : "Activate account"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Tenants will only have to pay a single-digit processing fee.
          </div>
        </section>
      </div>
    </main>
  );
}