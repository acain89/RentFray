// app/api/admin/session/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid admin code." },
        { status: 400 }
      );
    }

    const adminAccess = await prisma.adminAccess.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeHash: true,
      },
    });

    if (!adminAccess) {
      return NextResponse.json(
        { error: "Admin access is not configured." },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(code, adminAccess.codeHash);

    if (!ok) {
      return NextResponse.json(
        { error: "Invalid admin code." },
        { status: 401 }
      );
    }

    const token = createSessionToken({ role: "ADMIN" });
    await setSessionCookie(token);

    await prisma.adminAccess.update({
      where: { id: adminAccess.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({ ok: true, role: "ADMIN" });
  } catch (error) {
    console.error("POST /api/admin/session failed", error);

    return NextResponse.json(
      { error: "Admin login failed." },
      { status: 500 }
    );
  }
}