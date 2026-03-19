// app/api/property/resolve/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "Property code required" },
        { status: 400 }
      );
    }

    const property = await prisma.property.findFirst({
      where: { code },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Invalid property code" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      property,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}