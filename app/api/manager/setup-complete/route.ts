import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession, refreshSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiSuccess = {
  ok: true;
  setupCompleteAcknowledgedAt: string;
};

type ApiError = {
  ok: false;
  error: string;
};

export async function POST() {
  try {
    const session = await getSession();

    if (
      !session ||
      (session.role !== "OWNER" && session.role !== "MANAGER") ||
      !session.propertyId
    ) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await refreshSessionCookie(session);

    const property = await prisma.property.update({
      where: {
        id: session.propertyId,
      },
      data: {
        setupCompleteAcknowledgedAt: new Date(),
      },
      select: {
        setupCompleteAcknowledgedAt: true,
      },
    });

    if (!property.setupCompleteAcknowledgedAt) {
      return NextResponse.json<ApiError>(
        {
          ok: false,
          error: "Failed to acknowledge completed setup.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiSuccess>({
      ok: true,
      setupCompleteAcknowledgedAt:
        property.setupCompleteAcknowledgedAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/manager/setup-complete failed:", error);

    return NextResponse.json<ApiError>(
      {
        ok: false,
        error: "Failed to acknowledge completed setup.",
      },
      { status: 500 }
    );
  }
}