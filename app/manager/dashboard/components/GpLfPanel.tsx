"use client";

import type React from "react";

type LocalTier = {
  id: string;
  tierName: string;
};

type VisibleTier = {
  id: string;
  tierName: string;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeInitial: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
};

type GpLfSettings = {
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeInitial: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
};

type GpLfComparisonSummary = {
  graceDays: string;
  lateFeeStatus: string;
  lateFeeInitial: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
} | null;

type Props = {
  onClose: () => void;
  canEditLateFeeSettings: boolean;
  gpLfTierMode: "all" | "selected";
  setGpLfTierMode: React.Dispatch<
    React.SetStateAction<"all" | "selected">
  >;
  localTiers: LocalTier[];
  gpLfSelectedTierIds: string[];
  toggleGpLfTierSelection: (tierId: string) => void;

  // Retained for compatibility with the current parent component.
  gpLfVisibleTiers: VisibleTier[];
  gpLfComparisonSummary: GpLfComparisonSummary;

  formatGpLfMoney: (value: string) => string;
  gpLfSettings: GpLfSettings;
  updateGpLf: (updates: Partial<GpLfSettings>) => void;
  saveGpLfSettings: () => Promise<void>;
  savingGpLf: boolean;
  gpLfSaveMessage: string;
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
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#173024]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)] shadow-[var(--rf-shadow-lg)] sm:h-[760px] sm:max-h-[90vh] sm:rounded-[32px] motion-safe:animate-[rf-panel-in_180ms_ease-out] will-change-transform">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rf-border)] bg-[rgba(255,255,255,0.28)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--rf-text)]">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--rf-text-soft)]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rf-btn rf-btn-secondary px-3 text-sm"
          >
            Close
          </button>
        </div>

        <div className="rf-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function GpLfPanel({
  onClose,
  canEditLateFeeSettings,
  gpLfTierMode,
  setGpLfTierMode,
  localTiers,
  gpLfSelectedTierIds,
  toggleGpLfTierSelection,
  gpLfComparisonSummary,
  formatGpLfMoney,
  gpLfSettings,
  updateGpLf,
  saveGpLfSettings,
  savingGpLf,
  gpLfSaveMessage,
}: Props) {
  const selectedTierName =
    gpLfTierMode === "selected"
      ? localTiers.find((tier) =>
          gpLfSelectedTierIds.includes(tier.id)
        )?.tierName ?? "Selected tier"
      : "All tiers";

  const graceDays = Math.max(
    0,
    Number.parseInt(gpLfSettings.graceDays || "0", 10) || 0
  );

  const initialLateFee = Math.max(
    0,
    Number(gpLfSettings.lateFeeInitial || 0) || 0
  );

  const dailyLateFee = Math.max(
    0,
    Number(gpLfSettings.lateFeeDaily || 0) || 0
  );

  const maximumDailyFeeDays = Math.max(
    0,
    Number.parseInt(gpLfSettings.lateFeeMaxDays || "0", 10) || 0
  );

  const hasInitialLateFee = initialLateFee > 0;
  const hasDailyLateFee = dailyLateFee > 0;
  const initialLateFeeDay = graceDays + 1;
  const dailyLateFeeStartDay = hasInitialLateFee
    ? initialLateFeeDay + 1
    : initialLateFeeDay;
  const dailyLateFeeEndDay =
    maximumDailyFeeDays > 0
      ? dailyLateFeeStartDay + maximumDailyFeeDays - 1
      : dailyLateFeeStartDay;

  const selectedTierMissing =
    gpLfTierMode === "selected" && gpLfSelectedTierIds.length === 0;

  const rulesVary =
    gpLfTierMode === "all" &&
    gpLfComparisonSummary !== null &&
    Object.values(gpLfComparisonSummary).some((value) => value === "Mixed");

  const maximumDaysRequired =
    gpLfSettings.lateFeeEnabled && hasDailyLateFee;

  const maximumDaysInvalid =
    maximumDaysRequired && maximumDailyFeeDays < 1;

  async function handleSave(): Promise<void> {
    if (selectedTierMissing) {
      window.alert("Select a tier before saving.");
      return;
    }

    if (gpLfSettings.lateFeeEnabled) {
      if (!Number.isInteger(graceDays) || graceDays < 0) {
        window.alert("Grace Period must be 0 or greater.");
        return;
      }

      if (maximumDaysInvalid) {
        window.alert(
          "Maximum Daily Fee Days is required when a Daily Late Fee is entered."
        );
        return;
      }
    }

    await saveGpLfSettings();
  }

  return (
    <OverlayShell
      title="Late Payment Rules"
      subtitle="Configure your grace period and late fee policy."
      onClose={onClose}
    >
      <div className="space-y-5">
        {!canEditLateFeeSettings ? (
          <div className="rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-soft)] px-4 py-3 text-sm text-[var(--rf-text-soft)]">
            View only. Only an owner or manager can change late-payment
            rules.
          </div>
        ) : null}

        <section className="sticky top-0 z-20 rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)]/95 p-4 shadow-[var(--rf-shadow-sm)] backdrop-blur">
          <div>
            <label className="rf-label">Apply settings to</label>

            <select
              value={gpLfTierMode}
              onChange={(event) => {
                const mode = event.target.value as "all" | "selected";
                setGpLfTierMode(mode);

                if (
                  mode === "selected" &&
                  gpLfSelectedTierIds.length === 0 &&
                  localTiers[0]
                ) {
                  toggleGpLfTierSelection(localTiers[0].id);
                }
              }}
              disabled={!canEditLateFeeSettings}
              className="rf-input max-w-xs"
            >
              <option value="all">All tiers</option>
              <option value="selected">Selected tier</option>
            </select>
          </div>

          {gpLfTierMode === "selected" ? (
            <div className="mt-4">
              <div className="rf-label">Choose tier</div>

              <div className="flex flex-wrap gap-2">
                {localTiers.map((tier) => {
                  const isSelected =
                    gpLfSelectedTierIds[0] === tier.id;

                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => toggleGpLfTierSelection(tier.id)}
                      disabled={!canEditLateFeeSettings}
                      className={`rf-btn min-h-[36px] px-3 text-xs ${
                        isSelected
                          ? "rf-btn-primary"
                          : "rf-btn-secondary"
                      }`}
                    >
                      {tier.tierName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-card)] p-4 shadow-[var(--rf-shadow-sm)]">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--rf-text-muted)]">
              Late Payment Rules
            </div>

            <div className="mt-1 text-sm text-[var(--rf-text-soft)]">
              Editing rules for{" "}
              <span className="font-semibold text-[var(--rf-text)]">
                {selectedTierName}
              </span>
              .
            </div>
          </div>

          {selectedTierMissing ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-800">
              Select a tier to edit its late-payment rules.
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--rf-border)] bg-[rgba(255,255,255,0.58)] px-4 py-4">
                <input
                  id="gplf-late-fee-enabled"
                  type="checkbox"
                  checked={gpLfSettings.lateFeeEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;

                    updateGpLf(
                      enabled
                        ? {
                            lateFeeEnabled: true,
                            graceDays:
                              gpLfSettings.graceDays &&
                              gpLfSettings.graceDays !== "0"
                                ? gpLfSettings.graceDays
                                : "5",
                            lateFeeInitial:
                              gpLfSettings.lateFeeInitial === "0"
                                ? ""
                                : gpLfSettings.lateFeeInitial,
                            lateFeeDaily:
                              gpLfSettings.lateFeeDaily === "0"
                                ? ""
                                : gpLfSettings.lateFeeDaily,
                            lateFeeMaxDays:
                              gpLfSettings.lateFeeMaxDays === "0"
                                ? ""
                                : gpLfSettings.lateFeeMaxDays,
                          }
                        : {
                            lateFeeEnabled: false,
                            graceDays: "0",
                            lateFeeInitial: "0",
                            lateFeeDaily: "0",
                            lateFeeMaxDays: "0",
                          }
                    );
                  }}
                  disabled={!canEditLateFeeSettings}
                  className="h-4 w-4 accent-emerald-700"
                />

                <div>
                  <div className="text-sm font-semibold text-[var(--rf-text)]">
                    Charge Late Fees
                  </div>

                  <div className="mt-0.5 text-xs text-[var(--rf-text-muted)]">
                    Add a grace period and optional initial and daily late
                    fees.
                  </div>
                </div>
              </label>

              {gpLfSettings.lateFeeEnabled ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="rf-label">
                        Grace Period (Days)
                      </label>

                      <input
                        value={gpLfSettings.graceDays}
                        onChange={(event) =>
                          updateGpLf({
                            graceDays: event.target.value.replace(
                              /\D/g,
                              ""
                            ),
                          })
                        }
                        disabled={!canEditLateFeeSettings}
                        inputMode="numeric"
                        className="rf-input"
                        placeholder="5"
                      />

                      <p className="mt-1 text-xs text-[var(--rf-text-muted)]">
                        Includes the due date.
                      </p>
                    </div>

                    <div>
                      <label className="rf-label">
                        Initial Late Fee
                      </label>

                      <input
                        value={gpLfSettings.lateFeeInitial}
                        onChange={(event) =>
                          updateGpLf({
                            lateFeeInitial:
                              event.target.value.replace(
                                /[^0-9.]/g,
                                ""
                              ),
                          })
                        }
                        disabled={!canEditLateFeeSettings}
                        inputMode="decimal"
                        className="rf-input"
                        placeholder="50.00"
                      />
                    </div>

                    <div>
                      <label className="rf-label">
                        Daily Late Fee
                      </label>

                      <input
                        value={
                          gpLfSettings.lateFeeDaily === "0"
                            ? ""
                            : gpLfSettings.lateFeeDaily
                        }
                        onChange={(event) => {
                          const value = event.target.value.replace(
                            /[^0-9.]/g,
                            ""
                          );

                          updateGpLf({
                            lateFeeDaily: value,
                            ...(Number(value || 0) > 0
                              ? {}
                              : { lateFeeMaxDays: "0" }),
                          });
                        }}
                        disabled={!canEditLateFeeSettings}
                        inputMode="decimal"
                        className="rf-input"
                        placeholder="10.00"
                      />
                    </div>

                    <div>
                      <label className="rf-label">
                        Maximum Daily Fee Days
                        {maximumDaysRequired ? (
                          <span className="text-red-600"> *</span>
                        ) : null}
                      </label>

                      <input
                        value={
                          hasDailyLateFee
                            ? gpLfSettings.lateFeeMaxDays
                            : ""
                        }
                        onChange={(event) =>
                          updateGpLf({
                            lateFeeMaxDays:
                              event.target.value.replace(/\D/g, ""),
                          })
                        }
                        disabled={
                          !canEditLateFeeSettings || !hasDailyLateFee
                        }
                        inputMode="numeric"
                        min={1}
                        aria-required={maximumDaysRequired}
                        aria-invalid={maximumDaysInvalid}
                        className={`rf-input ${
                          maximumDaysInvalid
                            ? "border-red-400 focus:border-red-500"
                            : ""
                        }`}
                        placeholder={
                          hasDailyLateFee
                            ? "5"
                            : "Enter a daily fee first"
                        }
                      />

                      {!hasDailyLateFee ? (
                        <p className="mt-1 text-xs text-[var(--rf-text-muted)]">
                          Required only when a daily late fee is used.
                        </p>
                      ) : maximumDaysInvalid ? (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          Enter at least 1 day.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">
                      Late-Payment Timeline
                    </div>

                    <div className="mt-2 text-sm font-semibold text-emerald-950">
                      {selectedTierName}
                    </div>

                    {rulesVary ? (
                      <div className="mt-3 space-y-2 text-sm leading-6 text-emerald-900">
                        <p>
                          <strong>Late-payment rules vary by tier.</strong>
                        </p>
                        <p>
                          Grace period, initial late fee, daily late fee, and maximum daily fee days may be different for each tier.
                        </p>
                        <p>
                          Select an individual tier above to review or change its current rules. Saving while All tiers is selected will apply the displayed values to every tier.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2 text-sm leading-6 text-emerald-900">
                        <p>
                          Grace period:{" "}
                          <strong>
                            {graceDays} day
                            {graceDays === 1 ? "" : "s"}
                          </strong>
                          , including the due date.
                        </p>

                        {hasInitialLateFee ? (
                          <p>
                            Initial late fee:{" "}
                            <strong>
                              {formatGpLfMoney(
                                gpLfSettings.lateFeeInitial || "0"
                              )}
                            </strong>{" "}
                            on day <strong>{initialLateFeeDay}</strong>.
                          </p>
                        ) : hasDailyLateFee ? (
                          <p>No initial late fee.</p>
                        ) : null}

                        {hasDailyLateFee && maximumDailyFeeDays > 0 ? (
                          <p>
                            Daily late fee:{" "}
                            <strong>
                              {formatGpLfMoney(
                                gpLfSettings.lateFeeDaily || "0"
                              )}{" "}
                              per day
                            </strong>{" "}
                            from day <strong>{dailyLateFeeStartDay}</strong>{" "}
                            through day <strong>{dailyLateFeeEndDay}</strong>.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                  No late fees will be charged.
                </div>
              )}
            </>
          )}
        </section>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              !canEditLateFeeSettings ||
              savingGpLf ||
              selectedTierMissing
            }
            className={`inline-flex min-h-11 min-w-[140px] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${
              gpLfSaveMessage === "Saved!"
                ? "bg-emerald-700"
                : "bg-[#173024] hover:bg-[#10241b]"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {savingGpLf
              ? "Saving..."
              : gpLfSaveMessage === "Saved!"
                ? "Saved!"
                : "Save"}
          </button>
        </div>
      </div>
    </OverlayShell>
  );
}