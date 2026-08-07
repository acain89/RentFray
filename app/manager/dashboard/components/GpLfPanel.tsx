"use client";

import type React from "react";

type LocalTier = {
  id: string;
  tierName: string;
};

type GpLfSettings = {
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeInitial: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
};

type Props = {
  onClose: () => void;
  canEditLateFeeSettings: boolean;
  localTiers: LocalTier[];
  activeGpLfTierId: string;
  selectGpLfTier: (tierId: string) => void;
  gpLfSettings: GpLfSettings;
  updateGpLf: (updates: Partial<GpLfSettings>) => void;
  applyGpLfToAllTiers: () => void;
  saveGpLfSettings: () => Promise<void>;
  savingGpLf: boolean;
  gpLfSaveMessage: string;
  configuredGpLfTierIds: string[];
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

function isValidSettings(settings: GpLfSettings): boolean {
  if (!settings.lateFeeEnabled) {
    return true;
  }

  const graceDays = Number.parseInt(settings.graceDays || "", 10);
  if (!Number.isInteger(graceDays) || graceDays < 0) {
    return false;
  }

  const dailyLateFee = Number(settings.lateFeeDaily || 0);
  if (dailyLateFee <= 0) {
    return true;
  }

  const maxDays = Number.parseInt(settings.lateFeeMaxDays || "", 10);
  return Number.isInteger(maxDays) && maxDays >= 1;
}

export default function GpLfPanel({
  onClose,
  canEditLateFeeSettings,
  localTiers,
  activeGpLfTierId,
  selectGpLfTier,
  gpLfSettings,
  updateGpLf,
  applyGpLfToAllTiers,
  saveGpLfSettings,
  savingGpLf,
  gpLfSaveMessage,
  configuredGpLfTierIds,
}: Props) {
  const activeTier =
    localTiers.find((tier) => tier.id === activeGpLfTierId) ?? localTiers[0];

  const dailyLateFee = Number(gpLfSettings.lateFeeDaily || 0);
  const maximumDailyFeeDays = Number.parseInt(
    gpLfSettings.lateFeeMaxDays || "",
    10
  );
  const maximumDaysRequired =
    gpLfSettings.lateFeeEnabled && dailyLateFee > 0;
  const activeTierValid = isValidSettings(gpLfSettings);

  const allTiersConfigured =
    localTiers.length > 0 &&
    localTiers.every((tier) => configuredGpLfTierIds.includes(tier.id));

  return (
    <OverlayShell
      title="Late Payment Rules"
      subtitle="Set the grace period and late-fee policy for each tier."
      onClose={onClose}
    >
      <div className="space-y-5">
        {!canEditLateFeeSettings ? (
          <div className="rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-soft)] px-4 py-3 text-sm text-[var(--rf-text-soft)]">
            View only. Only an owner or manager can change late-payment rules.
          </div>
        ) : null}

        <section className="sticky top-0 z-20 rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-panel)]/95 p-4 shadow-[var(--rf-shadow-sm)] backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--rf-text-muted)]">
            Choose Tier
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {localTiers.map((tier) => {
              const isActive = tier.id === activeTier?.id;
              const isConfigured = configuredGpLfTierIds.includes(tier.id);

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => selectGpLfTier(tier.id)}
                  disabled={!canEditLateFeeSettings}
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                    isActive
                      ? "border-[#173024] bg-[#173024] text-white"
                      : "border-[var(--rf-border)] bg-white text-[var(--rf-text)] hover:border-emerald-300"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span>{tier.tierName}</span>
                  <span
                    className={`text-xs ${
                      isActive
                        ? "text-emerald-100"
                        : isConfigured
                          ? "text-emerald-700"
                          : "text-slate-400"
                    }`}
                  >
                    {isConfigured ? "✓" : "•"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {activeTier ? (
          <section
            key={activeTier.id}
            className="rounded-[24px] border border-[var(--rf-border)] bg-[var(--rf-bg-card)] p-4 shadow-[var(--rf-shadow-sm)] motion-safe:animate-[rf-panel-in_140ms_ease-out]"
          >
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--rf-text-muted)]">
                Editing
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--rf-text)]">
                {activeTier.tierName}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--rf-border)] bg-[rgba(255,255,255,0.58)] px-4 py-4">
              <input
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
                  Add a grace period and optional initial and daily late fees.
                </div>
              </div>
            </label>

            {gpLfSettings.lateFeeEnabled ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="rf-label">
                    Grace Period (Days){" "}
                    <span className="text-red-600">*</span>
                  </label>

                  <input
                    value={gpLfSettings.graceDays}
                    onChange={(event) =>
                      updateGpLf({
                        graceDays: event.target.value.replace(/\D/g, ""),
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
                  <label className="rf-label">Initial Late Fee</label>
                  <input
                    value={
                      gpLfSettings.lateFeeInitial === "0"
                        ? ""
                        : gpLfSettings.lateFeeInitial
                    }
                    onChange={(event) =>
                      updateGpLf({
                        lateFeeInitial: event.target.value.replace(
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
                  <label className="rf-label">Daily Late Fee</label>
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
                      dailyLateFee > 0 ? gpLfSettings.lateFeeMaxDays : ""
                    }
                    onChange={(event) =>
                      updateGpLf({
                        lateFeeMaxDays: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    disabled={!canEditLateFeeSettings || dailyLateFee <= 0}
                    inputMode="numeric"
                    min={1}
                    aria-required={maximumDaysRequired}
                    className="rf-input"
                    placeholder={
                      dailyLateFee > 0 ? "5" : "Enter a daily fee first"
                    }
                  />

                  {maximumDaysRequired &&
                  (!Number.isInteger(maximumDailyFeeDays) ||
                    maximumDailyFeeDays < 1) ? (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      Enter at least 1 day.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                No late fees will be charged for this tier.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--rf-text-muted)]">
                {configuredGpLfTierIds.includes(activeTier.id)
                  ? `${activeTier.tierName} is configured.`
                  : `${activeTier.tierName} still needs to be configured.`}
              </div>

              <button
                type="button"
                onClick={applyGpLfToAllTiers}
                disabled={!canEditLateFeeSettings || !activeTierValid}
                className="rf-btn rf-btn-secondary px-4"
              >
                Apply {activeTier.tierName} Rules to All Tiers
              </button>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--rf-text-muted)]">
            {localTiers.length === 0
              ? "No tiers available."
              : allTiersConfigured
                ? `All ${localTiers.length} tier${localTiers.length === 1 ? "" : "s"} configured.`
                : `${configuredGpLfTierIds.length} of ${localTiers.length} tiers configured.`}
          </div>

          <button
            type="button"
            onClick={() => void saveGpLfSettings()}
            disabled={
              !canEditLateFeeSettings ||
              savingGpLf ||
              !allTiersConfigured ||
              !activeTierValid
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