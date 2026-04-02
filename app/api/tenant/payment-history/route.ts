import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PaymentStatus } from "@prisma/client";

type TenantPaymentHistoryItem = {
  id: string;
  type: string;
  amountCents: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  billingCycle: string | null;
  effectiveDate: Date;
  createdAt: Date;
  paidAt: Date | null;
  status: PaymentStatus | null;
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
        voidedAt: null,
        payment: {
          is: {
            status: PaymentStatus.PAID,
          },
        },
      },
      include: {
        payment: {
          select: {
            id: true,
            status: true,
            paidAt: true,
            paymentMethod: true,
            referenceNumber: true,
            memo: true,
            billingCycle: true,
            amountCents: true,
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const payments: TenantPaymentHistoryItem[] = entries
      .filter((entry: (typeof entries)[number]) => entry.amountCents < 0)
      .map((entry: (typeof entries)[number]) => {
        const payment = entry.payment;

        return {
          id: entry.id,
          type: entry.entryType,
          amountCents: Math.abs(entry.amountCents),
          method: payment?.paymentMethod ?? entry.paymentMethod ?? null,
          reference: payment?.referenceNumber ?? entry.referenceNumber ?? null,
          note: payment?.memo ?? entry.memo ?? null,
          billingCycle: payment?.billingCycle ?? entry.billingCycle ?? null,
          effectiveDate: entry.effectiveDate,
          createdAt: entry.createdAt,
          paidAt: payment?.paidAt ?? null,
          status: payment?.status ?? null,
        };
      });

    return NextResponse.json({
      ok: true,
      payments,
    });
  } catch (error) {
    console.error("tenant payment-history GET error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}