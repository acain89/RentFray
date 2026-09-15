// app/api/ledger/post-rent/route.ts

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
     * IMPORTANT:
     *
     * Monthly rent and recurring obligations must have exactly one
     * authoritative posting engine.
     *
     * Do not reproduce billing-cycle, due-date, assignment,
     * recurring-charge, or idempotency logic in this route.
     *
     * runMonthlyRentJob() is the canonical obligation engine and
     * receives the raw timestamp. It is responsible for:
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
     * The propertyId scopes this manual trigger to the manager's
     * authenticated property only.
     */
    const result = await runMonthlyRentJob(
      triggeredAt,
      propertyId
    );

    if (!result.ok) {
      console.error(
        "POST /api/ledger/post-rent canonical billing engine failed:",
        result
      );

      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Failed to post rent",
        },
        { status: 500 }
      );
    }

    /*
     * Preserve an audit record for the manager-triggered action.
     *
     * The financial entries themselves are created only by the
     * canonical monthly obligation engine above.
     */
    await prisma.auditLog.create({
      data: {
        propertyId,
        actorType: "MANAGER",
        actorManagementUserId:
          session.managementUserId ?? null,
        action: "RENT_POSTED",
        targetType: "PROPERTY",
        targetId: propertyId,
        summary: "Monthly obligations processed",
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
     * Preserve the route's existing response shape so current UI
     * callers do not need to change.
     *
     * "posted" remains rent charges specifically. Recurring charges
     * are processed by the same canonical engine but are not counted
     * as rent postings in this legacy response.
     */
    const posted = result.rentChargesCreated;

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
      "POST /api/ledger/post-rent error:",
      error
    );

    return NextResponse.json<ApiError>(
      {
        ok: false,
        error: "Failed to post rent",
      },
      { status: 500 }
    );
  }
}