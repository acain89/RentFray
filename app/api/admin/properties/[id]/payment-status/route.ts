import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function clean(value: unknown) {
  return String(value || "").trim();
}

function toBool(value: unknown) {
  return value === true || value === "true" || value === "1";
}

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
        code: true,
        status: true,
        paymentConnectionStatus: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      property,
      paymentStatus: property.paymentConnectionStatus,
    });
  } catch (error) {
    console.error("GET /api/admin/properties/[id]/payment-status error:", error);
    return NextResponse.json({ error: "Failed to load payment status" }, { status: 500 });
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

    const { id } = await params;
    const body = await req.json();

    const stripeConnected = toBool(body.stripeConnected);
    const achEnabled = toBool(body.achEnabled);
    const onboardingComplete = toBool(body.onboardingComplete);
    const adminApproved = toBool(body.adminApproved);
    const notes = clean(body.notes) || null;

    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const paymentStatus = await prisma.paymentConnectionStatus.upsert({
      where: { propertyId: id },
      update: {
        stripeConnected,
        achEnabled,
        onboardingComplete,
        adminApproved,
        notes,
      },
      create: {
        propertyId: id,
        stripeConnected,
        achEnabled,
        onboardingComplete,
        adminApproved,
        notes,
      },
    });

    const readyForLive =
      stripeConnected && achEnabled && onboardingComplete && adminApproved;

    await prisma.auditLog.create({
      data: {
        propertyId: id,
        actorRole: "ADMIN",
        actorLabel: session.adminAccessId || "admin",
        action: "PAYMENT_STATUS_UPDATED",
        entityType: "PROPERTY",
        entityId: id,
        notes: JSON.stringify({
          stripeConnected,
          achEnabled,
          onboardingComplete,
          adminApproved,
          readyForLive,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      paymentStatus,
      readyForLive,
    });
  } catch (error) {
    console.error("POST /api/admin/properties/[id]/payment-status error:", error);
    return NextResponse.json({ error: "Failed to save payment status" }, { status: 500 });
  }
}