"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type BalanceData = {
  ok: true;
  balanceCents: number;
  propertyName?: string;
  unitNumber?: string;
  property?: {
    settings?: {
      convenienceFee?: number;
    };
  };
};

function isBalanceData(value: unknown): value is BalanceData {
  if (!value || typeof value !== "object" || !("ok" in value) || value.ok !== true ||
      !("balanceCents" in value) || typeof value.balanceCents !== "number" ||
      !Number.isSafeInteger(value.balanceCents)) return false;
  if ("propertyName" in value && value.propertyName !== undefined && typeof value.propertyName !== "string") return false;
  if ("unitNumber" in value && value.unitNumber !== undefined && typeof value.unitNumber !== "string") return false;
  if (!("property" in value) || value.property === undefined) return true;
  const property = value.property;
  if (!property || typeof property !== "object") return false;
  if (!("settings" in property) || property.settings === undefined) return true;
  const settings = property.settings;
  return Boolean(settings && typeof settings === "object" &&
    (!("convenienceFee" in settings) || settings.convenienceFee === undefined ||
      (typeof settings.convenienceFee === "number" && Number.isFinite(settings.convenienceFee))));
}

function responseError(value: unknown, fallback: string): string {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string"
    ? value.error : fallback;
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function TenantPayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [data, setData] =
    useState<BalanceData | null>(null);

  const checkoutStatus =
    searchParams.get("checkout");

  const isSuccess =
    checkoutStatus === "success";

  const isCancelled =
    checkoutStatus === "cancelled";

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        setData(null);

        const res =
          await fetch(
            "/api/tenant/balance",
            {
              cache: "no-store",
            }
          );

        const json: unknown =
          await res.json();

        if (res.status === 401 || res.status === 403) {
          router.replace("/property-code");
          return;
        }

        if (!res.ok) {
          setError(
            responseError(json, "Failed to load payment page.")
          );
          return;
        }

        if (!isBalanceData(json)) {
          setError("Failed to load payment page. Invalid balance data.");
          return;
        }
        setData(json);

        /*
         * Never treat the Checkout return URL as proof that an ACH
         * payment was submitted.
         *
         * Stripe webhooks are authoritative for payment state.
         */
        if (isSuccess) {
          setMessage(
            "Checkout completed. Your payment status will update once bank processing is confirmed."
          );
        } else if (isCancelled) {
          setMessage(
            "Checkout cancelled. No payment was submitted. You can try again below."
          );
        } else {
          setMessage(
            "If you completed a payment, its status will update here once bank processing is confirmed."
          );
        }
      } catch {
        setError(
          "Failed to load payment page."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isSuccess, isCancelled, router]);

  const baseAmountDue =
    useMemo(() => {
      if (!data) return 0;

      return Math.max(0, data.balanceCents / 100);
    }, [data]);

  const convenienceFee =
    useMemo(() => {
      return Math.max(
        0,
        Number(
          data?.property?.settings
            ?.convenienceFee || 0
        )
      );
    }, [data]);

  const totalAmountDue =
    useMemo(() => {
      return Number(
        (
          baseAmountDue +
          convenienceFee
        ).toFixed(2)
      );
    }, [
      baseAmountDue,
      convenienceFee,
    ]);

  async function handlePayNow() {
    if (paying || !data || baseAmountDue <= 0) return;

    try {
      setPaying(true);
      setError("");
      setMessage("");

      const res =
        await fetch(
          "/api/payments/create-session",
          {
            method: "POST",
          }
        );

      const json: unknown =
        await res.json();

      if (res.status === 401 || res.status === 403) {
        router.replace("/property-code");
        return;
      }

      if (!res.ok) {
        setError(
          responseError(json, "Failed to start payment.")
        );
        return;
      }

      if (json && typeof json === "object" && "preview" in json && json.preview) {
        setMessage(
          "message" in json && typeof json.message === "string" ? json.message :
            "Payment preview only. No live session created."
        );
        return;
      }

      if (json && typeof json === "object" && "data" in json && json.data &&
          typeof json.data === "object" && "url" in json.data && typeof json.data.url === "string") {
        window.location.href =
          json.data.url;
        return;
      }

      setError(
        "No checkout session returned."
      );
    } catch {
      setError(
        "Failed to start payment."
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-sm text-red-600">{error || "Failed to load payment page."}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Pay Now
        </h1>

        <p className="text-sm text-neutral-600 mt-1">
          {data?.propertyName ||
            "Property"}
          {data?.unitNumber
            ? ` — Unit ${data.unitNumber}`
            : ""}
        </p>
      </div>

      {message ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-neutral-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="border rounded-xl p-4 bg-white text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="border rounded-xl p-4 bg-white space-y-4">
        <div className="text-sm text-neutral-600">
          Payment summary
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>
              Balance due
            </span>
            <span>
              {money(
                baseAmountDue
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>
              Convenience fee
            </span>
            <span>
              {money(
                convenienceFee
              )}
            </span>
          </div>

          <div className="border-t pt-2 flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>
              {money(
                totalAmountDue
              )}
            </span>
          </div>
        </div>

        <div className="text-sm text-neutral-600">
          Electronic payment only.
        </div>

        <button
          type="button"
          onClick={handlePayNow}
          disabled={
            paying ||
            baseAmountDue <= 0 ||
            totalAmountDue <= 0
          }
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60"
        >
          {paying
            ? "Starting..."
            : "Pay Now"}
        </button>
      </div>
    </div>
  );
}
