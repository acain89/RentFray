import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        propertyCode: property.propertyCode,
        status: property.status,
      },
      paymentStatus: property.paymentStatus,
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/properties/[id]/payment-status error:", error);
    return NextResponse.json(
      { error: "Failed to load payment status" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Manual payment connection status updates are retired. Connection state is managed by Stripe reconciliation." },
      { status: 410 }
    );
  } catch (error: unknown) {
    console.error("POST /api/admin/properties/[id]/payment-status error:", error);
    return NextResponse.json(
      { error: "Failed to save payment status" },
      { status: 500 }
    );
  }
}