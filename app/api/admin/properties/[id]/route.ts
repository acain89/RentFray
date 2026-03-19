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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = String(params.id || "");
    if (!id) {
      return NextResponse.json({ error: "Missing property id." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = validateInput(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Ensure property exists
    const existing = await prisma.property.findUnique({
      where: { id },
      select: { id: true, code: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    // If code changed → enforce uniqueness
    if (parsed.value.code !== existing.code) {
      const codeTaken = await prisma.property.findUnique({
        where: { code: parsed.value.code },
        select: { id: true },
      });

      if (codeTaken) {
        return NextResponse.json(
          { error: "Property code already exists." },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.property.update({
      where: { id },
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

    return NextResponse.json({ ok: true, property: updated });
  } catch (error) {
    console.error("PATCH /api/admin/properties/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update property." },
      { status: 500 }
    );
  }
}