"use client";

export default function PayNowButton({
  unitId,
  amount,
}: {
  unitId: string;
  amount: number;
}) {
  async function handlePay() {
    if (!amount || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }

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
    } else {
      alert(data.error || "Payment failed");
    }
  }

  return (
    <button
      onClick={handlePay}
      className="rounded bg-green-600 px-4 py-2 text-white"
    >
      Pay Now
    </button>
  );
}