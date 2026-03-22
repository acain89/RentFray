// app/admin/properties/[id]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";
import PropertyEditor from "./PropertyEditor";
import PropertyTierEditor from "./PropertyTierEditor";
import PropertyUnitEditor from "./PropertyUnitEditor";
import PropertyChargeEditor from "./PropertyChargeEditor";

export const dynamic = "force-dynamic";

type PropertyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatBusinessType(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAssignmentDisplayName(assignment: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) {
  const fullName = `${assignment.firstName ?? ""} ${assignment.lastName ?? ""}`.trim();
  if (fullName) return fullName;
  if (assignment.email?.trim()) return assignment.email.trim();
  return "Occupied";
}

export default async function PropertyDashboard({
  params,
}: PropertyPageProps) {
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      settings: true,
      tiers: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          units: {
            orderBy: { unitNumber: "asc" },
            include: {
              recurringFeeItems: {
                where: { isActive: true },
                orderBy: { displayOrder: "asc" },
              },
              assignments: {
                where: {
                  moveOutDate: null,
                  isCurrent: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!property) {
    return notFound();
  }

  const totalUnits = property.tiers.reduce((sum, tier) => sum + tier.units.length, 0);

  const occupiedUnits = property.tiers.reduce(
    (sum, tier) =>
      sum + tier.units.filter((unit) => unit.assignments.length > 0).length,
    0
  );

  const vacantUnits = totalUnits - occupiedUnits;
  const totalTiers = property.tiers.length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topRow}>
          <Link href="/admin/properties" className={styles.backLink}>
            ← Back to properties
          </Link>

          <div className={styles.topActions}>
            <Link
              href={`/admin/properties/${property.id}/setup`}
              className={styles.primaryButton}
            >
              Edit setup
            </Link>
          </div>
        </div>

        <section className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <div>
              <p className={styles.eyebrow}>Property</p>
              <h1 className={styles.title}>{property.name}</h1>
              <div className={styles.heroMeta}>
                <span>
                  Property Code:
                  <strong className={styles.codeValue}>
                    {property.propertyCode}
                  </strong>
                </span>
                <span>Type: {formatBusinessType(property.propertyType)}</span>
                <span>Address: {property.addressLine1?.trim() || "—"}</span>
                <span>Contact: {property.contactEmail?.trim() || "—"}</span>
              </div>
            </div>

            <div
              className={property.isActive ? styles.activeBadge : styles.inactiveBadge}
            >
              {property.isActive ? "Active" : "Inactive"}
            </div>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Units</p>
            <p className={styles.summaryValue}>{totalUnits}</p>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Occupied</p>
            <p className={styles.summaryValue}>{occupiedUnits}</p>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Vacant</p>
            <p className={styles.summaryValue}>{vacantUnits}</p>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Tiers</p>
            <p className={styles.summaryValue}>{totalTiers}</p>
          </div>
        </section>

        <PropertyEditor
          property={{
            id: property.id,
            name: property.name,
            propertyType: property.propertyType,
            addressLine1: property.addressLine1,
            isActive: property.isActive,
            propertySettings: property.settings
              ? {
                  rentDueDay: property.settings.rentDueDay,
                  gracePeriodDays: property.settings.gracePeriodDays,
                  lateFeeEnabled: property.settings.lateFeeEnabled,
                  lateFeeFlat: property.settings.lateFeeFlat,
                  convenienceFeeEnabled: property.settings.convenienceFeeEnabled,
                  convenienceFeeAmount: property.settings.convenienceFeeAmount,
                }
              : null,
          }}
        />

        <PropertyTierEditor
          propertyId={property.id}
          tiers={property.tiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            baseRent: Number(tier.baseRent || 0),
            processingFee: Number(tier.processingFee || 0),
            rentDueDay: tier.rentDueDay,
            gracePeriodDays: tier.gracePeriodDays,
            lateFeeInitial: Number(tier.lateFeeInitial || 0),
            lateFeeDaily: Number(tier.lateFeeDaily || 0),
            lateFeeMaxDays: tier.maxLateFeeDays,
            units: tier.units.map((unit) => ({
              id: unit.id,
              unitNumber: unit.unitNumber,
            })),
          }))}
        />

        <PropertyUnitEditor
          propertyId={property.id}
          tiers={property.tiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            units: tier.units.map((unit) => ({
              id: unit.id,
              unitNumber: unit.unitNumber,
              baseRent: Number(unit.baseRent || 0),
              recurringFees: Number(unit.recurringFees || 0),
              isActive: unit.isActive,
            })),
          }))}
        />

        <PropertyChargeEditor
          propertyId={property.id}
          tiers={property.tiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            units: tier.units.map((unit) => ({
              id: unit.id,
              unitNumber: unit.unitNumber,
              recurringFees: Number(unit.recurringFees || 0),
              charges: unit.recurringFeeItems.map((charge) => ({
                id: charge.id,
                label: charge.label,
                amount: Number(charge.amount || 0),
                isActive: charge.isActive,
                displayOrder: charge.displayOrder,
              })),
            })),
          }))}
        />

        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Property rules</h2>
              <p className={styles.sectionSubtitle}>
                Current high-level billing and fee settings.
              </p>
            </div>
          </div>

          <div className={styles.rulesGrid}>
            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Rent due day</span>
              <span className={styles.ruleValue}>
                {property.settings?.rentDueDay ?? "—"}
              </span>
            </div>

            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Grace period</span>
              <span className={styles.ruleValue}>
                {property.settings?.gracePeriodDays ?? "—"} days
              </span>
            </div>

            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Late fee enabled</span>
              <span className={styles.ruleValue}>
                {property.settings?.lateFeeEnabled ? "Yes" : "No"}
              </span>
            </div>

            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Flat late fee</span>
              <span className={styles.ruleValue}>
                {formatMoney(Number(property.settings?.lateFeeFlat || 0))}
              </span>
            </div>

            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Convenience fee enabled</span>
              <span className={styles.ruleValue}>
                {property.settings?.convenienceFeeEnabled ? "Yes" : "No"}
              </span>
            </div>

            <div className={styles.ruleItem}>
              <span className={styles.ruleLabel}>Convenience fee amount</span>
              <span className={styles.ruleValue}>
                {formatMoney(Number(property.settings?.convenienceFeeAmount || 0))}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Tiers and units</h2>
              <p className={styles.sectionSubtitle}>
                Review rent, fees, occupancy, and assigned residents by tier.
              </p>
            </div>
          </div>

          <div className={styles.tierList}>
            {property.tiers.length === 0 ? (
              <div className={styles.emptyState}>No tiers found for this property.</div>
            ) : (
              property.tiers.map((tier) => {
                const tierOccupied = tier.units.filter(
                  (unit) => unit.assignments.length > 0
                ).length;

                const tierVacant = tier.units.length - tierOccupied;

                return (
                  <div key={tier.id} className={styles.tierCard}>
                    <div className={styles.tierHead}>
                      <div>
                        <h3 className={styles.tierTitle}>{tier.name}</h3>
                        <p className={styles.tierSubtitle}>
                          {formatMoney(Number(tier.baseRent || 0))} rent ·{" "}
                          {formatMoney(Number(tier.processingFee || 0))} processing fee
                        </p>
                      </div>

                      <div className={styles.tierStats}>
                        <span>{tier.units.length} units</span>
                        <span>{tierOccupied} occupied</span>
                        <span>{tierVacant} vacant</span>
                      </div>
                    </div>

                    <div className={styles.tierRules}>
                      <div className={styles.ruleItem}>
                        <span className={styles.ruleLabel}>Due day</span>
                        <span className={styles.ruleValue}>
                          {tier.rentDueDay ?? "—"}
                        </span>
                      </div>

                      <div className={styles.ruleItem}>
                        <span className={styles.ruleLabel}>Grace period</span>
                        <span className={styles.ruleValue}>
                          {tier.gracePeriodDays ?? "—"} days
                        </span>
                      </div>

                      <div className={styles.ruleItem}>
                        <span className={styles.ruleLabel}>Initial late fee</span>
                        <span className={styles.ruleValue}>
                          {formatMoney(Number(tier.lateFeeInitial || 0))}
                        </span>
                      </div>

                      <div className={styles.ruleItem}>
                        <span className={styles.ruleLabel}>Daily late fee</span>
                        <span className={styles.ruleValue}>
                          {formatMoney(Number(tier.lateFeeDaily || 0))}
                        </span>
                      </div>

                      <div className={styles.ruleItem}>
                        <span className={styles.ruleLabel}>Max daily fee days</span>
                        <span className={styles.ruleValue}>
                          {tier.maxLateFeeDays ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.unitGrid}>
                      {tier.units.length === 0 ? (
                        <div className={styles.emptyUnitCard}>
                          No units in this tier.
                        </div>
                      ) : (
                        tier.units.map((unit) => {
                          const activeAssignment =
                            unit.assignments.length > 0 ? unit.assignments[0] : null;

                          return (
                            <div key={unit.id} className={styles.unitCard}>
                              <div className={styles.unitHeader}>
                                <span className={styles.unitNumber}>
                                  Unit {unit.unitNumber}
                                </span>
                                <span className={styles.unitFee}>
                                  {formatMoney(Number(unit.recurringFees || 0))} add-ons
                                </span>
                              </div>

                              {activeAssignment ? (
                                <p className={styles.unitTenant}>
                                  {getAssignmentDisplayName(activeAssignment)}
                                </p>
                              ) : (
                                <p className={styles.unitVacant}>Vacant</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}