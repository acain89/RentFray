"use client";

type Props = {
  bankStatus?: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "RESTRICTED";
  bankMessage?: string;
  isOwner: boolean;
  onConnect: () => void;
  onOnboard: () => void;
  billingCycleStartDate: string;
  setBillingCycleStartDate: (value: string) => void;
  billingCycleStartDateLocked: boolean;
  saveBillingCycleStartDate: () => void;
  savingBillingCycleStartDate: boolean;
};

function getStatusUI(status?: Props["bankStatus"]) {
  switch (status) {
    case "CONNECTED":
      return {
        title: "Payments active",
        description:
          "Your account is ready to receive payments. Payouts will be deposited to your connected bank account.",
        color: "text-emerald-600",
      };

    case "PENDING":
      return {
        title: "Setup in progress",
        description:
          "Your account setup is not complete yet. Finish onboarding to enable payouts.",
        color: "text-amber-600",
      };

    case "RESTRICTED":
      return {
        title: "Action required",
        description:
          "Stripe requires additional information before payouts can continue.",
        color: "text-red-600",
      };

    case "NOT_CONNECTED":
    default:
      return {
        title: "No payout account",
        description:
          "Set up secure Stripe payouts so this property can receive tenant payments.",
        color: "text-slate-600",
      };
  }
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}/${year}`;
}

export default function BankPanel({
  bankStatus,
  bankMessage,
  isOwner,
  onConnect,
  onOnboard,
  billingCycleStartDate,
  setBillingCycleStartDate,
  billingCycleStartDateLocked,
  saveBillingCycleStartDate,
  savingBillingCycleStartDate,
}: Props) {
  const ui = getStatusUI(bankStatus);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">
          RentFray Start Date
        </div>

        <div className="mt-2 text-sm leading-6 text-slate-600">
          Choose the date RentFray should begin collecting and tracking rent
          for this property. This is usually the first day you expect tenants
          to start paying through RentFray.
        </div>

        <div className="mt-2 text-xs leading-5 text-slate-500">
          Charges before this date will not appear in tenant balances unless
          you add them manually.
        </div>

        {billingCycleStartDateLocked ? (
          <div className="mt-4 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
            <div className="text-sm font-semibold text-[#166534]">
              Locked: {formatDateOnly(billingCycleStartDate)}
            </div>

            <div className="mt-1 text-xs leading-5 text-[#15803d]">
              This RentFray start date is permanent and cannot be changed.
            </div>
          </div>
        ) : isOwner ? (
          <>
            <input
              type="date"
              value={billingCycleStartDate}
              onChange={(event) =>
                setBillingCycleStartDate(event.target.value)
              }
              className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
            />

            <button
              type="button"
              onClick={saveBillingCycleStartDate}
              disabled={
                savingBillingCycleStartDate || !billingCycleStartDate
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#173024] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10241b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {savingBillingCycleStartDate
                ? "Saving..."
                : "Confirm Start Date"}
            </button>
          </>
        ) : null}
      </section>

<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
    Stripe payouts
  </div>

  <div className={`mt-2 text-lg font-semibold ${ui.color}`}>
    {ui.title}
  </div>

  <div className="mt-1 text-sm leading-6 text-slate-600">
    {bankMessage || ui.description}
  </div>

  <div className="mt-2 text-xs leading-5 text-slate-500">
    RentFray never stores your bank account information. Stripe securely
    handles account verification and payouts.
  </div>
</section>

      {isOwner ? (
      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-1">
          {bankStatus === "NOT_CONNECTED" ? (
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#173024] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10241b]"
            >
              Connect securely through Stripe
            </button>
          ) : null}

          {bankStatus === "CONNECTED" ||
          bankStatus === "PENDING" ||
          bankStatus === "RESTRICTED" ? (
            <button
              type="button"
              onClick={onOnboard}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#173024] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10241b]"
            >
              {bankStatus === "CONNECTED"
                ? "Manage secure Stripe connection"
                : "Continue secure Stripe setup"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-slate-500">
          Only the account owner can manage payout settings.
        </div>
      )}
    </div>
  );
}