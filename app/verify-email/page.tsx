"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

type ResendResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error?: string;
    };

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();

  const email = searchParams.get("email")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const sent = searchParams.get("sent")?.trim() || "";

  const initialSendFailed = sent === "0";
  const isInvalid = status === "invalid";
  const isError = status === "error";

const [sending, setSending] = useState(false);
const [message, setMessage] = useState("");
const [error, setError] = useState("");
const [resendEmail, setResendEmail] = useState(email);

  async function resendVerification(): Promise<void> {
const targetEmail = resendEmail.trim().toLowerCase();

if (!targetEmail) {
  setError("Enter the email address you used to create your account.");
  return;
}

    setSending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: targetEmail }),
      });

      const result = (await response.json()) as ResendResponse;

      if (!response.ok || !result.ok) {
        setError(
          !result.ok && result.error
            ? result.error
            : "Could not resend verification email."
        );
        return;
      }

      setMessage(
        "If an unverified account exists for that email, a new verification link has been sent."
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#dfe7ee] px-4 py-8 text-[#0f172a] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <div className="text-xs font-semibold tracking-[0.2em] text-[#0f172a]/70">
            RENTFRAY
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {isInvalid
              ? "Verification link expired"
              : isError
                ? "Could not verify email"
                : "Check your email"}
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-[#475569] sm:text-base">
            {isInvalid ? (
              "That verification link is invalid, expired, or has already been used."
            ) : isError ? (
              "Something went wrong while verifying your email."
            ) : initialSendFailed ? (
              <>
                Your account was created, but we could not send the verification
                email to <strong>{email || "your email address"}</strong>.
              </>
            ) : (
              <>
                We sent a verification link to{" "}
                <strong>{email || "your email address"}</strong>.
              </>
            )}
          </p>
        </header>

        <section className="rounded-[28px] border border-[#cbd5e1] bg-white p-5 shadow-sm sm:p-7">
          {!isInvalid && !isError ? (
            initialSendFailed ? (
              <p className="text-sm leading-6 text-[#475569] sm:text-base">
                Click the button below to try sending the verification email
                again.
              </p>
            ) : (
              <>
                <p className="text-sm leading-6 text-[#475569] sm:text-base">
                  Click the verification link in the email to activate your
                  RentFray manager account. The link expires in 24 hours.
                </p>

                <p className="mt-4 text-sm leading-6 text-[#64748b]">
                  If you do not see the email, check your spam or junk folder.
                </p>
              </>
            )
          ) : (
            <p className="text-sm leading-6 text-[#475569] sm:text-base">
              You can request a fresh verification link below.
            </p>
          )}

       {isInvalid || isError ? (
  <label className="mt-5 block">
    <span className="mb-2 block text-sm font-semibold text-[#1e293b]">
      Email
    </span>

    <input
      type="email"
      value={resendEmail}
      autoComplete="email"
      onChange={(event) => setResendEmail(event.target.value)}
      placeholder="you@example.com"
      className="w-full rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-base text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#233143] focus:ring-4 focus:ring-[#233143]/10"
    />
  </label>
) : null}

          {message ? (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              {message}
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          ) : null}

          {resendEmail ? (
            <button
              type="button"
              onClick={resendVerification}
              disabled={sending}
              className="mt-6 w-full rounded-2xl bg-[#233143] px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#172234] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Resend Verification Email"}
            </button>
          ) : null}

          <p className="mt-5 text-center text-sm text-[#64748b]">
            Already verified?{" "}
            <a
              href="/manager/login"
              className="font-semibold text-[#233143] underline-offset-4 hover:underline"
            >
              Manager Login
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}