// app/api/ledger/post-recurring-fees/route.ts

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { runMonthlyRentJob } from "@/jobs/monthlyRent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

export async function POST() {
  try {
    const session = await getSession();

    if (
      !session ||
      !session.propertyId ||
      !canManageFinancials(session.role)
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const propertyId = session.propertyId;
    const triggeredAt = new Date();

    /*
     * Recurring obligations must be posted by the same canonical
     * obligation engine that posts monthly rent.
     *
     * Do not reproduce billing-cycle, due-date, assignment,
     * recurring-charge, or idempotency logic in this route.
     *
     * runMonthlyRentJob() is responsible for:
     *
     * - RentFray business-date handling
     * - locked billing-calendar enforcement
     * - due-cycle determination
     * - missed-cycle catch-up
     * - tenant-assignment eligibility
     * - base rent
     * - unit recurring fees
     * - tier recurring charges
     * - ledger idempotency
     *
     * Because the engine is idempotent, calling it here is safe even
     * when rent for the same cycle has already been posted.
     */
    const result = await runMonthlyRentJob(
      triggeredAt,
      propertyId
    );

    if (!result.ok) {
      console.error(
        "POST /api/ledger/post-recurring-fees canonical billing engine failed:",
        result
      );

      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Failed to post recurring fees",
        },
        { status: 500 }
      );
    }

    /*
     * Preserve an audit record for the manager-triggered action.
     *
     * The route itself does not create financial ledger entries.
     * All obligations are created by the canonical engine above.
     */
    await prisma.auditLog.create({
      data: {
        propertyId,
        actorType: "MANAGER",
        actorManagementUserId:
          session.managementUserId ?? null,
        action: "RECURRING_FEES_POSTED",
        targetType: "PROPERTY",
        targetId: propertyId,
        summary: "Recurring obligations processed",
        metadataJson: JSON.stringify({
          triggeredAt: triggeredAt.toISOString(),
          processedUnits: result.processedUnits,
          dueUnits: result.dueUnits,
          rentChargesCreated:
            result.rentChargesCreated,
          recurringFeeChargesCreated:
            result.recurringFeeChargesCreated,
          existingChargesSkipped:
            result.existingChargesSkipped,
          skippedNoTenant:
            result.skippedNoTenant,
          skippedNotDue:
            result.skippedNotDue,
          skippedMoveInAfterDue:
            result.skippedMoveInAfterDue,
          failedUnits: result.failedUnits,
        }),
      },
    });

    /*
     * Preserve the existing API response shape.
     *
     * "posted" means recurring obligations created by this run.
     * Rent may also be self-healed by the canonical engine if a rent
     * obligation is missing, but it is intentionally not included in
     * this legacy recurring-fee count.
     */
    const posted =
      result.recurringFeeChargesCreated;

    const skipped =
      result.existingChargesSkipped +
      result.skippedNoTenant +
      result.skippedNotDue +
      result.skippedMoveInAfterDue;

    return NextResponse.json<
      ApiSuccess<{
        posted: number;
        skipped: number;
      }>
    >({
      ok: true,
      data: {
        posted,
        skipped,
      },
    });
  } catch (error: unknown) {
    console.error(
      "POST /api/ledger/post-recurring-fees error:",
      error
    );

    return NextResponse.json<ApiError>(
      {
        ok: false,
        error: "Failed to post recurring fees",
      },
      { status: 500 }
    );
  }
}