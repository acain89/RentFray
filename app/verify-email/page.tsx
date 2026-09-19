"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type ResendResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error?: string;
    };

function VerifyEmailContent() {
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
            : "Could not resend your account email."
        );
        return;
      }

      setMessage(
        "If an account is waiting for activation at that email address, we sent a new email."
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

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
            {isInvalid
              ? "Your activation link expired"
              : isError
                ? "We couldn't activate your account"
                : initialSendFailed
                  ? "Your account was created"
                  : "Check your email for your Property Code"}
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-[#475569] sm:text-base">
            {isInvalid ? (
              "That activation link is invalid, expired, or has already been used."
            ) : isError ? (
              "Something went wrong while activating your account."
            ) : initialSendFailed ? (
              <>
                We couldn&apos;t send your Property Code and activation link to{" "}
                <strong>{email || "your email address"}</strong>. You can try
                again below.
              </>
            ) : (
              <>
                We sent your <strong>Property Code</strong> and activation link
                to <strong>{email || "your email address"}</strong>.
              </>
            )}
          </p>
        </header>

        <section className="rounded-[28px] border border-[#cbd5e1] bg-white p-5 shadow-sm sm:p-7">
          {!isInvalid && !isError && !initialSendFailed ? (
            <>
              <p className="text-sm leading-6 text-[#475569] sm:text-base">
                Open the email and click{" "}
                <strong className="text-[#0f172a]">Activate My Account</strong>{" "}
                to continue. You&apos;ll be taken straight back to RentFray.
              </p>

              <div className="mt-6 rounded-2xl border border-[#dbe3ea] bg-[#f8fafc] p-5">
                <div className="text-sm font-semibold text-[#0f172a]">
                  Your setup progress
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#233143] text-sm font-bold text-white">
                      ✓
                    </div>
                    <div className="pt-0.5">
                      <div className="font-semibold text-[#0f172a]">
                        Create your account
                      </div>
                      <div className="text-sm text-[#64748b]">Complete</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#233143] bg-white text-sm font-bold text-[#233143]">
                      2
                    </div>
                    <div className="pt-0.5">
                      <div className="font-semibold text-[#0f172a]">
                        Activate your account
                      </div>
                      <div className="text-sm font-medium text-[#233143]">
                        Check your email
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-sm font-semibold text-[#64748b]">
                      3
                    </div>
                    <div className="pt-0.5 text-[#475569]">
                      Add your property &amp; rent rules
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-sm font-semibold text-[#64748b]">
                      4
                    </div>
                    <div className="pt-0.5 text-[#475569]">
                      Connect your bank
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-sm font-semibold text-[#64748b]">
                      5
                    </div>
                    <div className="pt-0.5 text-[#475569]">
                      Start collecting rent
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#eef3f7] px-4 py-3 text-center text-sm font-semibold text-[#334155]">
                Most properties can be ready in about 10 minutes.
              </div>

              <p className="mt-5 text-center text-sm text-[#64748b]">
                Don&apos;t see the email? Check your spam or junk folder.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-[#475569] sm:text-base">
                {initialSendFailed
                  ? "Use the button below to send your Property Code and activation link again."
                  : "Enter your email address below and we'll send you a fresh activation link."}
              </p>

              {(isInvalid || isError) && (
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
              )}
            </>
          )}

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
           className="mx-auto mt-5 block text-sm font-semibold text-[#475569] underline decoration-[#94a3b8] underline-offset-4 transition hover:text-[#                0f172a] disabled:cursor-not-allowed disabled:opacity-60"
           >
         {sending ? "Sending..." : "Resend email"}
          </button>
          ) : null}

          <p className="mt-5 text-center text-sm text-[#64748b]">
            Already activated?{" "}
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#dfe7ee] px-4 py-8 text-[#0f172a] sm:px-6 sm:py-12">
          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-[28px] border border-[#cbd5e1] bg-white p-5 shadow-sm sm:p-7">
              <p className="text-sm text-[#64748b]">
                Loading your account...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}