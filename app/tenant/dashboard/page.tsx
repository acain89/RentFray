// app/tenant/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PayNowButton from "@/app/components/PayNowButton";

type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  effectiveDate: string;
  memo?: string | null;
};

type StatementItem = {
  label: string;
  amount: number;
};

type StatementData = {
  rent: number;
  recurringCharges: number;
  lateFees: number;
  processingFee: number;
  credits: number;
  subtotal: number;
  totalDue: number;
  items: StatementItem[];
};

type DashboardData = {
  ok: true;
  tenantName: string;
  propertyName?: string;
  propertyStatus: string;
  paymentEnabled: boolean;
  dueDate?: string;
  graceEndsOn?: string;
  unitNumber?: string;
  unitId: string;
  balance: number;
  totalPaid: number;
  isDelinquent: boolean;
  ledger: LedgerEntry[];
  statement?: StatementData;
};

type DashboardError = {
  error?: string;
  ok?: false;
};

function money(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US");
}

function normalizeDashboardData(value: unknown): DashboardData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<DashboardData>;

  if (data.ok !== true) {
    return null;
  }

  if (typeof data.tenantName !== "string") {
    return null;
  }

  if (typeof data.propertyStatus !== "string") {
    return null;
  }

  if (typeof data.paymentEnabled !== "boolean") {
    return null;
  }

  if (typeof data.unitId !== "string") {
    return null;
  }

  if (typeof data.balance !== "number") {
    return null;
  }

  if (typeof data.totalPaid !== "number") {
    return null;
  }

  if (typeof data.isDelinquent !== "boolean") {
    return null;
  }

  const ledger: LedgerEntry[] = Array.isArray(data.ledger)
    ? data.ledger
        .filter((entry): entry is LedgerEntry => {
          if (!entry || typeof entry !== "object") {
            return false;
          }

          const candidate = entry as Partial<LedgerEntry>;

          return (
            typeof candidate.id === "string" &&
            typeof candidate.type === "string" &&
            typeof candidate.amount === "number" &&
            typeof candidate.effectiveDate === "string"
          );
        })
        .map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount,
          effectiveDate: entry.effectiveDate,
          memo: entry.memo ?? null,
        }))
    : [];

  let statement: StatementData | undefined;

  if (data.statement && typeof data.statement === "object") {
    const candidate = data.statement as Partial<StatementData>;

    const items: StatementItem[] = Array.isArray(candidate.items)
      ? candidate.items
          .filter((item): item is StatementItem => {
            if (!item || typeof item !== "object") {
              return false;
            }

            const row = item as Partial<StatementItem>;

            return (
              typeof row.label === "string" &&
              typeof row.amount === "number"
            );
          })
          .map((item) => ({
            label: item.label,
            amount: item.amount,
          }))
      : [];

    if (
      typeof candidate.rent === "number" &&
      typeof candidate.recurringCharges === "number" &&
      typeof candidate.lateFees === "number" &&
      typeof candidate.credits === "number" &&
      typeof candidate.subtotal === "number" &&
      typeof candidate.totalDue === "number" &&
      typeof candidate.processingFee === "number"
    ) {
      statement = {
  rent: candidate.rent,
  recurringCharges: candidate.recurringCharges,
  lateFees: candidate.lateFees,
  processingFee: candidate.processingFee,
  credits: candidate.credits,
  subtotal: candidate.subtotal,
  totalDue: candidate.totalDue,
  items,
};
    }
  }

  return {
    ok: true,
    tenantName: data.tenantName,
    propertyName:
      typeof data.propertyName === "string" ? data.propertyName : undefined,
    propertyStatus: data.propertyStatus,
    paymentEnabled: data.paymentEnabled,
    dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
    graceEndsOn:
      typeof data.graceEndsOn === "string" ? data.graceEndsOn : undefined,
    unitNumber:
      typeof data.unitNumber === "string" ? data.unitNumber : undefined,
    unitId: data.unitId,
    balance: data.balance,
    totalPaid: data.totalPaid,
    isDelinquent: data.isDelinquent,
    ledger,
    statement,
  };
}

