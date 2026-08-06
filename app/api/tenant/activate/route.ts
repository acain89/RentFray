import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPin } from "@/lib/pin";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";
import {
  assertTierBillingCalendar,
  BillingCalendarError,
} from "@/lib/billingCalendar";
import {
  getRentDateSummary,
  resolveEffectiveBillingSettings,
} from "@/lib/rentDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivateBody = {
  propertyCode: string;
  firstName: string;
  lastName: string;
  unitNumber: string;
  confirmUnitNumber: string;
  tierId: string;
  pin: string;
  confirmPin: string;
  recentMoveIn: boolean | null;
  moveInDate: string | null;
};

class TenantActivationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TenantActivationError";
    this.statusCode = statusCode;
  }
}

type ActivationResult = {
  propertyId: string;
  unitId: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parseMoveInDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return valid ? date : null;
}

function parseRentDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new TenantActivationError(
      "RentFray returned an invalid billing date.",
      500
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!valid) {
    throw new TenantActivationError(
      "RentFray returned an invalid billing date.",
      500
    );
  }

  return date;
}

function isPrismaKnownError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ActivateBody>;

    const propertyCode = clean(body.propertyCode);
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const unitNumber = clean(body.unitNumber).toUpperCase();
    const confirmUnitNumber = clean(
      body.confirmUnitNumber
    ).toUpperCase();
    const tierId = clean(body.tierId);
    const pin = clean(body.pin);
    const confirmPin = clean(body.confirmPin);
    const recentMoveIn = body.recentMoveIn;
    const moveInDateRaw = clean(body.moveInDate);
    const moveInDate = parseMoveInDate(moveInDateRaw);

    // ---------------- VALIDATION ----------------

    if (!/^\d{4,5}$/.test(propertyCode)) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!firstName) {
      return NextResponse.json(
        { error: "First name required." },
        { status: 400 }
      );
    }

    if (!lastName) {
      return NextResponse.json(
        { error: "Last name required." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number required." },
        { status: 400 }
      );
    }

    if (unitNumber !== confirmUnitNumber) {
      return NextResponse.json(
        { error: "Unit numbers do not match." },
        { status: 400 }
      );
    }

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier selection required." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 digits." },
        { status: 400 }
      );
    }

    if (pin !== confirmPin) {
      return NextResponse.json(
        { error: "PINs do not match." },
        { status: 400 }
      );
    }

    if (typeof recentMoveIn !== "boolean") {
      return NextResponse.json(
        { error: "Move-in question required." },
        { status: 400 }
      );
    }

    if (recentMoveIn && !moveInDateRaw) {
      return NextResponse.json(
        { error: "Move-in date required." },
        { status: 400 }
      );
    }

    if (moveInDateRaw && !moveInDate) {
      return NextResponse.json(
        { error: "Invalid move-in date." },
        { status: 400 }
      );
    }

    /*
     * Password hashing is intentionally completed before opening the
     * transaction so the property row is not locked during CPU work.
     */
    const pinHash = await hashPin(pin);
    const activatedAt = new Date();

    const activation = await prisma.$transaction(
      async (
        tx: Prisma.TransactionClient
      ): Promise<ActivationResult> => {
        /*
         * First resolve the property ID from its public code.
         */
        const propertyLookup = await tx.property.findUnique({
          where: {
            propertyCode,
          },
          select: {
            id: true,
          },
        });

        if (!propertyLookup) {
          throw new TenantActivationError(
            "Property not available.",
            403
          );
        }

        /*
         * Serialize activations for this property. Two tenants cannot
         * simultaneously pass the same capacity check and both commit.
         */
        await tx.$queryRaw`
          SELECT "id"
          FROM "Property"
          WHERE "id" = ${propertyLookup.id}
          FOR UPDATE
        `;

        /*
         * Re-read all authoritative data after acquiring the lock.
         */
        const property = await tx.property.findUnique({
          where: {
            id: propertyLookup.id,
          },
          select: {
            id: true,
            isActive: true,
            rentFrayStartDate: true,
            settings: {
              select: {
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeEnabled: true,
                lateFeeFlatCents: true,
              },
            },
            tiers: {
              where: {
                id: tierId,
                isActive: true,
              },
              select: {
                id: true,
                unitCount: true,
                baseRentCents: true,
                rentDueDay: true,
                gracePeriodDays: true,
                lateFeeInitialCents: true,
                lateFeeDailyCents: true,
                maxLateFeeDays: true,
              },
            },
          },
        });

        if (!property || !property.isActive) {
          throw new TenantActivationError(
            "Property not available.",
            403
          );
        }

        const selectedTier = property.tiers[0] ?? null;

        if (!selectedTier) {
          throw new TenantActivationError(
            "Invalid tier selection."
          );
        }

        /*
         * Validate the permanent billing calendar before making any
         * database changes.
         */
        const permanentDueDay =
          assertTierBillingCalendar({
            propertyId: property.id,
            rentFrayStartDate:
              property.rentFrayStartDate,
            propertySettingsDueDay:
              property.settings?.rentDueDay,
            tier: selectedTier,
          });

        const effectiveBillingSettings =
          resolveEffectiveBillingSettings({
            tier: selectedTier,
            propertySettings:
              property.settings ?? null,
          });

        /*
         * The locked RentFray Start Date is authoritative. The tier and
         * settings values were verified above and are not allowed to
         * choose a different day.
         */
        effectiveBillingSettings.dueDay =
          permanentDueDay;

        const rentDates = getRentDateSummary({
          ...effectiveBillingSettings,
          now: activatedAt,
          rentFrayStartDate:
            property.rentFrayStartDate,
        });

        const dueDate = parseRentDate(
          rentDates.dueDate
        );

        const existingUnit =
          await tx.unit.findUnique({
            where: {
              propertyId_unitNumber: {
                propertyId: property.id,
                unitNumber,
              },
            },
            select: {
              id: true,
              isActive: true,
              portalActivated: true,
              tierId: true,
            },
          });

        if (existingUnit && !existingUnit.isActive) {
          throw new TenantActivationError(
            "This unit is inactive."
          );
        }

        if (existingUnit?.portalActivated) {
          throw new TenantActivationError(
            "This unit has already been activated."
          );
        }

        /*
         * Reject inconsistent legacy data rather than creating a second
         * current tenant assignment for the same unit.
         */
        if (existingUnit) {
          const existingCurrentAssignment =
            await tx.tenantAssignment.findFirst({
              where: {
                propertyId: property.id,
                unitId: existingUnit.id,
                isCurrent: true,
                moveOutDate: null,
              },
              select: {
                id: true,
              },
            });

          if (existingCurrentAssignment) {
            throw new TenantActivationError(
              "This unit is already assigned. Contact management for help.",
              409
            );
          }
        }

        /*
         * A new unit consumes property-level capacity. An existing,
         * already-active unit does not consume an additional slot.
         */
        if (!existingUnit) {
          const configuredCapacity =
            await tx.propertyTier.aggregate({
              where: {
                propertyId: property.id,
                isActive: true,
              },
              _sum: {
                unitCount: true,
              },
            });

          const activeUnitCount =
            await tx.unit.count({
              where: {
                propertyId: property.id,
                isActive: true,
              },
            });

          const totalCapacity =
            configuredCapacity._sum.unitCount ?? 0;

          if (
            totalCapacity <= 0 ||
            activeUnitCount >= totalCapacity
          ) {
            throw new TenantActivationError(
              "Property is at full capacity.",
              409
            );
          }
        }

        /*
         * Tier capacity follows the existing RF rule: occupied/current
         * assignments consume tier capacity.
         */
        const occupiedTierCount =
          await tx.tenantAssignment.count({
            where: {
              propertyId: property.id,
              isCurrent: true,
              moveOutDate: null,
              unit: {
                tierId: selectedTier.id,
                isActive: true,
              },
            },
          });

        if (
          selectedTier.unitCount <= 0 ||
          occupiedTierCount >=
            selectedTier.unitCount
        ) {
          throw new TenantActivationError(
            "This rent tier is full. Contact management for help.",
            409
          );
        }

        const savedUnit = existingUnit
          ? await tx.unit.update({
              where: {
                id: existingUnit.id,
              },
              data: {
                tierId: selectedTier.id,
                portalActivated: true,
                portalFirstName: firstName,
                portalLastName: lastName,
                tenantPinHash: pinHash,
                activatedAt,
                activationSource:
                  "SELF_SERVICE",
              },
              select: {
                id: true,
              },
            })
          : await tx.unit.create({
              data: {
                propertyId: property.id,
                unitNumber,
                tierId: selectedTier.id,
                isActive: true,
                portalActivated: true,
                portalFirstName: firstName,
                portalLastName: lastName,
                tenantPinHash: pinHash,
                activatedAt,
                activationSource:
                  "SELF_SERVICE",
              },
              select: {
                id: true,
              },
            });

        const tenantAssignment =
          await tx.tenantAssignment.create({
            data: {
              propertyId: property.id,
              unitId: savedUnit.id,
              firstName,
              lastName,
              isCurrent: true,
              moveInDate:
                moveInDate ?? activatedAt,
            },
            select: {
              id: true,
            },
          });

        /*
         * RENTFRAY MOVE-IN RULES:
         *
         * No:
         *   Owes the current cycle.
         *
         * Yes + move-in on/before current due date:
         *   Owes the current cycle.
         *
         * Yes + move-in after current due date:
         *   First rent charge is created by the next monthly-rent job.
         *
         * Before the permanent RentFray Start Date:
         *   No rent charge is created.
         */
        let shouldPostRent =
          rentDates.hasStarted;

        if (
          shouldPostRent &&
          recentMoveIn === true &&
          moveInDate
        ) {
          shouldPostRent =
            moveInDate.getTime() <=
            dueDate.getTime();
        }

        if (
          shouldPostRent &&
          selectedTier.baseRentCents > 0
        ) {
          /*
           * Keep a duplicate check inside the same locked transaction.
           * The assignment is new, but this protects retries and future
           * workflow changes.
           */
          const existingRentCharge =
            await tx.ledgerEntry.findFirst({
              where: {
                propertyId: property.id,
                unitId: savedUnit.id,
                tenantAssignmentId:
                  tenantAssignment.id,
                billingCycle:
                  rentDates.billingCycle,
                entryType: "CHARGE",
                chargeType: "RENT",
                voidedAt: null,
              },
              select: {
                id: true,
              },
            });

          if (!existingRentCharge) {
            await tx.ledgerEntry.create({
              data: {
                propertyId: property.id,
                unitId: savedUnit.id,
                tenantAssignmentId:
                  tenantAssignment.id,
                entryType: "CHARGE",
                chargeType: "RENT",
                amountCents:
                  selectedTier.baseRentCents,
                effectiveDate: dueDate,
                billingCycle:
                  rentDates.billingCycle,
                memo: "Base Rent",
              },
            });
          }
        }

        return {
          propertyId: property.id,
          unitId: savedUnit.id,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      }
    );

    /*
     * The session is created only after every database operation commits.
     */
    const token = createSessionToken({
      role: "TENANT",
      propertyId: activation.propertyId,
      unitId: activation.unitId,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      role: "TENANT",
      propertyId: activation.propertyId,
      unitId: activation.unitId,
    });
  } catch (error: unknown) {
    if (error instanceof TenantActivationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof BillingCalendarError) {
      console.error(
        "Tenant activation billing-calendar failure",
        error
      );

      return NextResponse.json(
        {
          error:
            "This property has a billing configuration problem. Contact management for help.",
        },
        { status: error.statusCode }
      );
    }

    if (
      isPrismaKnownError(error) &&
      error.code === "P2034"
    ) {
      console.error(
        "Tenant activation transaction conflict",
        error
      );

      return NextResponse.json(
        {
          error:
            "Another activation was processed at the same time. Please try again.",
        },
        { status: 409 }
      );
    }

    if (
      isPrismaKnownError(error) &&
      error.code === "P2002"
    ) {
      console.error(
        "Tenant activation unique constraint conflict",
        error
      );

      return NextResponse.json(
        {
          error:
            "This unit has already been activated or assigned.",
        },
        { status: 409 }
      );
    }

    console.error("Activation failed", error);

    return NextResponse.json(
      { error: "Activation failed." },
      { status: 500 }
    );
  }
}