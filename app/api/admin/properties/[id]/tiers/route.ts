import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getLockedMonthlyDueDay } from "@/lib/billingCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TierInput = {
  id?: string;
  tierName: string;
  unitCount: string;
  markedForDelete?: boolean;
  baseRent: string;

  /*
   * Kept temporarily for compatibility with the existing dashboard payload.
   * This route deliberately ignores this value. The client is never allowed
   * to establish or change the monthly due day.
   */
  dueDay?: string;

  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: string;
  lateFeeDaily?: string;
  lateFeeMaxDays?: string;
};

type PostBody = {
  tiers?: TierInput[];
};

type SavedTierResult = {
  clientId: string;
  tierId: string;
  tierName: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function toCents(value: unknown): number {
  return Math.round(toNumber(value, 0) * 100);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (
      !session ||
      (session.role !== "OWNER" && session.role !== "MANAGER")
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing property id." },
        { status: 400 }
      );
    }

    /*
     * Owners and managers may only modify the property attached to their
     * authenticated session.
     */
    if (!session.propertyId || session.propertyId !== id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as PostBody;
    const tiers = Array.isArray(body.tiers) ? body.tiers : [];

    if (tiers.length === 0) {
      return NextResponse.json(
        { error: "At least one tier is required." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        rentFrayStartDate: true,
        settings: {
          select: {
            rentDueDay: true,
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    /*
     * Once the RentFray Start Date is locked, its calendar day is the only
     * permitted monthly due day.
     *
     * Before activation, use the existing internal settings value—or day 1
     * as a harmless placeholder. lockBillingCalendar() will atomically replace
     * this value on every tier when management confirms the Start Date.
     */
    const lockedDueDay = getLockedMonthlyDueDay(
      property.rentFrayStartDate
    );

    const authoritativeDueDay =
      lockedDueDay ?? property.settings?.rentDueDay ?? 1;

    if (
      !Number.isInteger(authoritativeDueDay) ||
      authoritativeDueDay < 1 ||
      authoritativeDueDay > 31
    ) {
      return NextResponse.json(
        {
          error:
            "The property's billing calendar is invalid. Tier changes were not saved.",
        },
        { status: 409 }
      );
    }

    const savedTiers = await prisma.$transaction(
      async (
        tx: Prisma.TransactionClient
      ): Promise<SavedTierResult[]> => {
        /*
         * Lock the property row so activation and tier editing cannot modify
         * the billing calendar concurrently.
         */
        await tx.$queryRaw`
          SELECT "id"
          FROM "Property"
          WHERE "id" = ${id}
          FOR UPDATE
        `;

        const currentProperty = await tx.property.findUnique({
          where: { id },
          select: {
            rentFrayStartDate: true,
            settings: {
              select: {
                rentDueDay: true,
              },
            },
          },
        });

        if (!currentProperty) {
          throw new Error("Property not found.");
        }

        /*
         * Recalculate after acquiring the row lock. The property may have
         * been activated between the initial read and this transaction.
         */
        const currentLockedDueDay = getLockedMonthlyDueDay(
          currentProperty.rentFrayStartDate
        );

        const transactionDueDay =
          currentLockedDueDay ??
          currentProperty.settings?.rentDueDay ??
          1;

        if (
          !Number.isInteger(transactionDueDay) ||
          transactionDueDay < 1 ||
          transactionDueDay > 31
        ) {
          throw new Error(
            "The property's billing calendar is invalid."
          );
        }

        const results: SavedTierResult[] = [];

        for (let index = 0; index < tiers.length; index += 1) {
          const tier = tiers[index];

          const clientId = String(
            tier.id || `new-tier-${index}`
          );

          const name =
            String(tier.tierName || "").trim() ||
            `Tier ${index + 1}`;

          const baseRentCents = toCents(tier.baseRent);
          const gracePeriodDays = toInt(tier.graceDays, 0);

          const lateFeeInitialCents = tier.lateFeeEnabled
            ? toCents(tier.lateFeeAmount)
            : 0;

          const lateFeeDailyCents = tier.lateFeeEnabled
            ? toCents(tier.lateFeeDaily)
            : 0;

          const maxLateFeeDays = tier.lateFeeEnabled
            ? toInt(tier.lateFeeMaxDays, 0)
            : 0;

          const unitCount = Math.max(
            0,
            toInt(tier.unitCount, 0)
          );

          if (baseRentCents < 0) {
            throw new Error(
              `Tier "${name}" has an invalid rent amount.`
            );
          }

          if (
            !Number.isInteger(gracePeriodDays) ||
            gracePeriodDays < 0 ||
            gracePeriodDays > 31
          ) {
            throw new Error(
              `Tier "${name}" must have a grace period from 0 to 31 days.`
            );
          }

          if (
            lateFeeInitialCents < 0 ||
            lateFeeDailyCents < 0 ||
            maxLateFeeDays < 0
          ) {
            throw new Error(
              `Tier "${name}" has invalid late-fee settings.`
            );
          }

          if (tier.markedForDelete && tier.id) {
            const occupiedUnits =
              await tx.tenantAssignment.count({
                where: {
                  propertyId: id,
                  isCurrent: true,
                  moveOutDate: null,
                  unit: {
                    tierId: tier.id,
                  },
                },
              });

            if (occupiedUnits > 0) {
              throw new Error(
                `Cannot delete tier "${name}" because units are still assigned.`
              );
            }

            const existingTier =
              await tx.propertyTier.findFirst({
                where: {
                  id: tier.id,
                  propertyId: id,
                },
                select: {
                  id: true,
                },
              });

            if (!existingTier) {
              throw new Error(
                `Tier "${name}" was not found.`
              );
            }

            await tx.propertyTier.update({
              where: {
                id: existingTier.id,
              },
              data: {
                isActive: false,
              },
            });

            continue;
          }

          if (
            tier.id &&
            !tier.id.startsWith("new-tier-")
          ) {
            const existingTier =
              await tx.propertyTier.findFirst({
                where: {
                  id: tier.id,
                  propertyId: id,
                  isActive: true,
                },
                select: {
                  id: true,
                  unitCount: true,
                },
              });

            if (!existingTier) {
              throw new Error(
                `Tier "${name}" was not found.`
              );
            }

            const activeTierUnitCount =
              await tx.unit.count({
                where: {
                  propertyId: id,
                  tierId: existingTier.id,
                  isActive: true,
                },
              });

            const submittedUnitCount = Math.max(
              0,
              toInt(tier.unitCount, 0)
            );

            const nextUnitCount =
              submittedUnitCount === activeTierUnitCount &&
              existingTier.unitCount > activeTierUnitCount
                ? existingTier.unitCount
                : submittedUnitCount;

            if (nextUnitCount < activeTierUnitCount) {
              throw new Error(
                `Tier "${name}" cannot be lower than ${activeTierUnitCount} active units.`
              );
            }

            const updatedTier =
              await tx.propertyTier.update({
                where: {
                  id: existingTier.id,
                },
                data: {
                  name,
                  unitCount: nextUnitCount,
                  activeUnitCount:
                    activeTierUnitCount,
                  baseRentCents,

                  /*
                   * Never use tier.dueDay. The billing calendar is the only
                   * authority.
                   */
                  rentDueDay: transactionDueDay,

                  gracePeriodDays,
                  lateFeeInitialCents,
                  lateFeeDailyCents,
                  maxLateFeeDays,
                  lateFeeType: "FLAT",
                  sortOrder: index,
                  isActive: true,
                },
                select: {
                  id: true,
                  name: true,
                },
              });

            results.push({
              clientId,
              tierId: updatedTier.id,
              tierName: updatedTier.name,
            });

            continue;
          }

          const createdTier =
            await tx.propertyTier.create({
              data: {
                propertyId: id,
                name,
                unitCount,
                activeUnitCount: 0,
                baseRentCents,

                /*
                 * New tiers automatically inherit the permanent due day.
                 * The request payload cannot choose or alter it.
                 */
                rentDueDay: transactionDueDay,

                gracePeriodDays,
                lateFeeInitialCents,
                lateFeeDailyCents,
                maxLateFeeDays,
                lateFeeType: "FLAT",
                sortOrder: index,
                isActive: true,
              },
              select: {
                id: true,
                name: true,
              },
            });

          results.push({
            clientId,
            tierId: createdTier.id,
            tierName: createdTier.name,
          });
        }

        /*
         * If the calendar is locked, verify that every tier—including
         * inactive tiers—still matches it before committing.
         */
        if (currentLockedDueDay !== null) {
          const mismatchedTier =
            await tx.propertyTier.findFirst({
              where: {
                propertyId: id,
                rentDueDay: {
                  not: currentLockedDueDay,
                },
              },
              select: {
                id: true,
              },
            });

          if (mismatchedTier) {
            throw new Error(
              `Billing calendar verification failed for tier ${mismatchedTier.id}.`
            );
          }
        }

        return results;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    const tierIdMap: Record<string, string> =
      Object.fromEntries(
        savedTiers.map(
          (
            tier: SavedTierResult
          ): [string, string] => [
            tier.clientId,
            tier.tierId,
          ]
        )
      );

    return NextResponse.json({
      ok: true,
      tiers: savedTiers,
      tierIdMap,
      monthlyDueDay: authoritativeDueDay,
      billingCalendarLocked: lockedDueDay !== null,
    });
  } catch (error: unknown) {
    console.error("SAVE TIERS FAILED", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to save tiers.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}