"use client";

import { type ReactNode } from "react";

type Props = {
  bankStatus?: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "RESTRICTED";
  bankMessage?: string;
  onClose: () => void;
  connectBank: () => Promise<void>;
  handleOnboard: () => Promise<void>;
};

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export default function BankPanel({
  bankStatus,
  bankMessage,
  onClose,
  connectBank,
  handleOnboard,
}: Props) {
  let title = "Connect payout account";
  let description =
    "This is where your rent payments will be sent.";
  let buttonText = "Connect Payout Account";
  let action = connectBank;

  if (bankStatus === "PENDING" || bankStatus === "RESTRICTED") {
    title = "Finish Stripe setup";
    description =
      "Additional information is required before payments can be enabled.";
    buttonText = "Finish Stripe Setup";
    action = handleOnboard;
  }

  if (bankStatus === "CONNECTED") {
    title = "Payments active";
    description = "Your account is ready to receive payments.";
  }

  return (
    <OverlayShell
      title="Payout Account"
      subtitle="Secure Stripe onboarding"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-slate-600">{description}</div>

        {bankMessage && (
          <div className="text-sm text-slate-500">{bankMessage}</div>
        )}

        {bankStatus !== "CONNECTED" && (
          <button
            onClick={action}
            className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white"
          >
            {buttonText}
          </button>
        )}
      </div>
    </OverlayShell>
  );
}