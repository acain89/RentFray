"use client";

import { useState } from "react";

export default function PayNowButton({
  unitId,
  amount,
}: {
  unitId: string;
  amount: number;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (loading) return;

    if (!amount || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unitId, amount }),
      });

      const data = await res.json();

      if (data?.ok && data?.data?.url) {
        window.location.href = data.data.url;
        return;
      }

      alert(data.error || "Payment failed");
    } catch {
      alert("Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
    >
      {loading ? "Redirecting..." : "Verify Bank & Pay"}
    </button>
  );
}