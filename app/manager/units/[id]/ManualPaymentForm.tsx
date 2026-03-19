"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ManualPaymentFormProps = {
  propertyId: string;
  unitId: string;
  tenantId?: string;
};

export default function ManualPaymentForm({
  propertyId,
  unitId,
  tenantId,
}: ManualPaymentFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingCredit, setRemainingCredit] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRemainingCredit(0);

    try {
      const res = await fetch("/api/manual-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId,
          unitId,
          tenantId: tenantId || "",
          amount: Number(amount),
          memo,
          effectiveDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setRemainingCredit(Number(data?.remaining || 0));
      setAmount("");
      setMemo("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      router.refresh();
    } catch {
      setError("Request failed.");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Post Manual Payment</h2>

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Amount"
        className="w-full rounded border p-2"
        required
      />

      <input
        value={effectiveDate}
        onChange={(e) => setEffectiveDate(e.target.value)}
        type="date"
        className="w-full rounded border p-2"
        required
      />

      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="Memo"
        className="w-full rounded border p-2"
      />

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Posting..." : "Post Manual Payment"}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {remainingCredit > 0 && (
        <div className="text-xs text-yellow-600">
          Overpayment credit: ${remainingCredit.toFixed(2)}
        </div>
      )}
    </form>
  );
}