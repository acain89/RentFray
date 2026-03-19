import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const propertyCode = String(body.propertyCode || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!propertyCode || propertyCode.length !== 4) {
      return NextResponse.json(
        { error: "Invalid property code." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email required." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password required." },
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

    const manager = await prisma.manager.findFirst({
      where: {
        email,
        propertyId: property.id,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!manager) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // TODO: replace with real hash verify (bcrypt/scrypt)
    if (manager.passwordHash !== password) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // simple session response (no auth system yet)
    return NextResponse.json({
      ok: true,
      managerId: manager.id,
      propertyId: property.id,
    });
  } catch (error) {
    console.error("POST /api/manager/session failed", error);
    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}