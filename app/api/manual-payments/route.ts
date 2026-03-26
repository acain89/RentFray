// app/api/manual-payments/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";
import { emitEvent } from "@/lib/realtime";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

type ManualPaymentEntryResponse = {
  id: string;
  propertyId: string;
  unitId: string;
  tenantAssignmentId: string | null;
  entryType: "PAYMENT";
  amount: number;
  memo: string | null;
  effectiveDate: Date;
  createdAt: Date;
};

type ParsedBody = {
  unitId: string;
  tenantId: string | null;
  amount: number;
  memo: string | null;
  effectiveDate: Date;
};

const MAX_PAYMENT_AMOUNT = 1_000_000;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMemo(value: unknown): string | null {
  const trimmed = clean(value);
  return trimmed ? trimmed : null;
}

function parseMoney(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const rounded = Math.round(n * 100) / 100;
  if (rounded <= 0 || rounded > MAX_PAYMENT_AMOUNT) return null;

  return rounded;
}

function parseEffectiveDate(value: unknown): Date | null {
  const raw = clean(value);
  if (!raw) return null;

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toAmountNumber(value: Prisma.Decimal | number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function badRequest(error: string) {
  return NextResponse.json<ApiError>({ ok: false, error }, { status: 400 });
}

async function parseBody(req: Request): Promise<ParsedBody | null> {
  const body = (await req.json()) as Record<string, unknown>;

  const unitId = clean(body.unitId);
  const tenantIdRaw = clean(body.tenantId);
  const amount = parseMoney(body.amount);
  const memo = normalizeMemo(body.memo ?? body.description);
  const effectiveDate = parseEffectiveDate(body.effectiveDate);

  if (!unitId) return null;
  if (amount === null) return null;
  if (!effectiveDate) return null;

  return {
    unitId,
    tenantId: tenantIdRaw || null,
    amount,
    memo,
    effectiveDate,
  };
}

export async function GET() {
  return NextResponse.json<ApiSuccess<{ route: string }>>({
    ok: true,
    data: { route: "manual-payments" },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Only owner or manager can post manual payments." },
        { status: 401 }
      );
    }

    let parsed: ParsedBody | null = null;

    try {
      parsed = await parseBody(req);
    } catch {
      return badRequest("Invalid request body.");
    }

    if (!parsed) {
      return badRequest("Missing or invalid required fields.");
    }

    const { unitId, tenantId, amount, memo, effectiveDate } = parsed;

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId: session.propertyId,
      },
      select: {
        id: true,
        propertyId: true,
        unitNumber: true,
      },
    });

    if (!unit) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unit not found." },
        { status: 404 }
      );
    }

    let assignment:
      | {
          id: string;
        }
      | null = null;

    if (tenantId) {
      assignment = await prisma.tenantAssignment.findFirst({
        where: {
          tenantId,
          unitId,
          propertyId: unit.propertyId,
          isCurrent: true,
        },
        select: { id: true },
      });

      if (!assignment) {
        return NextResponse.json<ApiError>(
          { ok: false, error: "Tenant is not active in this unit." },
          { status: 400 }
        );
      }
    } else {
      assignment = await prisma.tenantAssignment.findFirst({
        where: {
          unitId,
          propertyId: unit.propertyId,
          isCurrent: true,
        },
        orderBy: [{ moveInDate: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
    }

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient): Promise<ManualPaymentEntryResponse> => {
        const entry = await tx.ledgerEntry.create({
          data: {
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantAssignmentId: assignment?.id ?? null,
            entryType: "PAYMENT",
            amount: -amount,
            effectiveDate,
            memo,
            createdByManagementUserId: session.managementUserId ?? null,
          },
          select: {
            id: true,
            propertyId: true,
            unitId: true,
            tenantAssignmentId: true,
            entryType: true,
            amount: true,
            effectiveDate: true,
            memo: true,
            createdAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            propertyId: unit.propertyId,
            actorType: "MANAGER",
            actorManagementUserId: session.managementUserId ?? null,
            action: "MANUAL_PAYMENT_POSTED",
            targetType: "LEDGER_ENTRY",
            targetId: entry.id,
            summary: `Manual payment posted for unit ${unit.unitNumber}`,
            metadataJson: JSON.stringify({
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              tenantAssignmentId: entry.tenantAssignmentId,
              entryType: entry.entryType,
              amount: toAmountNumber(entry.amount),
              memo: entry.memo,
              effectiveDate: entry.effectiveDate.toISOString(),
            }),
          },
        });

        return {
          id: entry.id,
          propertyId: entry.propertyId,
          unitId: entry.unitId,
          tenantAssignmentId: entry.tenantAssignmentId,
          entryType: "PAYMENT",
          amount: toAmountNumber(entry.amount),
          memo: entry.memo,
          effectiveDate: entry.effectiveDate,
          createdAt: entry.createdAt,
        };
      }
    );

    emitEvent("payment:update", {
      propertyId: unit.propertyId,
      unitId: unit.id,
      tenantAssignmentId: result.tenantAssignmentId,
      entryId: result.id,
      entryType: result.entryType,
      source: "MANUAL_PAYMENT",
    });

    emitEvent("ledger:update", {
      propertyId: unit.propertyId,
      unitId: unit.id,
      tenantAssignmentId: result.tenantAssignmentId,
      entryId: result.id,
      entryType: result.entryType,
      source: "MANUAL_PAYMENT",
    });

    return NextResponse.json<ApiSuccess<{ entry: ManualPaymentEntryResponse }>>({
      ok: true,
      data: { entry: result },
    });
  } catch (error) {
    console.error("POST /api/manual-payments error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to post manual payment." },
      { status: 500 }
    );
  }
}