"use client";

type Props = {
bankStatus?: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "RESTRICTED";
bankMessage?: string;
isOwner: boolean;
onConnect: () => void;
onOnboard: () => void;
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
"Connect a bank account to start receiving rent payments.",
color: "text-slate-600",
};
}
}

export default function BankPanel({
bankStatus,
bankMessage,
isOwner,
onConnect,
onOnboard,
}: Props) {
const ui = getStatusUI(bankStatus);

return ( <div className="space-y-6">
{/* STATUS */} <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
<div className={`text-lg font-semibold ${ui.color}`}>
{ui.title} </div> <div className="mt-1 text-sm text-slate-600">
{ui.description} </div>

    {bankMessage ? (
      <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3 text-sm text-slate-700">
        {bankMessage}
      </div>
    ) : null}
  </div>

  {/* ACTIONS */}
  {isOwner ? (
    <div className="flex flex-wrap gap-3">
      {bankStatus === "NOT_CONNECTED" && (
        <button
          type="button"
          onClick={onConnect}
          className="rf-btn rf-btn-primary px-4 text-sm"
        >
          Connect Bank Account
        </button>
      )}

      {(bankStatus === "CONNECTED" ||
        bankStatus === "PENDING" ||
        bankStatus === "RESTRICTED") && (
        <button
          type="button"
          onClick={onOnboard}
          className="rf-btn rf-btn-primary px-4 text-sm"
        >
          {bankStatus === "CONNECTED"
            ? "Update Payout Account"
            : "Continue Setup"}
        </button>
      )}
    </div>
  ) : (
    <div className="text-sm text-slate-500">
      Only the account owner can manage payout settings.
    </div>
  )}
</div>

);
}
