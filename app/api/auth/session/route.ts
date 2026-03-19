// app/api/auth/session/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifySessionToken } from "@/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rf_session")?.value;

    if (!token) {
      return NextResponse.json({ ok: false, user: null });
    }

    const payload = verifySessionToken(token);

    if (!payload) {
      return NextResponse.json({ ok: false, user: null });
    }

    return NextResponse.json({
      ok: true,
      user: {
        role: payload.role,
        propertyId: payload.propertyId,
        unitId: payload.unitId || null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, user: null });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const role = String(body.role || "").toUpperCase();
    const propertyCode = String(body.propertyCode || "").trim();
    const unitNumber = String(body.unitNumber || "").trim();
    const pin = String(body.pin || "").trim();

    if (!role || !propertyCode) {
      return NextResponse.json(
        { error: "Missing role or property code" },
        { status: 400 }
      );
    }

    const property = await prisma.property.findFirst({
      where: { code: propertyCode },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Invalid property code" },
        { status: 400 }
      );
    }

    let sessionPayload: {
      role: string;
      propertyId: string;
      unitId?: string;
    } | null = null;

    // TENANT LOGIN
    if (role === "TENANT") {
      if (!unitNumber || !pin) {
        return NextResponse.json(
          { error: "Missing unit number or PIN" },
          { status: 400 }
        );
      }

      const unit = await prisma.unit.findFirst({
        where: {
          propertyId: property.id,
          unitNumber,
        },
        include: {
          assignments: {
            where: { moveOut: null },
            include: { tenant: true },
          },
        },
      });

      const active = unit?.assignments?.[0];

      if (!unit || !active || !active.tenant) {
        return NextResponse.json(
          { error: "Invalid unit or tenant" },
          { status: 400 }
        );
      }

      if (active.tenant.pin !== pin) {
        return NextResponse.json(
          { error: "Invalid PIN" },
          { status: 400 }
        );
      }

      sessionPayload = {
        role: "TENANT",
        propertyId: property.id,
        unitId: unit.id,
      };
    }

    // MANAGER LOGIN
    if (role === "MANAGER") {
      const managerPin = process.env.MANAGER_PIN || "1234";

      if (pin !== managerPin) {
        return NextResponse.json(
          { error: "Invalid manager PIN" },
          { status: 400 }
        );
      }

      sessionPayload = {
        role: "MANAGER",
        propertyId: property.id,
      };
    }

    // MAINTENANCE LOGIN
    if (role === "MAINTENANCE") {
      const maintenancePin = process.env.MAINTENANCE_PIN || "1234";

      if (pin !== maintenancePin) {
        return NextResponse.json(
          { error: "Invalid maintenance PIN" },
          { status: 400 }
        );
      }

      sessionPayload = {
        role: "MAINTENANCE",
        propertyId: property.id,
      };
    }

    if (!sessionPayload) {
      return NextResponse.json(
        { error: "Invalid login" },
        { status: 400 }
      );
    }

    const token = createSessionToken(sessionPayload);

    const res = NextResponse.json({ ok: true });

    res.cookies.set("rf_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set("rf_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return res;
}