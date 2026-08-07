"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type RentTierDraft = {
  id: string;
  tierName: string;
  unitCount: string;
  activeUnitCount: number;
  availableUnitCount: number;
  isNew?: boolean;
  markedForDelete?: boolean;
  baseRent: string;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: string;
  lateFeeDaily: string;
  lateFeeMaxDays: string;
};

type AdditionalChargeDraft = {
  id: string;
  label: string;
  amount: string;
};

type TierChargesDraft = {
  tierId: string;
  tierName: string;
  charges: AdditionalChargeDraft[];
};

type Props = {
  onClose: () => void;
  canEditRentSettings: boolean;
  localTiers: RentTierDraft[];
  editingTierId: string | null;
  setEditingTierId: Dispatch<SetStateAction<string | null>>;
  updateLocalTier: (
    tierId: string,
    updates: Partial<RentTierDraft>
  ) => void;
  addLocalTier: () => void;
  removeLocalTier: (tierId: string) => void;
  saveLocalRentSettings: () => Promise<void>;
  tierCharges: TierChargesDraft[];
  chargesLoading: boolean;
  chargesError: string;
  savingCharges: boolean;
  updateTierCharge: (
    tierId: string,
    chargeId: string,
    updates: Partial<AdditionalChargeDraft>
  ) => void;
  addTierCharge: (tierId: string) => void;
  removeTierCharge: (tierId: string, chargeId: string) => void;
  saveTierCharges: () => Promise<void>;
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
  children: ReactNode;
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

        <div className="rf-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function RentPanel({
  onClose,
  canEditRentSettings,
  localTiers,
  updateLocalTier,
  addLocalTier,
  removeLocalTier,
  saveLocalRentSettings,
  tierCharges,
  chargesLoading,
  chargesError,
  savingCharges,
  updateTierCharge,
  addTierCharge,
  removeTierCharge,
}: Props) {
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [sameForAllTiers, setSameForAllTiers] = useState<boolean | null>(
    null
  );

  const sameForAllInitializedRef = useRef(false);

  const activeTiers = useMemo(
    () => localTiers.filter((tier) => !tier.markedForDelete),
    [localTiers]
  );

  const visibleTierCharges = useMemo<TierChargesDraft[]>(
    () =>
      activeTiers.map((tier) => {
        const savedTier = tierCharges.find(
          (chargeTier) => chargeTier.tierId === tier.id
        );

        return {
          tierId: tier.id,
          tierName: tier.tierName.trim() || "Untitled Tier",
          charges: savedTier?.charges ?? [],
        };
      }),
    [activeTiers, tierCharges]
  );

  useEffect(() => {
    if (
      sameForAllInitializedRef.current ||
      chargesLoading ||
      activeTiers.length === 0
    ) {
      return;
    }

    const everyTierHasLoadedCharges = activeTiers.every((tier) =>
      tierCharges.some((chargeTier) => chargeTier.tierId === tier.id)
    );

    if (!everyTierHasLoadedCharges) {
      return;
    }

    const normalizeCharges = (
      charges: AdditionalChargeDraft[]
    ): Array<{ label: string; amount: string }> =>
      charges
        .filter(
          (charge) =>
            charge.label.trim() !== "" || charge.amount.trim() !== ""
        )
        .map((charge) => ({
          label: charge.label.trim(),
          amount: charge.amount.trim(),
        }));

    const firstTierCharges = JSON.stringify(
      normalizeCharges(visibleTierCharges[0]?.charges ?? [])
    );

    const everyTierMatches = visibleTierCharges.every(
      (tier) =>
        JSON.stringify(normalizeCharges(tier.charges)) ===
        firstTierCharges
    );

    sameForAllInitializedRef.current = true;
    setSameForAllTiers(everyTierMatches);
  }, [
    activeTiers,
    chargesLoading,
    tierCharges,
    visibleTierCharges,
  ]);

  function updateCharge(
    tierId: string,
    chargeId: string,
    chargeIndex: number,
    updates: Partial<AdditionalChargeDraft>
  ): void {
    if (!sameForAllTiers) {
      updateTierCharge(tierId, chargeId, updates);
      return;
    }

    for (const tier of visibleTierCharges) {
      const targetCharge = tier.charges[chargeIndex];

      if (targetCharge) {
        updateTierCharge(tier.tierId, targetCharge.id, updates);
      }
    }
  }

  function addCharge(tierId: string): void {
    if (!sameForAllTiers) {
      addTierCharge(tierId);
      return;
    }

    for (const tier of visibleTierCharges) {
      addTierCharge(tier.tierId);
    }
  }

  function removeCharge(tierId: string, chargeIndex: number): void {
    if (!sameForAllTiers) {
      const targetTier = visibleTierCharges.find(
        (tier) => tier.tierId === tierId
      );
      const targetCharge = targetTier?.charges[chargeIndex];

      if (targetCharge) {
        removeTierCharge(tierId, targetCharge.id);
      }

      return;
    }

    for (const tier of visibleTierCharges) {
      const targetCharge = tier.charges[chargeIndex];

      if (targetCharge) {
        removeTierCharge(tier.tierId, targetCharge.id);
      }
    }
  }

  function validateForm(): string | null {
    if (activeTiers.length === 0) {
      return "Add at least one tier.";
    }

    const invalidTier = activeTiers.find((tier) => {
      const tierName = tier.tierName.trim();
      const baseRent = Number(tier.baseRent);
      const unitCount = Number(tier.unitCount);

      return (
        !tierName ||
        !Number.isFinite(baseRent) ||
        baseRent <= 0 ||
        !Number.isInteger(unitCount) ||
        unitCount <= 0
      );
    });

    if (invalidTier) {
      return "Each tier requires a name, base rent greater than $0, and a unit count greater than 0.";
    }

    const chargeGroups =
      sameForAllTiers === false
        ? visibleTierCharges
        : visibleTierCharges.slice(0, 1);

    for (const tier of chargeGroups) {
      for (const charge of tier.charges) {
        const label = charge.label.trim();
        const amountText = charge.amount.trim();
        const hasAnyValue = Boolean(label || amountText);

        if (!hasAnyValue) {
          continue;
        }

        const amount = Number(amountText);

        if (
          !label ||
          !amountText ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return `Complete both the charge name and amount for ${tier.tierName}, or leave both fields blank.`;
        }
      }
    }

    return null;
  }

  async function handleSave(): Promise<void> {
    if (saveState === "saving" || savingCharges) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      window.alert(validationError);
      return;
    }

    try {
      setSaveState("saving");
      await saveLocalRentSettings();
      setSaveState("saved");

      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch (error) {
      console.error("Failed to save units and pricing:", error);
      setSaveState("error");

      window.setTimeout(() => {
        setSaveState("idle");
      }, 2500);
    }
  }

  return (
    <OverlayShell
      title="Units & Pricing"
      subtitle="Set each tier's monthly price, unit count, and optional recurring charges."
      onClose={onClose}
    >
      <div className="space-y-4">
        {!canEditRentSettings ? (
          <div className="rounded-[20px] border border-[var(--rf-border)] bg-[var(--rf-bg-soft)] px-4 py-3 text-sm text-[var(--rf-text-soft)]">
            View only. Only an owner or manager can change pricing.
          </div>
        ) : null}

        {chargesLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Loading recurring charges...
          </div>
        ) : (
          <section className="space-y-3">
            {activeTiers.map((tier, index) => {
              const chargeBlock = visibleTierCharges.find(
                (item) => item.tierId === tier.id
              );

              return (
                <div
                  key={tier.id}
                  className="overflow-hidden rounded-[22px] border border-[var(--rf-border)] bg-[var(--rf-bg-card)] shadow-[var(--rf-shadow-sm)]"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--rf-border)] bg-gradient-to-r from-emerald-50/70 via-white to-white px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--rf-text)]">
                        {tier.tierName.trim() || `Tier ${index + 1}`}
                      </div>
                    </div>

                    {activeTiers.length > 1 ? (
                      <button
                        type="button"
                        disabled={!canEditRentSettings}
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Remove ${tier.tierName.trim() || "this tier"}?`
                          );

                          if (confirmed) {
                            removeLocalTier(tier.id);
                          }
                        }}
                        className="shrink-0 text-xs font-semibold text-red-600 transition hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove Tier
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rf-text-muted)]">
                        Tier Details
                      </div>

                      <div>
                        <label className="rf-label">
                          Tier Label <span className="text-red-600">*</span>
                        </label>
                        <input
                          value={tier.tierName}
                          disabled={!canEditRentSettings}
                          onChange={(event) =>
                            updateLocalTier(tier.id, {
                              tierName: event.target.value,
                            })
                          }
                          placeholder="One Bedroom"
                          className="rf-input"
                        />
                      </div>

                      <div>
                        <label className="rf-label">
                          Base Price <span className="text-red-600">*</span>
                        </label>
                        <div className="flex">
                          <span className="inline-flex min-w-9 items-center justify-center rounded-l-xl border border-r-0 border-[var(--rf-border)] bg-white text-sm font-semibold text-[var(--rf-text-muted)]">
                            $
                          </span>
                          <input
                            value={tier.baseRent}
                            disabled={!canEditRentSettings}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateLocalTier(tier.id, {
                                baseRent: event.target.value.replace(
                                  /[^0-9.]/g,
                                  ""
                                ),
                              })
                            }
                            placeholder="950.00"
                            className="rf-input rounded-l-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="rf-label">
                          Unit Count <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tier.unitCount === "0" ? "" : tier.unitCount}
                          disabled={!canEditRentSettings}
                          onChange={(event) =>
                            updateLocalTier(tier.id, {
                              unitCount: event.target.value.replace(/\D/g, ""),
                            })
                          }
                          placeholder="10"
                          aria-required="true"
                          className="rf-input"
                        />
                        <p className="mt-1 text-[11px] leading-4 text-[var(--rf-text-muted)]">
                          Maximum tenant activations.
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 lg:ml-5">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rf-text-muted)]">
                            Recurring Charges
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--rf-text-soft)]">
                            Optional monthly charges for this tier.
                          </div>
                        </div>

                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--rf-border)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--rf-text)]">
                          <input
                            type="checkbox"
                            checked={sameForAllTiers === true}
                            disabled={
                              !canEditRentSettings || sameForAllTiers === null
                            }
                            onChange={(event) => {
                              setSameForAllTiers(event.target.checked);
                            }}
                            className="h-3.5 w-3.5 accent-emerald-700"
                          />
                          Same for all tiers
                        </label>
                      </div>

                      {chargeBlock?.charges.length ? (
                        <div className="space-y-2">
                          {chargeBlock.charges.map((charge, chargeIndex) => (
                            <div
                              key={charge.id}
                              className="grid grid-cols-[minmax(180px,240px)_92px_auto] items-center gap-2"
                            >
                              <input
                                value={charge.label}
                                disabled={!canEditRentSettings}
                                onChange={(event) =>
                                  updateCharge(
                                    tier.id,
                                    charge.id,
                                    chargeIndex,
                                    {
                                      label: event.target.value,
                                    }
                                  )
                                }
                                placeholder="Water"
                                className="rf-input min-w-0"
                                aria-label={`Charge name for ${tier.tierName}`}
                              />

                              <div className="flex">
                                <span className="inline-flex min-w-7 items-center justify-center rounded-l-xl border border-r-0 border-[var(--rf-border)] bg-slate-50 text-xs font-semibold text-[var(--rf-text-muted)]">
                                  $
                                </span>
                                <input
                                  value={charge.amount}
                                  disabled={!canEditRentSettings}
                                  inputMode="decimal"
                                  onChange={(event) =>
                                    updateCharge(
                                      tier.id,
                                      charge.id,
                                      chargeIndex,
                                      {
                                        amount: event.target.value.replace(
                                          /[^0-9.]/g,
                                          ""
                                        ),
                                      }
                                    )
                                  }
                                  placeholder="50"
                                  className="rf-input min-w-0 rounded-l-none"
                                  aria-label={`Monthly amount for ${charge.label || "charge"}`}
                                />
                              </div>

                              <button
                                type="button"
                                disabled={!canEditRentSettings}
                                onClick={() =>
                                  removeCharge(tier.id, chargeIndex)
                                }
                                className="px-1 text-xs font-semibold text-red-600 transition hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                          No recurring charges.
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canEditRentSettings}
                        onClick={() => addCharge(tier.id)}
                        className="mt-2 text-xs font-semibold text-emerald-800 transition hover:text-emerald-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Add charge
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {chargesError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {chargesError}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 border-t border-slate-200 bg-[var(--rf-bg-panel)]/95 px-1 pt-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addLocalTier}
            disabled={!canEditRentSettings}
            className="rf-btn rf-btn-secondary px-4"
          >
            + Add Tier
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              !canEditRentSettings ||
              saveState === "saving" ||
              savingCharges
            }
            className={`inline-flex min-h-11 min-w-[160px] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${
              saveState === "saved"
                ? "bg-emerald-700"
                : saveState === "error"
                  ? "bg-red-700"
                  : "bg-[#173024] hover:bg-[#10241b]"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {saveState === "saving" || savingCharges
              ? "Saving Everything..."
              : saveState === "saved"
                ? "Saved!"
                : saveState === "error"
                  ? "Save Failed"
                  : "Save"}
          </button>
        </div>
      </div>
    </OverlayShell>
  );
}