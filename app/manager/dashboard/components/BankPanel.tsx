"use client";

type Props = {
  bankStatus?: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "RESTRICTED";
  bankMessage?: string;
  onboardingComplete: boolean;
  isOwner: boolean;
  onConnect: () => void;
  onOnboard: () => void;
  rentFrayStartDate: string;
  setRentFrayStartDate: (value: string) => void;
  rentFrayStartDateLocked: boolean;
  saveRentFrayStartDate: () => void;
  savingRentFrayStartDate: boolean;
};

type StatusUI = {
  title: string;
  description: string;
  textClass: string;
  badgeClass: string;
};

function getStatusUI(
  status: Props["bankStatus"],
  onboardingComplete: boolean
): StatusUI {
  switch (status) {
    case "CONNECTED":
      return {
        title: "Stripe connected",
        description:
          "Your property is ready to receive tenant payments. Stripe will deposit payouts into your connected bank account.",
        textClass: "text-emerald-700",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };

    case "PENDING":
      return onboardingComplete
        ? {
            title: "Verification in progress",
            description:
              "Stripe is reviewing your information. Payment access will update automatically when verification is complete.",
            textClass: "text-amber-700",
            badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
          }
        : {
            title: "Stripe setup in progress",
            description:
              "Finish your secure Stripe onboarding to enable tenant payments and bank payouts.",
            textClass: "text-amber-700",
            badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
          };

    case "RESTRICTED":
      return {
        title: onboardingComplete
          ? "Additional verification required"
          : "Stripe action required",
        description:
          "Stripe needs more information before payments or payouts can be fully enabled.",
        textClass: "text-red-700",
        badgeClass: "border-red-200 bg-red-50 text-red-700",
      };

    case "NOT_CONNECTED":
    default:
      return {
        title: "Not connected",
        description:
          "Connect Stripe so tenant payments can be deposited directly into your bank account.",
        textClass: "text-slate-700",
        badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
      };
  }
}

