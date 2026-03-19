import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PropertyStatus = "PREVIEW" | "READY" | "LIVE";
type LateFeeType = "FLAT" | "PERCENT";

function isFourDigitCode(value: string) {
  return /^\d{4}$/.test(value);
}

function normalizeStatus(value: unknown): PropertyStatus {
  const v = String(value || "").toUpperCase();
  if (v === "READY") return "READY";
  if (v === "LIVE") return "LIVE";
  return "PREVIEW";
}

function normalizeLateFeeType(value: unknown): LateFeeType {
  const v = String(value || "").toUpperCase();
  if (v === "PERCENT") return "PERCENT";
  return "FLAT";
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toAmount(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function validateInput(body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const code = String(body.code || "").trim();
  const status = normalizeStatus(body.status);
  const billingDay = toInt(body.billingDay, 1);
  const graceDays = toInt(body.graceDays, 0);
  const lateFeeType = normalizeLateFeeType(body.lateFeeType);
  const lateFeeAmount = toAmount(body.lateFeeAmount, 0);

  if (!name) {
    return { error: "Property name is required." };
  }

  if (!isFourDigitCode(code)) {
    return { error: "Property code must be exactly 4 digits." };
  }

  if (billingDay < 1 || billingDay > 31) {
    return { error: "Billing day must be between 1 and 31." };
  }

  if (graceDays < 0 || graceDays > 31) {
    return { error: "Grace days must be between 0 and 31." };
  }

  if (lateFeeAmount < 0) {
    return { error: "Late fee amount cannot be negative." };
  }

  return {
    value: {
      name,
      code,
      status,
      billingDay,
      graceDays,
      lateFeeType,
      lateFeeAmount,
    },
  };
}

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        billingDay: true,
        graceDays: true,
        lateFeeType: true,
        lateFeeAmount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("GET /api/admin/properties failed", error);
    return NextResponse.json(
      { error: "Failed to load properties." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = validateInput(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await prisma.property.findUnique({
      where: { code: parsed.value.code },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Property code already exists." },
        { status: 409 }
      );
    }

    const property = await prisma.property.create({
      data: {
        name: parsed.value.name,
        code: parsed.value.code,
        status: parsed.value.status,
        billingDay: parsed.value.billingDay,
        graceDays: parsed.value.graceDays,
        lateFeeType: parsed.value.lateFeeType,
        lateFeeAmount: parsed.value.lateFeeAmount,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        billingDay: true,
        graceDays: true,
        lateFeeType: true,
        lateFeeAmount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, property });
  } catch (error) {
    console.error("POST /api/admin/properties failed", error);
    return NextResponse.json(
      { error: "Failed to create property." },
      { status: 500 }
    );
  }
}