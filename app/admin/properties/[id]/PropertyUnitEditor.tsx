"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type UnitRow = {
  id: string;
  unitNumber: string;
  baseRent: number | null;
  recurringFees: number | null;
  isActive: boolean;
};

type TierRow = {
  id: string;
  name: string;
  units: UnitRow[];
};

type PropertyUnitEditorProps = {
  propertyId: string;
  tiers: TierRow[];
};

type UnitApiResponse = {
  ok?: boolean;
  error?: string;
  unit?: {
    id: string;
    propertyId: string;
    tierId: string;
    unitNumber: string;
    unitType: string;
    baseRent: number;
    recurringFees: number;
    isActive: boolean;
  };
  deleted?: {
    unitId: string;
    tierId: string;
    unitCount: number;
  };
};

function sanitizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}

function sanitizeUnitNumber(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").slice(0, 20);
}

export default function PropertyUnitEditor({
  propertyId,
  tiers,
}: PropertyUnitEditorProps) {
  const [newUnitByTier, setNewUnitByTier] = useState<
    Record<string, { unitNumber: string; baseRent: string }>
  >(() =>
    Object.fromEntries(
      tiers.map((tier) => [
        tier.id,
        {
          unitNumber: "",
          baseRent: tier.units[0]
            ? String(Number(tier.units[0].baseRent || 0))
            : "0",
        },
      ])
    )
  );

  const [unitEdits, setUnitEdits] = useState<
    Record<string, { unitNumber: string; baseRent: string }>
  >(() =>
    Object.fromEntries(
      tiers.flatMap((tier) =>
        tier.units.map((unit) => [
          unit.id,
          {
            unitNumber: unit.unitNumber,
            baseRent: String(Number(unit.baseRent || 0)),
          },
        ])
      )
    )
  );

  const [savingKey, setSavingKey] = useState("");
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [successByKey, setSuccessByKey] = useState<Record<string, string>>({});

  const tierNameById = useMemo(
    () => Object.fromEntries(tiers.map((tier) => [tier.id, tier.name])),
    [tiers]
  );

  function setMessage(key: string, kind: "error" | "success", message: string) {
    if (kind === "error") {
      setErrorByKey((prev) => ({ ...prev, [key]: message }));
      setSuccessByKey((prev) => ({ ...prev, [key]: "" }));
    } else {
      setSuccessByKey((prev) => ({ ...prev, [key]: message }));
      setErrorByKey((prev) => ({ ...prev, [key]: "" }));
    }
  }

  function clearMessage(key: string) {
    setErrorByKey((prev) => ({ ...prev, [key]: "" }));
    setSuccessByKey((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleAddUnit(tierId: string) {
    const key = `add-${tierId}`;
    const draft = newUnitByTier[tierId] || { unitNumber: "", baseRent: "0" };
    const unitNumber = sanitizeUnitNumber(draft.unitNumber);
    const baseRent = Number(draft.baseRent || 0);

    clearMessage(key);

    if (!unitNumber) {
      setMessage(key, "error", "Unit number is required.");
      return;
    }

    if (!Number.isFinite(baseRent) || baseRent < 0) {
      setMessage(key, "error", "Base rent must be 0 or greater.");
      return;
    }

    setSavingKey(key);

    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/units`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tierId,
          unitNumber,
          baseRent,
        }),
      });

      const result: UnitApiResponse = await res.json();

      if (!res.ok) {
        setMessage(key, "error", result.error || "Failed to add unit.");
        setSavingKey("");
        return;
      }

      setMessage(key, "success", "Unit added. Refresh page to see it.");
      setNewUnitByTier((prev) => ({
        ...prev,
        [tierId]: {
          ...prev[tierId],
          unitNumber: "",
        },
      }));
    } catch {
      setMessage(key, "error", "Network error.");
    }

    setSavingKey("");
  }

  async function handleSaveUnit(unitId: string) {
    const key = `unit-${unitId}`;
    const draft = unitEdits[unitId];

    if (!draft) return;

    const unitNumber = sanitizeUnitNumber(draft.unitNumber);
    const baseRent = Number(draft.baseRent || 0);

    clearMessage(key);

    if (!unitNumber) {
      setMessage(key, "error", "Unit number is required.");
      return;
    }

    if (!Number.isFinite(baseRent) || baseRent < 0) {
      setMessage(key, "error", "Base rent must be 0 or greater.");
      return;
    }

    setSavingKey(key);

    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/units`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitId,
          unitNumber,
          baseRent,
        }),
      });

      const result: UnitApiResponse = await res.json();

      if (!res.ok) {
        setMessage(key, "error", result.error || "Failed to update unit.");
        setSavingKey("");
        return;
      }

      setMessage(key, "success", "Unit updated. Refresh page to confirm.");
    } catch {
      setMessage(key, "error", "Network error.");
    }

    setSavingKey("");
  }

  async function handleDeleteUnit(unitId: string) {
    const key = `unit-${unitId}`;

    clearMessage(key);
    setSavingKey(key);

    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/units`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitId,
        }),
      });

      const result: UnitApiResponse = await res.json();

      if (!res.ok) {
        setMessage(key, "error", result.error || "Failed to delete unit.");
        setSavingKey("");
        return;
      }

      setMessage(key, "success", "Unit deleted. Refresh page to confirm.");
    } catch {
      setMessage(key, "error", "Network error.");
    }

    setSavingKey("");
  }

  if (tiers.length === 0) {
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>Edit units</h2>
            <p className={styles.sectionSubtitle}>
              No tiers found for this property.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>Edit units</h2>
          <p className={styles.sectionSubtitle}>
            Add, update, or remove units. These changes affect the live property
            account and the related manager and tenant views.
          </p>
        </div>
      </div>

      <div className={styles.tierList}>
        {tiers.map((tier) => {
          const addKey = `add-${tier.id}`;
          const newDraft = newUnitByTier[tier.id] || {
            unitNumber: "",
            baseRent: "0",
          };

          return (
            <div key={tier.id} className={styles.tierCard}>
              <div className={styles.tierHead}>
                <div>
                  <h3 className={styles.tierTitle}>{tier.name}</h3>
                  <p className={styles.tierSubtitle}>
                    {tier.units.length} units in this tier
                  </p>
                </div>

                <div className={styles.tierStats}>
                  <span>{tier.units.length} units</span>
                  <span>{tierNameById[tier.id]}</span>
                </div>
              </div>

              <div className={styles.editorGrid}>
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>New Unit Number</label>
                  <input
                    className={styles.editorInput}
                    value={newDraft.unitNumber}
                    onChange={(e) =>
                      setNewUnitByTier((prev) => ({
                        ...prev,
                        [tier.id]: {
                          ...prev[tier.id],
                          unitNumber: sanitizeUnitNumber(e.target.value),
                        },
                      }))
                    }
                    placeholder="101"
                  />
                </div>

                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>New Unit Base Rent</label>
                  <input
                    className={styles.editorInput}
                    value={newDraft.baseRent}
                    onChange={(e) =>
                      setNewUnitByTier((prev) => ({
                        ...prev,
                        [tier.id]: {
                          ...prev[tier.id],
                          baseRent: sanitizeMoneyInput(e.target.value),
                        },
                      }))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {errorByKey[addKey] ? (
                <div className={styles.editorError}>{errorByKey[addKey]}</div>
              ) : null}

              {successByKey[addKey] ? (
                <div className={styles.editorSuccess}>{successByKey[addKey]}</div>
              ) : null}

              <div className={styles.editorActions}>
                <button
                  type="button"
                  onClick={() => void handleAddUnit(tier.id)}
                  disabled={savingKey === addKey}
                  className={styles.primaryButton}
                >
                  {savingKey === addKey ? "Adding..." : "Add Unit"}
                </button>
              </div>

              <div className={styles.unitGrid}>
                {tier.units.length === 0 ? (
                  <div className={styles.emptyUnitCard}>
                    No units in this tier yet.
                  </div>
                ) : (
                  tier.units.map((unit) => {
                    const unitKey = `unit-${unit.id}`;
                    const draft = unitEdits[unit.id] || {
                      unitNumber: unit.unitNumber,
                      baseRent: String(Number(unit.baseRent || 0)),
                    };

                    return (
                      <div key={unit.id} className={styles.unitCard}>
                        <div className={styles.editorField}>
                          <label className={styles.editorLabel}>Unit Number</label>
                          <input
                            className={styles.editorInput}
                            value={draft.unitNumber}
                            onChange={(e) =>
                              setUnitEdits((prev) => ({
                                ...prev,
                                [unit.id]: {
                                  ...prev[unit.id],
                                  unitNumber: sanitizeUnitNumber(e.target.value),
                                },
                              }))
                            }
                            placeholder="101"
                          />
                        </div>

                        <div className={styles.editorField}>
                          <label className={styles.editorLabel}>Base Rent</label>
                          <input
                            className={styles.editorInput}
                            value={draft.baseRent}
                            onChange={(e) =>
                              setUnitEdits((prev) => ({
                                ...prev,
                                [unit.id]: {
                                  ...prev[unit.id],
                                  baseRent: sanitizeMoneyInput(e.target.value),
                                },
                              }))
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </div>

                        <p className={styles.unitFee}>
                          Current add-ons: ${Number(unit.recurringFees || 0).toFixed(2)}
                        </p>

                        {errorByKey[unitKey] ? (
                          <div className={styles.editorError}>
                            {errorByKey[unitKey]}
                          </div>
                        ) : null}

                        {successByKey[unitKey] ? (
                          <div className={styles.editorSuccess}>
                            {successByKey[unitKey]}
                          </div>
                        ) : null}

                        <div className={styles.unitActionRow}>
                          <button
                            type="button"
                            onClick={() => void handleSaveUnit(unit.id)}
                            disabled={savingKey === unitKey}
                            className={styles.primaryButton}
                          >
                            {savingKey === unitKey ? "Saving..." : "Save Unit"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteUnit(unit.id)}
                            disabled={savingKey === unitKey}
                            className={styles.dangerButton}
                          >
                            {savingKey === unitKey ? "Working..." : "Delete Unit"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}