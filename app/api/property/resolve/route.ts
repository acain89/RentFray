import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolveRequestBody = {
  code?: string;
  propertyCode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ResolveRequestBody>;
    const propertyCode = String(body.code ?? body.propertyCode ?? "").trim();

    if (!/^\d{4,5}$/.test(propertyCode)) {
      return NextResponse.json(
        { error: "Valid 4 or 5 digit property code required" },
        { status: 400 }
      );
    }

    const property = await prisma.property.findFirst({
  where: {
    propertyCode: {
      equals: propertyCode,
      mode: "insensitive",
    },
  },
  select: {
    id: true,
    name: true,
    propertyCode: true,
  },
});

    if (!property) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 404 }
      );
    }

   const tiers = await prisma.propertyTier.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        baseRentCents: true,
      },
    });

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        name: property.name,
        propertyCode: property.propertyCode,
      },
      tiers,
    });
  } catch (error: unknown) {
    console.error("PROPERTY_RESOLVE_ERROR:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}