"use client";

import { useState } from "react";

type AdjustType = "CHARGE" | "CREDIT";

type Props = {
  unitId: string;
  propertyId?: string;
  tierId?: string;
  onClose: () => void;
  onSuccess: () => void;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export default function AdjustBalanceForm({
  unitId,
  onClose,
  onSuccess,
}: Props) {
  const [type, setType] = useState<AdjustType>("CHARGE");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<void> {
    try {
      setLoading(true);

      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        alert("Enter a valid amount greater than 0.");
        return;
      }

   const res = await fetch("/api/ledger/adjust", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify({
     unitId,
          type,
          amount: roundMoney(parsedAmount),
          memo: memo.trim(),
        }),
      });

      const json: { ok?: boolean; error?: string } = await res.json();

      if (!res.ok || !json.ok) {
        alert(json.error || "Failed to adjust balance.");
        return;
      }

      onSuccess();
    } catch {
      alert("Failed to adjust balance.");
    } finally {
      setLoading(false);
    }
  }

  const selectedButtonClass =
    "border-slate-900 bg-slate-900 text-white shadow-sm";
  const unselectedButtonClass =
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setType("CHARGE")}
          disabled={loading}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
            type === "CHARGE" ? selectedButtonClass : unselectedButtonClass
          }`}
        >
          One-Time Charge
        </button>



        <button
          type="button"
          onClick={() => setType("CREDIT")}
          disabled={loading}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
            type === "CREDIT" ? selectedButtonClass : unselectedButtonClass
          }`}
        >
          Credit
        </button>
      </div>


        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-950">
              {type === "CHARGE" ? "One-Time Charge" : "Credit"}
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              {type === "CHARGE"
                ? "Add a one-time charge to this unit."
                : "Apply a credit to reduce the current balance."}
            </div>
          </div>

          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />

          <input
            type="text"
            placeholder="Memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>


  <div className="flex gap-3">
    <button
      type="button"
      onClick={onClose}
      disabled={loading}
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
    >
      Cancel
    </button>

    <button
      type="button"
      onClick={submit}
      disabled={loading}
      className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
    >
      {loading ? "Applying..." : "Apply"}
    </button>
  </div>
    </div>
  );
}