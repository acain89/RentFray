"use client";

import { useState } from "react";

type ManualChargeFormProps = {
  propertyId: string;
  unitId: string;
  tenantId?: string;
  defaultRent?: number;
};

export default function ManualChargeForm({
  propertyId,
  unitId,
  tenantId,
  defaultRent,
}: ManualChargeFormProps) {
  const [type, setType] = useState("RENT_CHARGE");
  const [amount, setAmount] = useState(defaultRent ? String(defaultRent) : "");
  const [memo, setMemo] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);

  async function submitCharge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/ledger/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId,
          unitId,
          tenantId: tenantId || "",
          type,
          amount: Number(amount),
          memo,
          effectiveDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to post charge.");
        setLoading(false);
        return;
      }

      window.location.reload();
    } catch {
      alert("Failed to post charge.");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={submitCharge} className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Post Charge</h2>

      <div>
        <label className="block text-sm mb-1">Type</label>
        <select
          className="w-full rounded border p-2"
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            setType(next);
            if (next === "RENT_CHARGE" && defaultRent) {
              setAmount(String(defaultRent));
            }
          }}
        >
          <option value="RENT_CHARGE">Rent Charge</option>
          <option value="LATE_FEE">Late Fee</option>
          <option value="OTHER_FEE">Other Fee</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Amount</label>
        <input
          className="w-full rounded border p-2"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000.00"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Effective Date</label>
        <input
          className="w-full rounded border p-2"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Memo</label>
        <input
          className="w-full rounded border p-2"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="March rent / pet fee / late fee"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Posting..." : "Post Charge"}
      </button>
    </form>
  );
}