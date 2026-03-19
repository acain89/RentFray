import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseEffectiveDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date();
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "ledger-charges" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyId = String(body.propertyId || "");
    const unitId = String(body.unitId || "");
    const tenantId = String(body.tenantId || "");
    const type = String(body.type || "");
    const amount = Number(body.amount || 0);
    const memo = String(body.memo || "");
    const effectiveDate = parseEffectiveDate(body.effectiveDate);

    const allowedTypes = new Set(["RENT_CHARGE", "LATE_FEE", "OTHER_FEE"]);

    if (!propertyId || !unitId || !allowedTypes.has(type) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid required fields." },
        { status: 400 }
      );
    }

    await prisma.ledgerEntry.create({
      data: {
        propertyId,
        unitId,
        tenantId: tenantId || null,
        type,
        amount: Math.abs(amount),
        effectiveDate,
        memo,
        source: "MANUAL",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to post charge." },
      { status: 500 }
    );
  }
}