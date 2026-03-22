// app/api/property/resolve/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(
      body.code ?? body.propertyCode ?? ""
    ).trim();

    if (!/^\d{4,5}$/.test(propertyCode)) {
      return NextResponse.json(
        { error: "Valid 4 or 5 digit property code required" },
        { status: 400 }
      );
    }

    const property = await prisma.property.findFirst({
      where: { propertyCode },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        isActive: true,
      },
    });

    if (!property || !property.isActive) {
      return NextResponse.json(
        { error: "Invalid property code" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        propertyCode: property.propertyCode,
      },
    });
  } catch (err) {
    console.error("PROPERTY_RESOLVE_ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}