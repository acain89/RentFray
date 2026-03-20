import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function GET() {
  try {
    // ✅ enforce session + role
    const session = await requireRole("TENANT");

    if (!session.unitId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        unitId: session.unitId,
        propertyId: session.propertyId,
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const payments = entries
      .filter((e) => Number(e.amount) < 0)
      .map((e) => ({
        id: e.id,
        type: e.type,
        amount: Math.abs(Number(e.amount || 0)),
        method: e.method || "UNKNOWN",
        reference: e.reference || null,
        note: e.note || null,
        effectiveDate: e.effectiveDate,
        createdAt: e.createdAt,
      }));

    return NextResponse.json({
      ok: true,
      payments,
    });
  } catch (error) {
    console.error("tenant payment-history GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}