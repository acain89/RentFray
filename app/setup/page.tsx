// app/setup/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { HTMLInputTypeAttribute } from "react";

type BillingFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";
type LateFeeType = "FLAT" | "PERCENT";

type TierDraft = {
  id: string;
  name: string;
  price: string;
  unitCount: string;
  billingFrequency: BillingFrequency;
  dueDay: string;
  gracePeriodDays: string;
  lateFeeType: LateFeeType;
  lateFeeInitial: string;
  lateFeeDaily: string;
  maxLateFeeDays: string;
};

type FormState = {
  email: string;
  username: string;
  password: string;
  propertyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  businessType: string;
  tiers: TierDraft[];
};

type TouchedState = Record<string, boolean>;

const STORAGE_KEY = "rentfray_self_serve_setup_v1";

function createTier(index: number): TierDraft {
  return {
    id: `tier-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Tier ${index + 1}`,
    price: "",
    unitCount: "",
    billingFrequency: "MONTHLY",
    dueDay: "",
    gracePeriodDays: "",
    lateFeeType: "FLAT",
    lateFeeInitial: "",
    lateFeeDaily: "",
    maxLateFeeDays: "",
  };
}

function getInitialState(): FormState {
  return {
    email: "",
    username: "",
    password: "",
    propertyName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    businessType: "",
    tiers: [createTier(0)],
  };
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function sanitizeMoney(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildUnitPreview(tiers: TierDraft[]) {
  let nextUnit = 101;

  return tiers.map((tier) => {
    const count = Math.max(0, Number(tier.unitCount || 0));
    const start = count > 0 ? nextUnit : null;
    const end = count > 0 ? nextUnit + count - 1 : null;
    nextUnit += count;

    return {
      tierId: tier.id,
      start,
      end,
      count,
    };
  });
}

function ordinalDay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function formatMoney(value: number, lateFeeType: LateFeeType): string {
  if (lateFeeType === "PERCENT") {
    return `${value.toFixed(2)}%`;
  }

  return `$${value.toFixed(2)}`;
}

function getScheduleWords(frequency: BillingFrequency) {
  if (frequency === "WEEKLY") {
    return {
      due: "day",
      late: "day",
      daily: "day",
      end: "day",
    };
  }

  if (frequency === "BIWEEKLY") {
    return {
      due: "day",
      late: "day",
      daily: "day",
      end: "day",
    };
  }

  return {
    due: "",
    late: "",
    daily: "",
    end: "",
  };
}

function buildLateFeeSummary(tier: TierDraft): string {
  const dueDay = Number(tier.dueDay || 0);
  const gracePeriodDays = Number(tier.gracePeriodDays || 0);
  const lateFeeInitial = Number(tier.lateFeeInitial || 0);
  const lateFeeDaily = Number(tier.lateFeeDaily || 0);
  const maxLateFeeDays = Number(tier.maxLateFeeDays || 0);

  const lateStartDay = dueDay > 0 ? dueDay + gracePeriodDays : 0;
  const dailyStartDay = lateStartDay > 0 ? lateStartDay + 1 : 0;
  const dailyEndDay =
  dailyStartDay > 0 && maxLateFeeDays > 0
    ? dailyStartDay + maxLateFeeDays - 1
    : 0;

  const words = getScheduleWords(tier.billingFrequency);

  const dueText =
    tier.billingFrequency === "MONTHLY"
      ? ordinalDay(dueDay)
      : dueDay > 0
      ? `day ${dueDay}`
      : "—";

  const lateStartText =
    tier.billingFrequency === "MONTHLY"
      ? ordinalDay(lateStartDay)
      : lateStartDay > 0
      ? `day ${lateStartDay}`
      : "—";

  const dailyStartText =
    tier.billingFrequency === "MONTHLY"
      ? ordinalDay(dailyStartDay)
      : dailyStartDay > 0
      ? `day ${dailyStartDay}`
      : "—";

  const dailyEndText =
    tier.billingFrequency === "MONTHLY"
      ? ordinalDay(dailyEndDay)
      : dailyEndDay > 0
      ? `day ${dailyEndDay}`
      : "—";

  return `Payment due on the ${dueText}${
    words.due ? ` ${words.due}` : ""
  }. Grace period of ${gracePeriodDays} day${
    gracePeriodDays === 1 ? "" : "s"
  }. Late fee of ${formatMoney(
    lateFeeInitial,
    tier.lateFeeType
  )} added on the ${lateStartText}${
    words.late ? ` ${words.late}` : ""
  }. Daily late fee of ${formatMoney(
    lateFeeDaily,
    tier.lateFeeType
  )} added per day starting on the ${dailyStartText}${
    words.daily ? ` ${words.daily}` : ""
  } and ending on the ${dailyEndText}${words.end ? ` ${words.end}` : ""}.`;
}

export default function SetupPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(getInitialState);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<TouchedState>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Progress auto-saves.");
  const [submitError, setSubmitError] = useState("");
  const [sameForAllLoading, setSameForAllLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState> & { step?: number };

        setForm({
          ...getInitialState(),
          ...parsed,
          tiers:
            parsed.tiers && parsed.tiers.length
              ? parsed.tiers.map((tier, index) => ({
                  ...createTier(index),
                  ...tier,
                  name: tier.name || `Tier ${index + 1}`,
                }))
              : [createTier(0)],
        });

        if (parsed.step && parsed.step >= 1 && parsed.step <= 4) {
          setStep(parsed.step);
        }
      }
    } catch {
      // ignore bad local state
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...form,
          step,
        })
      );

      setSaveMessage("Saved");

      const timeout = window.setTimeout(() => {
        setSaveMessage("Progress auto-saves.");
      }, 1200);

      return () => window.clearTimeout(timeout);
    } catch {
      setSaveMessage("Could not save locally");
    }
  }, [form, step, hydrated]);

  const unitPreview = useMemo(() => buildUnitPreview(form.tiers), [form.tiers]);

  const step1Errors = {
    email: touched.email && !isEmail(form.email) ? "Enter a valid email." : "",
    username:
      touched.username && form.username.trim().length < 3
        ? "Username must be at least 3 characters."
        : "",
    password:
      touched.password && form.password.length < 8
        ? "Password must be at least 8 characters."
        : "",
  };

  const step2Errors = {
    propertyName:
      touched.propertyName && !form.propertyName.trim()
        ? "Property name is required."
        : "",
    addressLine1:
      touched.addressLine1 && !form.addressLine1.trim()
        ? "Address is required."
        : "",
    city: touched.city && !form.city.trim() ? "City is required." : "",
    state:
      touched.state && form.state.trim().length < 2 ? "State is required." : "",
    zip:
      touched.zip && onlyDigits(form.zip).length < 5 ? "ZIP is required." : "",
    businessType:
      touched.businessType && !form.businessType.trim()
        ? "Business type is required."
        : "",
  };

  function getTierErrors(tier: TierDraft) {
    return {
      price:
        touched[`price-${tier.id}`] &&
        (!(Number(tier.price) > 0) || !tier.price.trim())
          ? "Enter a valid price."
          : "",
      unitCount:
        touched[`unitCount-${tier.id}`] &&
        (!(Number(tier.unitCount) > 0) || !tier.unitCount.trim())
          ? "Enter unit count."
          : "",
      dueDay:
        touched[`dueDay-${tier.id}`] &&
        tier.billingFrequency === "MONTHLY" &&
        !(Number(tier.dueDay) >= 1 && Number(tier.dueDay) <= 31)
          ? "Use 1 to 31."
          : "",
      gracePeriodDays:
        touched[`grace-${tier.id}`] && !(Number(tier.gracePeriodDays) >= 0)
          ? "Enter grace period."
          : "",
      lateFeeInitial:
        touched[`lateInitial-${tier.id}`] && !(Number(tier.lateFeeInitial) >= 0)
          ? "Enter initial late fee."
          : "",
      lateFeeDaily:
        touched[`lateDaily-${tier.id}`] && !(Number(tier.lateFeeDaily) >= 0)
          ? "Enter daily late fee."
          : "",
      maxLateFeeDays:
        touched[`lateMax-${tier.id}`] && !(Number(tier.maxLateFeeDays) >= 0)
          ? "Enter max days."
          : "",
    };
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setTierField(id: string, key: keyof TierDraft, value: string) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier) =>
        tier.id === id ? { ...tier, [key]: value } : tier
      ),
    }));
  }

  function addTier() {
    setForm((prev) => ({
      ...prev,
      tiers: [...prev.tiers, createTier(prev.tiers.length)],
    }));
  }

  function removeTier(id: string) {
    setForm((prev) => {
      const next = prev.tiers.filter((tier) => tier.id !== id);

      return {
        ...prev,
        tiers: next.length
          ? next.map((tier, index) => ({
              ...tier,
              name: `Tier ${index + 1}`,
            }))
          : [createTier(0)],
      };
    });
  }

  function copyBillingFromFirstTier() {
    if (!form.tiers.length) return;

    setSameForAllLoading(true);

    const first = form.tiers[0];

    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, index) =>
        index === 0
          ? tier
          : {
              ...tier,
              billingFrequency: first.billingFrequency,
              dueDay: first.dueDay,
              gracePeriodDays: first.gracePeriodDays,
              lateFeeType: first.lateFeeType,
              lateFeeInitial: first.lateFeeInitial,
              lateFeeDaily: first.lateFeeDaily,
              maxLateFeeDays: first.maxLateFeeDays,
            }
      ),
    }));

    window.setTimeout(() => {
      setSameForAllLoading(false);
    }, 250);
  }

  function validateStep1() {
    const nextTouched: TouchedState = {
      ...touched,
      email: true,
      username: true,
      password: true,
    };

    setTouched(nextTouched);

    return (
      isEmail(form.email) &&
      form.username.trim().length >= 3 &&
      form.password.length >= 8
    );
  }

  function validateStep2() {
    const nextTouched: TouchedState = {
      ...touched,
      propertyName: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
      businessType: true,
    };

    setTouched(nextTouched);

    return Boolean(
      form.propertyName.trim() &&
        form.addressLine1.trim() &&
        form.city.trim() &&
        form.state.trim().length >= 2 &&
        onlyDigits(form.zip).length >= 5 &&
        form.businessType.trim()
    );
  }

  function validateStep3() {
    const nextTouched = { ...touched };

    form.tiers.forEach((tier) => {
      nextTouched[`price-${tier.id}`] = true;
      nextTouched[`unitCount-${tier.id}`] = true;
    });

    setTouched(nextTouched);

    return form.tiers.every(
      (tier) => Number(tier.price) > 0 && Number(tier.unitCount) > 0
    );
  }

  function validateStep4() {
    const nextTouched = { ...touched };

    form.tiers.forEach((tier) => {
      nextTouched[`dueDay-${tier.id}`] = true;
      nextTouched[`grace-${tier.id}`] = true;
      nextTouched[`lateInitial-${tier.id}`] = true;
      nextTouched[`lateDaily-${tier.id}`] = true;
      nextTouched[`lateMax-${tier.id}`] = true;
    });

    setTouched(nextTouched);

    return form.tiers.every((tier) => {
      const monthlyDueValid =
        tier.billingFrequency !== "MONTHLY" ||
        (Number(tier.dueDay) >= 1 && Number(tier.dueDay) <= 31);

      return (
        monthlyDueValid &&
        Number(tier.gracePeriodDays) >= 0 &&
        Number(tier.lateFeeInitial) >= 0 &&
        Number(tier.lateFeeDaily) >= 0 &&
        Number(tier.maxLateFeeDays) >= 0
      );
    });
  }

  function nextStep() {
    setSubmitError("");

    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;

    setStep((prev) => Math.min(4, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setSubmitError("");
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setSubmitError("");

    if (!validateStep4()) return;

    const payload = {
      account: {
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
      },
      property: {
        name: form.propertyName.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: onlyDigits(form.zip),
        businessType: form.businessType.trim(),
      },
      tiers: form.tiers.map((tier, index) => ({
        name: `Tier ${index + 1}`,
        price: Number(tier.price),
        unitCount: Number(tier.unitCount),
        billingFrequency: tier.billingFrequency,
        dueDay:
          tier.billingFrequency === "MONTHLY" ? Number(tier.dueDay || 1) : null,
        gracePeriodDays: Number(tier.gracePeriodDays || 0),
        lateFeeType: tier.lateFeeType,
        lateFeeInitial: Number(tier.lateFeeInitial || 0),
        lateFeeDaily: Number(tier.lateFeeDaily || 0),
        maxLateFeeDays: Number(tier.maxLateFeeDays || 0),
      })),
    };

    setSaving(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.ok) {
        setSubmitError(result?.error || "Could not complete setup.");
        return;
      }

      localStorage.removeItem(STORAGE_KEY);
      router.push(result.redirectTo || "/admin");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#dfe7ee] px-4 py-8 text-[#0f172a]">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-[#cbd5e1] bg-white p-6 shadow-sm">
            Loading setup...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#dfe7ee] px-4 py-6 text-[#0f172a] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-[#0f172a]/70">
              RENTFRAY
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Setup your account in 4 easy steps
            </h1>
            <p className="mt-2 text-sm text-[#475569] sm:text-base">
              No banking required right now.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-sm font-medium text-[#334155] sm:block">
            {saveMessage}
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-[#334155] bg-[#233143] p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
            <span>Step {step} of 4</span>
            <span>{Math.round((step / 4) * 100)}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["Account", "Property", "Tiers", "Billing"].map((label, index) => {
              const active = step === index + 1;
              const done = step > index + 1;

              return (
                <div
                  key={label}
                  className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition ${
                    active
                      ? "bg-white text-[#0f172a]"
                      : done
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/75"
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-sm text-[#334155] sm:hidden">
          {saveMessage}
        </div>

        <section className="rounded-[28px] border border-[#cbd5e1] bg-white p-5 shadow-sm sm:p-7">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Create your account
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Simple email, username, and password.
                </p>
              </div>

              <div className="grid gap-4">
                <Field
                  label="Email"
                  value={form.email}
                  error={step1Errors.email}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  onChange={(value) => setField("email", value)}
                  placeholder="name@example.com"
                  type="email"
                />

                <Field
                  label="Username"
                  value={form.username}
                  error={step1Errors.username}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, username: true }))
                  }
                  onChange={(value) => setField("username", value)}
                  placeholder="yourusername"
                />

                <Field
                  label="Password"
                  value={form.password}
                  error={step1Errors.password}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, password: true }))
                  }
                  onChange={(value) => setField("password", value)}
                  placeholder="At least 8 characters"
                  type="password"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Property info
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Name, address, and business type.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Property name"
                    value={form.propertyName}
                    error={step2Errors.propertyName}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, propertyName: true }))
                    }
                    onChange={(value) => setField("propertyName", value)}
                    placeholder="Oak Grove Apartments"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Field
                    label="Address"
                    value={form.addressLine1}
                    error={step2Errors.addressLine1}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, addressLine1: true }))
                    }
                    onChange={(value) => setField("addressLine1", value)}
                    placeholder="123 Main St"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Field
                    label="Address line 2"
                    value={form.addressLine2}
                    error=""
                    onBlur={() => {}}
                    onChange={(value) => setField("addressLine2", value)}
                    placeholder="Optional"
                  />
                </div>

                <Field
                  label="City"
                  value={form.city}
                  error={step2Errors.city}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, city: true }))
                  }
                  onChange={(value) => setField("city", value)}
                  placeholder="Houston"
                />

                <Field
                  label="State"
                  value={form.state}
                  error={step2Errors.state}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, state: true }))
                  }
                  onChange={(value) => setField("state", value.toUpperCase())}
                  placeholder="TX"
                  maxLength={2}
                />

                <Field
                  label="ZIP"
                  value={form.zip}
                  error={step2Errors.zip}
                  onBlur={() => setTouched((prev) => ({ ...prev, zip: true }))}
                  onChange={(value) =>
                    setField("zip", onlyDigits(value).slice(0, 5))
                  }
                  placeholder="77001"
                  inputMode="numeric"
                />

                <SelectField
                  label="Business type"
                  value={form.businessType}
                  error={step2Errors.businessType}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, businessType: true }))
                  }
                  onChange={(value) => setField("businessType", value)}
                  options={[
                    { label: "Select one", value: "" },
                    { label: "Apartment", value: "APARTMENT" },
                    { label: "Multi-family", value: "MULTI_FAMILY" },
                    { label: "Mobile home park", value: "MOBILE_HOME_PARK" },
                    { label: "Storage", value: "STORAGE" },
                    { label: "Other", value: "OTHER" },
                  ]}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Tier setup
                  </h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Price + unit count. Units auto-generate starting at 101.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addTier}
                  className="shrink-0 rounded-2xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Add tier
                </button>
              </div>

              <div className="space-y-4">
                {form.tiers.map((tier, index) => {
                  const preview = unitPreview.find((item) => item.tierId === tier.id);
                  const errors = getTierErrors(tier);

                  return (
                    <div
                      key={tier.id}
                      className="rounded-[24px] border border-[#dbe4ec] bg-[#f8fafc] p-4 sm:p-5"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-[#0f172a]">
                            Tier {index + 1}
                          </div>
                          <div className="text-sm text-[#64748b]">
                            {preview?.count
                              ? `Units ${preview.start}–${preview.end}`
                              : "Enter unit count to preview auto-generated numbers"}
                          </div>
                        </div>

                        {form.tiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTier(tier.id)}
                            className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#0f172a]"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Monthly price"
                          value={tier.price}
                          error={errors.price}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`price-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(tier.id, "price", sanitizeMoney(value))
                          }
                          placeholder="950.00"
                          inputMode="decimal"
                        />

                        <Field
                          label="Unit count"
                          value={tier.unitCount}
                          error={errors.unitCount}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`unitCount-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "unitCount",
                              onlyDigits(value).slice(0, 4)
                            )
                          }
                          placeholder="24"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Billing rules
                  </h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Set billing per tier. You can copy the first tier to all.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copyBillingFromFirstTier}
                  className="rounded-2xl border border-[#0f172a] bg-white px-4 py-3 text-sm font-semibold text-[#0f172a]"
                >
                  {sameForAllLoading ? "Applying..." : "Same for all tiers"}
                </button>
              </div>

              <div className="space-y-4">
                {form.tiers.map((tier, index) => {
                  const errors = getTierErrors(tier);

                  return (
                    <div
                      key={tier.id}
                      className="rounded-[24px] border border-[#dbe4ec] bg-[#f8fafc] p-4 sm:p-5"
                    >
                      <div className="mb-4">
                        <div className="text-lg font-semibold text-[#0f172a]">
                          Tier {index + 1}
                        </div>
                        <div className="text-sm text-[#64748b]">
                          ${Number(tier.price || 0).toFixed(2)} · {tier.unitCount || 0} units
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                          label="Billing frequency"
                          value={tier.billingFrequency}
                          error=""
                          onBlur={() => {}}
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "billingFrequency",
                              value as BillingFrequency
                            )
                          }
                          options={[
                            { label: "Monthly", value: "MONTHLY" },
                            { label: "Biweekly", value: "BIWEEKLY" },
                            { label: "Weekly", value: "WEEKLY" },
                          ]}
                        />

                        <Field
                          label={
                            tier.billingFrequency === "MONTHLY"
                              ? "Due day"
                              : "Due day"
                          }
                          value={tier.dueDay}
                          error={errors.dueDay}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`dueDay-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "dueDay",
                              onlyDigits(value).slice(0, 2)
                            )
                          }
                          placeholder={
                            tier.billingFrequency === "MONTHLY" ? "1 to 31" : "1"
                          }
                          inputMode="numeric"
                        />

                        <Field
                          label="Grace period days"
                          value={tier.gracePeriodDays}
                          error={errors.gracePeriodDays}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`grace-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "gracePeriodDays",
                              onlyDigits(value).slice(0, 3)
                            )
                          }
                          placeholder="5"
                          inputMode="numeric"
                        />

                        <SelectField
                          label="Late fee type"
                          value={tier.lateFeeType}
                          error=""
                          onBlur={() => {}}
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "lateFeeType",
                              value as LateFeeType
                            )
                          }
                          options={[
                            { label: "Flat amount", value: "FLAT" },
                            { label: "Percent", value: "PERCENT" },
                          ]}
                        />

                        <Field
                          label={
                            tier.lateFeeType === "PERCENT"
                              ? "Initial late fee percent"
                              : "Initial late fee amount"
                          }
                          value={tier.lateFeeInitial}
                          error={errors.lateFeeInitial}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`lateInitial-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "lateFeeInitial",
                              sanitizeMoney(value)
                            )
                          }
                          placeholder={tier.lateFeeType === "PERCENT" ? "5.00" : "50.00"}
                          inputMode="decimal"
                        />

                        <Field
                          label={
                            tier.lateFeeType === "PERCENT"
                              ? "Daily late fee percent"
                              : "Daily late fee amount"
                          }
                          value={tier.lateFeeDaily}
                          error={errors.lateFeeDaily}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`lateDaily-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "lateFeeDaily",
                              sanitizeMoney(value)
                            )
                          }
                          placeholder={tier.lateFeeType === "PERCENT" ? "1.00" : "10.00"}
                          inputMode="decimal"
                        />

                        <Field
                          label="Max late fee days"
                          value={tier.maxLateFeeDays}
                          error={errors.maxLateFeeDays}
                          onBlur={() =>
                            setTouched((prev) => ({
                              ...prev,
                              [`lateMax-${tier.id}`]: true,
                            }))
                          }
                          onChange={(value) =>
                            setTierField(
                              tier.id,
                              "maxLateFeeDays",
                              onlyDigits(value).slice(0, 3)
                            )
                          }
                          placeholder="30"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="mt-4 rounded-[24px] border border-[#334155] bg-[#233143] px-5 py-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.25)]">
                       <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
                       Billing Summary
                       </div>

                       <p className="text-base sm:text-lg leading-7 font-medium text-white">
                       {buildLateFeeSummary(tier)}
                       </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {submitError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1 || saving}
              className="rounded-2xl border border-[#cbd5e1] bg-white px-5 py-4 text-sm font-semibold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="rounded-2xl bg-[#0f172a] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-2xl bg-[#0f172a] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Finishing setup..." : "Create property"}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: "text" | "search" | "email" | "tel" | "url" | "none" | "numeric" | "decimal";
  maxLength?: number;
};

function Field({
  label,
  value,
  error,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
}: FieldProps) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[#334155]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`w-full rounded-2xl border bg-white px-4 py-4 text-base text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${
          error
            ? "border-red-300 ring-2 ring-red-100"
            : "border-[#cbd5e1] focus:border-[#0f172a]"
        }`}
      />
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: { label: string; value: string }[];
};

function SelectField({
  label,
  value,
  error,
  onChange,
  onBlur,
  options,
}: SelectFieldProps) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[#334155]">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-2xl border bg-white px-4 py-4 text-base text-[#0f172a] outline-none transition ${
          error
            ? "border-red-300 ring-2 ring-red-100"
            : "border-[#cbd5e1] focus:border-[#0f172a]"
        }`}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </label>
  );
}