import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allocatePayment } from "@/lib/paymentAllocation";

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
    const body = await req.json();

    const propertyId = String(body.propertyId || "");
    const unitId = String(body.unitId || "");
    const tenantIdInput = String(body.tenantId || "");
    const amount = Number(body.amount || 0);
    const memo = String(body.memo || "");
    const effectiveDate = parseEffectiveDate(body.effectiveDate);

    if (!propertyId || !unitId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // --- LOAD UNIT + ACTIVE TENANT + LEDGER ---
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
        ledgerEntries: {
          orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const activeTenant = unit.assignments[0]?.tenant;

    // ✅ HARD GUARD: must have tenant
    if (!activeTenant && !tenantIdInput) {
      return NextResponse.json(
        { error: "No active tenant for unit" },
        { status: 400 }
      );
    }

    const tenantId = tenantIdInput || activeTenant?.id || null;

    // --- ALLOCATION ENGINE ---
    const { allocations, remaining } = allocatePayment(
      amount,
      unit.ledgerEntries.map((e) => ({
        id: e.id,
        amount: Number(e.amount || 0),
        type: e.type,
        effectiveDate: e.effectiveDate,
      }))
    );

    // --- CREATE PAYMENT (NEGATIVE ENTRY) ---
    const payment = await prisma.ledgerEntry.create({
      data: {
        propertyId,
        unitId,
        tenantId,
        type: "MANUAL_PAYMENT",
        amount: -Math.abs(amount),
        effectiveDate,
        memo: memo || "Manual payment",
        source: "MANUAL",
      },
    });

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      allocations,
      remaining, // overpayment credit
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to post manual payment." },
      { status: 500 }
    );
  }
}