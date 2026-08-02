"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type CreateAccountResponse =
  | {
      ok: true;
      propertyId: string;
      propertyCode: string;
      redirectTo: string;
    }
  | {
      ok: false;
      error?: string;
    };

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function SetupPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validate(): string | null {
    if (!form.firstName.trim()) {
      return "Enter your first name.";
    }

    if (!form.lastName.trim()) {
      return "Enter your last name.";
    }

    if (!isEmail(form.email)) {
      return "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (form.password !== form.confirmPassword) {
      return "Passwords do not match.";
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

    setSubmitting(true);

    try {
      const response = await fetch("/api/setup/create-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const result =
        await readJsonSafely<CreateAccountResponse>(response);

      if (!response.ok || !result || !result.ok) {
        setError(
          result && !result.ok && result.error
            ? result.error
            : "Could not create your account."
        );
        return;
      }

      router.push(result.redirectTo || "/manager/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#dfe7ee] px-4 py-8 text-[#0f172a] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <div className="text-xs font-semibold tracking-[0.2em] text-[#0f172a]/70">
            RENTFRAY
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Create your free manager account
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-[#475569] sm:text-base">
            Create your account in about 30 seconds. Your RentFray dashboard
            will be ready immediately, and you can finish your property details
            afterward.
          </p>
        </header>

        <section className="rounded-[28px] border border-[#cbd5e1] bg-white p-5 shadow-sm sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                value={form.firstName}
                autoComplete="given-name"
                onChange={(value) => updateField("firstName", value)}
              />

              <Field
                label="Last name"
                value={form.lastName}
                autoComplete="family-name"
                onChange={(value) => updateField("lastName", value)}
              />
            </div>

            <Field
              label="Email"
              type="email"
              value={form.email}
              autoComplete="email"
              onChange={(value) => updateField("email", value)}
            />

            <Field
              label="Password"
              type="password"
              value={form.password}
              autoComplete="new-password"
              helper="Use at least 8 characters."
              onChange={(value) => updateField("password", value)}
            />

            <Field
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              autoComplete="new-password"
              onChange={(value) => updateField("confirmPassword", value)}
            />

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-[#233143] px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#172234] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Create Free Account"}
            </button>

            <p className="text-center text-sm text-[#64748b]">
              Already have an account?{" "}
              <a
                href="/manager/login"
                className="font-semibold text-[#233143] underline-offset-4 hover:underline"
              >
                Manager Login
              </a>
            </p>
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
  type?: "text" | "email" | "password";
  autoComplete?: string;
  helper?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  helper,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#1e293b]">
        {label}
      </span>

      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-base text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#233143] focus:ring-4 focus:ring-[#233143]/10"
      />

      {helper ? (
        <span className="mt-2 block text-xs text-[#64748b]">
          {helper}
        </span>
      ) : null}
    </label>
  );
}