// app/api/manager/property/qr/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildPropertyLink, buildQRCodeUrl } from "@/lib/qr";

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("rf_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);

    if (session.role !== "MANAGER" || !session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const property = await prisma.property.findUnique({
      where: { id: session.propertyId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const link = buildPropertyLink(property.code);
    const qrUrl = buildQRCodeUrl(property.code);

    return NextResponse.json({
      ok: true,
      propertyName: property.name,
      propertyCode: property.code,
      link,
      qrUrl,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to generate QR" },
      { status: 500 }
    );
  }
}