export default function TenantDashboard() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/tenant/dashboard", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        const result: unknown = await res.json().catch(() => null);

        if (!active) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok) {
          const apiError =
            result && typeof result === "object"
              ? (result as DashboardError).error
              : undefined;

          setError(apiError || "Failed to load dashboard.");
          return;
        }

        const normalized = normalizeDashboardData(result);

        if (!normalized) {
          setError("Failed to load dashboard.");
          return;
        }

        setData(normalized);

        const dueAmount =
          normalized.statement?.totalDue ?? normalized.balance ?? 0;

        setAmount(String(Number(dueAmount || 0).toFixed(2)));
      } catch {
        if (!active) return;
        setError("Failed to load dashboard.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <div className="text-sm text-red-600">{error || "Error loading."}</div>
          <button
            type="button"
            onClick={() => router.replace("/property-code")}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  const ledger = Array.isArray(data.ledger) ? data.ledger : [];
  const statement = data.statement;
  const paymentBlocked = !data.paymentEnabled;
  const totalDue = statement?.totalDue ?? data.balance;
  const numericAmount = Number(amount || 0);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md space-y-5">
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-slate-700">
            RENTFRAY
          </div>

          <h1 className="mt-3 text-2xl font-semibold">{data.tenantName}</h1>

          <p className="mt-1 text-sm text-slate-600">
            {data.propertyName || "Property"} · Unit {data.unitNumber || "—"}
          </p>
        </div>

        <div className="rounded-[28px] border border-sky-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs text-slate-500">Current Balance</p>

          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {money(totalDue)}
          </p>

          <p className="mt-2 text-sm font-medium">
            {data.isDelinquent ? (
              <span className="text-red-600">Past Due</span>
            ) : (
              <span className="text-green-600">Current</span>
            )}
          </p>
        </div>

        {statement ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Current Statement
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {statement.items.length > 0 ? (
                statement.items.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span className="break-words">{item.label}</span>
                    </div>

                    <span
                      className={`shrink-0 font-medium ${
                        item.amount < 0 ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {item.amount < 0
                        ? `- ${money(Math.abs(item.amount))}`
                        : money(item.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">
                  No charges have been posted for this billing period yet.
                </div>
              )}

              <div className="my-2 border-t border-slate-200" />

              <div className="flex justify-between">
                <span>Rent</span>
                <span className="font-medium">{money(statement.rent)}</span>
              </div>

              <div className="flex justify-between">
                <span>Charges</span>
                <span className="font-medium">
                  {money(statement.recurringCharges)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Late Fees</span>
                <span className="font-medium">{money(statement.lateFees)}</span>
              </div>

              <div className="flex justify-between">
  <span>Processing Fee</span>
  <span className="font-medium">{money(statement.processingFee ?? 0)}</span>
</div>

              <div className="border-t border-slate-200 pt-3" />

              <div className="flex justify-between text-base font-semibold text-slate-950">
                <span>
                  Total due
                  {data.dueDate ? ` on ${fmtDate(data.dueDate)}` : ""}
                </span>
                <span>{money(totalDue)}</span>
              </div>

              {data.graceEndsOn ? (
                <div className="text-sm text-slate-500">
                  Grace period ends {fmtDate(data.graceEndsOn)}.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!paymentBlocked && totalDue > 0 ? (
          <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">Make a Payment</p>

            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-lg"
            />

            <PayNowButton unitId={data.unitId} amount={numericAmount} />
          </div>
        ) : null}

        {paymentBlocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            Payments are currently disabled.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/tenant/payment-history")}
            className="rounded-xl border px-4 py-3 text-sm"
          >
            Payments
          </button>

          <button
            type="button"
            onClick={() => router.push("/tenant/maintenance")}
            className="rounded-xl border px-4 py-3 text-sm"
          >
            Maintenance
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">Recent Activity</h2>

          <div className="space-y-2">
            {ledger.length === 0 ? (
              <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-500">
                No activity yet.
              </div>
            ) : (
              ledger.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border bg-white p-3 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <span>{entry.type}</span>
                    <span>{money(entry.amount)}</span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {fmtDate(entry.effectiveDate)}
                  </div>

                  {entry.memo ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {entry.memo}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}