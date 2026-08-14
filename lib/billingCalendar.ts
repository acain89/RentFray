import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBusinessDate } from "@/lib/rentDates";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class BillingCalendarError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BillingCalendarError";
    this.statusCode = statusCode;
  }
}

export type BillingCalendarActor = {
  actorType: "MANAGER" | "ADMIN" | "SYSTEM";
  managementUserId?: string | null;
  adminId?: string | null;
};

export type LockedBillingCalendar = {
  propertyId: string;
  rentFrayStartDate: Date;
  rentFrayStartDateString: string;
  monthlyDueDay: number;
  updatedTierCount: number;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateOnly(value: unknown): DateParts {
  const raw = String(value ?? "").trim();
  const match = DATE_ONLY_PATTERN.exec(raw);

  if (!match) {
    throw new BillingCalendarError(
      "RentFray Start Date must be a valid calendar date."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) {
    throw new BillingCalendarError(
      "RentFray Start Date must be a valid calendar date."
    );
  }

  return { year, month, day };
}

function createStoredDate(parts: DateParts): Date {
  /*
   * Store the selected calendar date at UTC midnight.
   *
   * lib/rentDates.ts deliberately reads the stored value with UTC getters,
   * which prevents the selected day from shifting because of server timezone
   * or daylight-saving behavior.
   */
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function datePartsToString(parts: DateParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function dateToUtcDateOnlyString(value: Date): string {
  return [
    String(value.getUTCFullYear()).padStart(4, "0"),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function businessTodayString(now: Date): string {
  const today = getBusinessDate(now);

  return [
    String(today.getFullYear()).padStart(4, "0"),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function assertTodayOrFuture(parts: DateParts, now: Date): void {
  const selected = datePartsToString(parts);
  const today = businessTodayString(now);

  /*
   * YYYY-MM-DD strings sort chronologically, so this comparison remains
   * timezone-safe and avoids timestamp conversion errors.
   */
  if (selected < today) {
    throw new BillingCalendarError(
      "RentFray Start Date cannot be in the past."
    );
  }
}

function assertValidDueDay(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new BillingCalendarError(
      "The permanent monthly due day is invalid."
    );
  }
}

export async function lockBillingCalendar(input: {
  propertyId: string;
  rentFrayStartDate: unknown;
  actor: BillingCalendarActor;
  now?: Date;
}): Promise<LockedBillingCalendar> {
  const propertyId = String(input.propertyId ?? "").trim();

  if (!propertyId) {
    throw new BillingCalendarError("Missing property id.");
  }

  const now = input.now ?? new Date();
  const selectedParts = parseDateOnly(input.rentFrayStartDate);

  assertTodayOrFuture(selectedParts, now);
  assertValidDueDay(selectedParts.day);

  const selectedDate = createStoredDate(selectedParts);
  const selectedDateString = datePartsToString(selectedParts);
  const monthlyDueDay = selectedParts.day;

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      /*
       * Serialize all attempts to lock this property's billing calendar.
       * This prevents two simultaneous requests from both passing the
       * "not locked" check.
       */
      await tx.$queryRaw`
        SELECT "id"
        FROM "Property"
        WHERE "id" = ${propertyId}
        FOR UPDATE
      `;

      const existing = await tx.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          name: true,
          rentFrayStartDate: true,
        },
      });

      if (!existing) {
        throw new BillingCalendarError("Property not found.", 404);
      }

      if (existing.rentFrayStartDate) {
        throw new BillingCalendarError(
          "RentFray Start Date has already been permanently locked and cannot be changed.",
          409
        );
      }

      await tx.property.update({
        where: { id: propertyId },
        data: {
          rentFrayStartDate: selectedDate,
        },
      });

      await tx.propertySettings.upsert({
        where: { propertyId },
        update: {
          rentDueDay: monthlyDueDay,
        },
        create: {
          propertyId,
          rentDueDay: monthlyDueDay,
        },
      });

      /*
       * Update every tier, including inactive tiers. An inactive tier may be
       * reactivated later and must not retain an obsolete due day.
       */
      const tierUpdate = await tx.propertyTier.updateMany({
        where: { propertyId },
        data: {
          rentDueDay: monthlyDueDay,
        },
      });

      /*
       * Verify the complete invariant before allowing the transaction to
       * commit. Any failure throws and rolls back every write above.
       */
      const verification = await tx.property.findUnique({
        where: { id: propertyId },
        select: {
          rentFrayStartDate: true,
          settings: {
            select: {
              rentDueDay: true,
            },
          },
          tiers: {
            select: {
              id: true,
              rentDueDay: true,
            },
          },
        },
      });

      if (!verification?.rentFrayStartDate) {
        throw new BillingCalendarError(
          "Billing calendar verification failed: start date was not saved.",
          500
        );
      }

      const storedDateString = dateToUtcDateOnlyString(
        verification.rentFrayStartDate
      );

      if (storedDateString !== selectedDateString) {
        throw new BillingCalendarError(
          "Billing calendar verification failed: stored start date does not match the selected date.",
          500
        );
      }

      if (verification.settings?.rentDueDay !== monthlyDueDay) {
        throw new BillingCalendarError(
          "Billing calendar verification failed: property settings do not match the permanent due day.",
          500
        );
      }

      const mismatchedTier = verification.tiers.find(
        (tier) => tier.rentDueDay !== monthlyDueDay
      );

      if (mismatchedTier) {
        throw new BillingCalendarError(
          `Billing calendar verification failed: tier ${mismatchedTier.id} does not match the permanent due day.`,
          500
        );
      }

      await tx.auditLog.create({
        data: {
          propertyId,
          actorType: input.actor.actorType,
          actorAdminId: input.actor.adminId ?? null,
          actorManagementUserId: input.actor.managementUserId ?? null,
          action: "BILLING_CALENDAR_LOCKED",
          targetType: "PROPERTY",
          targetId: propertyId,
          summary: `RentFray Start Date permanently locked as ${selectedDateString}; monthly rent is due on day ${monthlyDueDay}.`,
          metadataJson: JSON.stringify({
            rentFrayStartDate: selectedDateString,
            monthlyDueDay,
            updatedTierCount: tierUpdate.count,
          }),
        },
      });

      return {
        propertyId,
        rentFrayStartDate: selectedDate,
        rentFrayStartDateString: selectedDateString,
        monthlyDueDay,
        updatedTierCount: tierUpdate.count,
      };
    },
     {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15000,
  maxWait: 5000,
    }
  );
}

export function getLockedMonthlyDueDay(
  rentFrayStartDate: Date | null | undefined
): number | null {
  if (!rentFrayStartDate) {
    return null;
  }

  const dueDay = rentFrayStartDate.getUTCDate();
  assertValidDueDay(dueDay);

  return dueDay;
}

export function assertPropertyBillingCalendar(input: {
  propertyId: string;
  rentFrayStartDate: Date | null;
  propertySettingsDueDay: number | null | undefined;
}): number {
  if (!input.rentFrayStartDate) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} does not have a locked RentFray Start Date.`,
      409
    );
  }

  const permanentDueDay = getLockedMonthlyDueDay(
    input.rentFrayStartDate
  );

  if (permanentDueDay === null) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has an invalid billing calendar.`,
      500
    );
  }

  if (input.propertySettingsDueDay !== permanentDueDay) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has conflicting billing settings.`,
      500
    );
  }

  return permanentDueDay;
}

export function assertTierBillingCalendar(input: {
  propertyId: string;
  rentFrayStartDate: Date | null;
  propertySettingsDueDay: number | null | undefined;
  tier: {
    id?: string | null;
    rentDueDay: number;
  } | null;
}): number {
  if (!input.rentFrayStartDate) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} does not have a locked RentFray Start Date.`,
      409
    );
  }

  const permanentDueDay = getLockedMonthlyDueDay(
    input.rentFrayStartDate
  );

  if (permanentDueDay === null) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has an invalid billing calendar.`,
      500
    );
  }

  if (input.propertySettingsDueDay !== permanentDueDay) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has conflicting billing settings.`,
      500
    );
  }

  if (!input.tier) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} does not have a valid billing tier.`,
      500
    );
  }

  if (input.tier.rentDueDay !== permanentDueDay) {
    const tierLabel = input.tier.id
      ? `tier ${input.tier.id}`
      : "the selected tier";

    throw new BillingCalendarError(
      `Property ${input.propertyId} has a conflicting due day on ${tierLabel}.`,
      500
    );
  }

  return permanentDueDay;
}

export function assertBillingCalendarInvariant(input: {
  propertyId: string;
  rentFrayStartDate: Date | null;
  propertySettingsDueDay: number | null | undefined;
  tiers: Array<{
    id: string;
    rentDueDay: number;
  }>;
}): number {
  if (!input.rentFrayStartDate) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} does not have a locked RentFray Start Date.`,
      409
    );
  }

  const permanentDueDay = getLockedMonthlyDueDay(
    input.rentFrayStartDate
  );

  if (permanentDueDay === null) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has an invalid billing calendar.`,
      500
    );
  }

  if (input.propertySettingsDueDay !== permanentDueDay) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has conflicting billing settings.`,
      500
    );
  }

  const mismatchedTier = input.tiers.find(
    (tier) => tier.rentDueDay !== permanentDueDay
  );

  if (mismatchedTier) {
    throw new BillingCalendarError(
      `Property ${input.propertyId} has a conflicting due day on tier ${mismatchedTier.id}.`,
      500
    );
  }

  return permanentDueDay;
}
