import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/pin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const unitNumber = String(body.unitNumber || "").trim().toUpperCase();
    const pin = String(body.pin || "").trim();

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!unitNumber) {
      return NextResponse.json(
        { error: "Unit number required." },
        { status: 400 }
      );
    }

    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "Invalid PIN." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { code: propertyCode },
      select: { id: true, status: true },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    if (property.status !== "READY" && property.status !== "LIVE") {
      return NextResponse.json(
        { error: "Property not available." },
        { status: 403 }
      );
    }

    const unit = await prisma.unit.findFirst({
      where: {
        unitNumber,
        propertyId: property.id,
      },
      include: {
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
      },
    });

    if (!unit || unit.assignments.length === 0) {
      return NextResponse.json(
        { error: "No active tenant found." },
        { status: 404 }
      );
    }

    const tenant = unit.assignments[0].tenant;

    const valid = await verifyPin(pin, tenant.pinHash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
    });
  } catch (error) {
    console.error("POST /api/tenant/session failed", error);
    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}