// app/api/manager/units/vacate/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed, lockCheckout } from "@/lib/checkoutCollectibility";

import { getBusinessDate, getBusinessDateInstant } from "@/lib/rentDates";
import { getSession } from "@/lib/session";
import { emitEvent } from "@/lib/realtime";
import { Prisma } from "@prisma/client";
import { lockManualRows, ManualOperationError, isManualLockContention } from "@/lib/manualFinancialOperations";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type VacateBody = {
  unitId?: unknown;
  tenantAssignmentId?: unknown;
  moveOutDate?: unknown;
  note?: unknown;
};

type VacateSuccessResponse = {
  ok: true;
  data: {
    unitId: string;
    unitNumber: string;
    vacatedAssignmentId: string | null;
    moveOutDate: string;
  };
};

type VacateErrorResponse = {
  ok: false;
  error: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parseMoveOutDate(value: unknown): Date {
  const raw = clean(value);
  if (raw) {
    try { return getBusinessDateInstant(raw); }
    catch { /* Preserve the existing invalid-date fallback to today. */ }
  }
  return getBusinessDateInstant(formatDateOnly(new Date()));
}

function formatDateOnly(date: Date): string {
  const day = getBusinessDate(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function isAllowedRole(role: string): role is "OWNER" | "MANAGER" {
  return role === "OWNER" || role === "MANAGER";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (
      !session ||
      !session.propertyId ||
      !isAllowedRole(session.role)
    ) {
      return NextResponse.json<VacateErrorResponse>(
        { ok: false, error: "Unauthorized" },
        { status: !session ? 401 : 403 }
      );
    }

    const body = (await req.json()) as VacateBody;

    const unitId = clean(body.unitId);
    const tenantAssignmentId = typeof body.tenantAssignmentId === "string" ? clean(body.tenantAssignmentId) : "";
    const note = clean(body.note);
    const moveOutDate = parseMoveOutDate(body.moveOutDate);

    if (!unitId || !tenantAssignmentId) {
      return NextResponse.json<VacateErrorResponse>(
        { ok: false, error: "Unit ID and tenant assignment ID are required." },
        { status: 400 }
      );
    }

    const inspection = await inspectTenantCheckoutAttempts(prisma, { propertyId: session.propertyId, unitId, tenantAssignmentId });
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await lockCheckout(tx, inspection.identity);
        await assertCheckoutReductionAllowed(tx, inspection);
        await lockManualRows(tx, session.propertyId!, unitId, tenantAssignmentId, []);
    const unit = await tx.unit.findFirst({
      where: {
        id: unitId,
        propertyId: session.propertyId,
      },
      select: {
        id: true,
        propertyId: true,
        unitNumber: true,
        portalActivated: true,
      },
    });

    if (!unit) {
      throw new ManualOperationError("Unit not found.", 404);
    }

    const activeAssignment = await tx.tenantAssignment.findFirst({
      where: {
        id: tenantAssignmentId,
        propertyId: session.propertyId,
        unitId: unit.id,
        isCurrent: true,
        OR: [
  { moveOutDate: null },
  { moveOutDate: { gt: new Date() } },
],
      },
      orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

        if (!activeAssignment) {
          throw new ManualOperationError("The displayed tenant assignment is no longer current.");
        }
        let vacatedAssignmentId: string | null = null;

        if (activeAssignment) {
          await tx.tenantAssignment.update({
            where: { id: activeAssignment.id },
            data: {
              isCurrent: false,
              moveOutDate,
              notes: note || undefined,
            },
          });

          vacatedAssignmentId = activeAssignment.id;
        }

        await tx.unit.update({
          where: { id: unit.id },
          data: {
            portalActivated: false,
            portalFirstName: null,
            portalLastName: null,
            tenantPinHash: null,
            activatedAt: null,
            activationSource: null,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: session.propertyId,
            actorType: session.role,
            actorManagementUserId: session.managementUserId ?? null,
            action: "UNIT_VACATED",
            targetType: "UNIT",
            targetId: unit.id,
            summary: `Unit ${unit.unitNumber} marked vacant`,
            metadataJson: JSON.stringify({
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              tenantAssignmentId: vacatedAssignmentId,
              moveOutDate: formatDateOnly(moveOutDate),
              clearedPortalAccess: true,
              note: note || null,
            }),
          },
        });

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          vacatedAssignmentId,
          moveOutDate: formatDateOnly(moveOutDate),
        };
      }
    );

    emitEvent("tenant:update", {
      propertyId: session.propertyId,
      unitId: result.unitId,
      tenantAssignmentId: result.vacatedAssignmentId,
      source: "UNIT_VACATED",
    });

    emitEvent("unit:update", {
      propertyId: session.propertyId,
      unitId: result.unitId,
      source: "UNIT_VACATED",
    });

    emitEvent("ledger:update", {
      propertyId: session.propertyId,
      unitId: result.unitId,
      tenantAssignmentId: result.vacatedAssignmentId,
      source: "UNIT_VACATED",
    });

    return NextResponse.json<VacateSuccessResponse>({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof CheckoutConflict) return NextResponse.json<VacateErrorResponse>({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof ManualOperationError) {
      return NextResponse.json<VacateErrorResponse>({ ok: false, error: error.message }, { status: error.status });
    }
    if (isManualLockContention(error)) {
      return NextResponse.json<VacateErrorResponse>({ ok: false, error: "Tenancy is busy. Refresh and try again." }, { status: 409 });
    }
    console.error("POST /api/manager/units/vacate failed", error);

    return NextResponse.json<VacateErrorResponse>(
      { ok: false, error: "Failed to vacate unit." },
      { status: 500 }
    );
  }
}