function formatDateLong(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getOrdinal(day: number): string {
  const mod100 = day % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export default function BankPanel({
  bankStatus,
  bankMessage,
  onboardingComplete,
  isOwner,
  onConnect,
  onOnboard,
  rentFrayStartDate,
  setRentFrayStartDate,
  rentFrayStartDateLocked,
  saveRentFrayStartDate,
  savingRentFrayStartDate,
}: Props) {
  const ui = getStatusUI(bankStatus, onboardingComplete);
  const stripeConnected = bankStatus === "CONNECTED";
  const readyToCollect = rentFrayStartDateLocked && stripeConnected;
  const selectedDay = Number(rentFrayStartDate.split("-")[2] || 0);
  const dueDayLabel = selectedDay ? getOrdinal(selectedDay) : "selected day";

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/30 p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
          5. Go Live
        </div>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Complete your final two steps
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Set your property-wide monthly rent due date, then securely connect
          Stripe so tenant payments can be deposited into your bank account.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div
            className={`rounded-2xl border px-4 py-3 ${
              rentFrayStartDateLocked
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white/70"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Step 1
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {rentFrayStartDateLocked
                ? "✓ Monthly due date locked"
                : "Set monthly due date"}
            </div>
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 ${
              stripeConnected
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white/70"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Step 2
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {stripeConnected
                ? "✓ Stripe connected"
                : "Connect Stripe"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Step 1
        </div>

        <h3 className="mt-2 text-xl font-semibold text-slate-950">
          RentFray Start Date
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose the first date tenants should begin paying through RentFray.
          This date becomes the monthly rent due date for your entire property.
        </p>

        {rentFrayStartDateLocked ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
              Monthly Due Date Locked
            </div>

            <div className="mt-2 text-xl font-semibold text-emerald-950">
              {formatDateLong(rentFrayStartDate)}
            </div>

            <div className="mt-3 space-y-2 text-sm leading-6 text-emerald-900">
              <p>
                Base rent and recurring charges are due on the{" "}
                <strong>{dueDayLabel} of every month</strong>.
              </p>

              <p>
                Your configured grace-period and late-fee rules will be applied
                automatically when needed.
              </p>
            </div>
          </div>
        ) : isOwner ? (
          <>
            <label className="mt-5 block">
              <span className="rf-label">Select RentFray Start Date</span>

              <input
                type="date"
                value={rentFrayStartDate}
                onChange={(event) =>
                  setRentFrayStartDate(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
              />
            </label>

            {rentFrayStartDate ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">
                  Beginning {formatDateLong(rentFrayStartDate)}
                </div>

                <div className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                  <p>
                    Base rent and recurring charges will be due on the{" "}
                    <strong>{dueDayLabel} of every month</strong>.
                  </p>

                  <p>
                    Your configured grace-period and late-fee rules will be
                    applied automatically when needed.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                Your property&apos;s monthly rent due date is permanent after
                activation.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Everything else—unit counts, pricing, recurring charges, grace
                periods, and late-fee rules—can be updated at any time.
              </p>
            </div>

            <button
              type="button"
              onClick={saveRentFrayStartDate}
              disabled={
                savingRentFrayStartDate || !rentFrayStartDate
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#173024] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10241b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {savingRentFrayStartDate
                ? "Locking Due Date..."
                : "Confirm Permanent Due Date"}
            </button>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Only the account owner can set the permanent monthly due date.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[#d9d5ff] bg-white shadow-sm">
        <div className="border-b border-[#e7e4ff] bg-gradient-to-r from-[#f7f5ff] to-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#635bff]">
                Step 2
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className="text-2xl font-bold tracking-tight text-[#635bff]">
                  stripe
                </div>

                <span className="rounded-full border border-[#d9d5ff] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#635bff]">
                  Secure payments
                </span>
              </div>
            </div>

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${ui.badgeClass}`}
            >
              {ui.title}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-xl font-semibold text-slate-950">
            Receive Your Payments
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Stripe securely verifies your business and deposits tenant payments
            directly into your connected bank account.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
              <strong className="block text-slate-900">
                Secure verification
              </strong>
              Stripe handles identity and bank verification.
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
              <strong className="block text-slate-900">
                Direct deposits
              </strong>
              Tenant payments are sent to your connected bank.
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
              <strong className="block text-slate-900">
                Banking privacy
              </strong>
              RentFray never stores your bank account information.
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className={`text-sm font-semibold ${ui.textClass}`}>
              {ui.title}
            </div>

            <div className="mt-1 text-sm leading-6 text-slate-600">
              {bankMessage || ui.description}
            </div>
          </div>

          {isOwner ? (
            <div className="mt-4">
              {bankStatus === "NOT_CONNECTED" || !bankStatus ? (
                <button
                  type="button"
                  onClick={onConnect}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#635bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5148e5]"
                >
                  Connect Securely Through Stripe
                </button>
              ) : null}

              {!onboardingComplete && bankStatus === "PENDING" ? (
                <button
                  type="button"
                  onClick={onOnboard}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#635bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5148e5]"
                >
                  Continue Secure Stripe Setup
                </button>
              ) : null}

              {bankStatus === "RESTRICTED" ? (
                <button
                  type="button"
                  onClick={onOnboard}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#635bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5148e5]"
                >
                  Review Stripe Requirements
                </button>
              ) : null}

              {stripeConnected ? (
                <button
                  type="button"
                  onClick={onOnboard}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d9d5ff] bg-[#f7f5ff] px-5 py-3 text-sm font-semibold text-[#5148e5] transition hover:bg-[#efedff]"
                >
                  Manage Stripe Connection
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">
              Only the account owner can manage Stripe payout settings.
            </div>
          )}
        </div>
      </section>

      {readyToCollect ? (
        <section className="rounded-[28px] border border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white">
            ✓
          </div>

          <h3 className="mt-4 text-2xl font-semibold text-emerald-950">
            You&apos;re Live
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-800">
            Your monthly due date is locked and Stripe is connected. RentFray
            is ready to collect and track tenant payments.
          </p>

          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-emerald-950">
            Give tenants the Tenant Instruction Sheet to begin accepting
            payments.
          </p>
        </section>
      ) : null}
    </div>
  );
}