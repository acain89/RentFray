// app/api/manual-payments/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";

function clean(value: unknown) {
  return String(value || "").trim();
}

function parseEffectiveDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date();

  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "manual-payments" });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json(
        { error: "Only owner or manager can post manual payments" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const unitId = clean(body.unitId);
    const amount = Number(body.amount);
    const description = clean(body.description) || "Manual payment";
    const effectiveDate = parseEffectiveDate(body.effectiveDate);

    if (!unitId) {
      return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        type: "PAYMENT",
        amount: -Math.abs(amount),
        description,
        effectiveDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: unit.propertyId,
        actorRole: session.role,
        actorLabel: session.managementUserId || "management",
        action: "MANUAL_PAYMENT_POSTED",
        entityType: "LEDGER_ENTRY",
        entityId: entry.id,
        notes: JSON.stringify({
          unitNumber: unit.unitNumber,
          amount: -Math.abs(amount),
          description,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (error) {
    console.error("POST /api/manual-payments error:", error);
    return NextResponse.json(
      { error: "Failed to post manual payment" },
      { status: 500 }
    );
  }
}