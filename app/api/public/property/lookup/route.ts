// app/api/public/property/lookup/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessTenantPortal } from "@/lib/liveGating";

function isFourDigitCode(value: string) {
  return /^\d{4}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyCode = String(body.propertyCode || body.code || "").trim();

    if (!isFourDigitCode(propertyCode)) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { propertyCode },
      select: {
        id: true,
        propertyCode: true,
        status: true,
        name: true,
        isActive: true,
      },
    });

    if (!property || !property.isActive) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    // ✅ CENTRALIZED GATING
    if (!canAccessTenantPortal(property)) {
      return NextResponse.json(
        { error: "Property not available yet." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        propertyCode: property.propertyCode,
        name: property.name,
        status: property.status,
      },
    });
  } catch (error) {
    console.error("POST /api/public/property/lookup failed", error);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}