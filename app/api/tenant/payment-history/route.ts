import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

type PaymentHistoryEntry = {
  id: string;
  entryType: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  memo: string | null;
  amount: number;
  effectiveDate: Date;
  createdAt: Date;
};

export async function GET() {
  try {
    const session = await requireRole("TENANT");

    if (!session.unitId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        unitId: session.unitId,
        propertyId: session.propertyId,
        entryType: "PAYMENT",
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const payments = (entries as PaymentHistoryEntry[])
      .filter((e: PaymentHistoryEntry) => Number(e.amount) < 0)
      .map((e: PaymentHistoryEntry) => ({
        id: e.id,
        type: e.entryType,
        amount: Math.abs(Number(e.amount || 0)),
        method: e.paymentMethod || "UNKNOWN",
        reference: e.referenceNumber || null,
        note: e.memo || null,
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