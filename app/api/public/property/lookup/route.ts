import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isFourDigitCode(value: string) {
  return /^\d{4}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim();

    if (!isFourDigitCode(code)) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    const property = await prisma.property.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        name: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    if (property.status !== "READY" && property.status !== "LIVE") {
      return NextResponse.json(
        { error: "Property not available yet." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        code: property.code,
        name: property.name,
        status: property.status,
      },
    });
  } catch (error) {
    console.error("POST /api/public/property/lookup failed", error);
    return NextResponse.json(
      { error: "Lookup failed." },
      { status: 500 }
    );
  }
}