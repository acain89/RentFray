"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OnboardingStatus = {
  propertyStatus: string;
  managerAccountComplete: boolean;
  propertyInformationComplete: boolean;
  pricingComplete: boolean;
  billingComplete: boolean;
  bankConnected: boolean;
};

type DashboardResponse =
  | {
      ok: true;
      property: {
        name: string;
        onboarding?: OnboardingStatus;
      };
    }
  | {
      ok?: false;
      error?: string;
    };

type TaskKey = keyof Pick<
  OnboardingStatus,
  | "managerAccountComplete"
  | "propertyInformationComplete"
  | "pricingComplete"
  | "billingComplete"
  | "bankConnected"
>;

type Task = {
  key: TaskKey;
  title: string;
  description: string;
  href: string | null;
};

const TASKS: Task[] = [
  {
    key: "managerAccountComplete",
    title: "Manager Account",
    description: "Your RentFray manager login has been created.",
    href: null,
  },
  {
    key: "propertyInformationComplete",
    title: "Property Information",
    description: "Add the property name, type, and address.",
    href: "/manager/dashboard?panel=propertySetup&returnTo=setup",
  },
  {
    key: "pricingComplete",
    title: "Units & Pricing",
    description: "Create your rent tiers and enter the number of units.",
    href: "/manager/dashboard?panel=rent&returnTo=setup",
  },
  {
    key: "billingComplete",
    title: "Billing Rules",
    description: "Choose the due date, grace period, and late-fee rules.",
    href: "/manager/dashboard?panel=gplf&returnTo=setup",
  },
  {
    key: "bankConnected",
    title: "Connect Bank Account",
    description: "Connect Stripe so RentFray can deposit collected payments.",
    href: "/manager/dashboard?panel=bank&returnTo=setup",
  },
];

export default function GettingStartedPage() {
  const router = useRouter();

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [propertyName, setPropertyName] = useState("My Property");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

async function load(): Promise<void> {
  try {
    setLoading(true);
        const response = await fetch("/api/manager/dashboard", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const result = (await response.json().catch(() => null)) as
          | DashboardResponse
          | null;

        if (!response.ok || !result || !("ok" in result) || !result.ok) {
          if (response.status === 401) {
            router.replace("/manager/login");
            return;
          }

          throw new Error(
            result && "error" in result && result.error
              ? result.error
              : "Could not load your account."
          );
        }

        if (cancelled) return;

        setPropertyName(result.property.name || "My Property");
        setOnboarding(result.property.onboarding ?? null);
      } catch (loadError) {
        if (cancelled) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your account."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

 if (loading && !onboarding) {
  return (
    <main className="min-h-screen bg-[var(--rf-bg-page)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl animate-pulse">
        <div className="mb-6 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-10 w-80 max-w-full rounded bg-slate-200" />
          <div className="h-5 w-full max-w-xl rounded bg-slate-200" />
        </div>

        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="h-16 rounded-2xl bg-slate-100" />
          <div className="h-16 rounded-2xl bg-slate-100" />
          <div className="h-16 rounded-2xl bg-slate-100" />
          <div className="h-16 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </main>
  );
}

  if (error && !loading) {
    return (
      <main className="min-h-screen bg-[var(--rf-bg-page)] px-4 py-8 text-[var(--rf-text)]">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
            {error || "Onboarding information is unavailable."}
          </div>
        </div>
      </main>
    );
  }

if (!onboarding) {
  return null;
}

  const completedCount = TASKS.filter(
    (task) => onboarding[task.key]
  ).length;

  const nextTask = TASKS.find((task) => !onboarding[task.key]);

  return (
    <main className="min-h-screen bg-[var(--rf-bg-page)] px-4 py-8 text-[var(--rf-text)] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            RentFray
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Get your property ready
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--rf-text-soft)] sm:text-base">
            Your manager account is ready. Complete the remaining items below
            to begin collecting rent for {propertyName}.
          </p>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[var(--rf-shadow-sm)] sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Getting started
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {completedCount} of {TASKS.length} complete
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/manager/dashboard")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-900/10 sm:w-auto"
            >
              Return to Dashboard
            </button>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{
                width: `${Math.round(
                  (completedCount / TASKS.length) * 100
                )}%`,
              }}
            />
          </div>

          <div className="mt-6 space-y-3">
            {TASKS.map((task) => {
              const complete = onboarding[task.key];
              const isNext = nextTask?.key === task.key;
              const clickable = Boolean(task.href);

              return (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => {
                    if (task.href) {
                      router.push(task.href);
                    }
                  }}
                  disabled={!clickable}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    complete
                      ? "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-50"
                      : isNext
                        ? "border-emerald-300 bg-white shadow-sm hover:border-emerald-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  } ${
                    clickable
                      ? "cursor-pointer"
                      : "cursor-default disabled:opacity-100"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          complete
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-300 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {complete ? "\u2713" : ""}
                      </div>

                      <div>
                        <div className="font-semibold text-slate-900">
                          {task.title}
                        </div>

                        <div className="mt-1 text-sm leading-5 text-slate-600">
                          {task.description}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`pl-11 text-sm font-semibold sm:pl-0 ${
                        complete
                          ? "text-emerald-700"
                          : isNext
                            ? "text-[#173024]"
                            : "text-slate-500"
                      }`}
                    >
                      {complete
                        ? task.href
                          ? "Review"
                          : "Complete"
                        : isNext
                          ? "Continue"
                          : task.href
                            ? "Open"
                            : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            You can leave and return at any time. Completed information remains
            saved to your account.
          </div>
        </section>
      </div>
    </main>
  );
}