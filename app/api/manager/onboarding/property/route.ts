import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession, refreshSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PropertyType =
  | "MULTIFAMILY"
  | "MOBILE_HOME"
  | "RV_PARK"
  | "SELF_STORAGE"
  | "BHPH"
  | "OTHER";

type UpdatePropertyPayload = {
  name?: unknown;
  propertyType?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizePropertyType(value: unknown): PropertyType {
  const normalized = clean(value).toUpperCase();

  switch (normalized) {
    case "MULTIFAMILY":
    case "MOBILE_HOME":
    case "RV_PARK":
    case "SELF_STORAGE":
    case "BHPH":
      return normalized;
    default:
      return "OTHER";
  }
}

async function getAuthorizedSession() {
  const session = await getSession();

  if (
    !session ||
    !session.propertyId ||
    !["OWNER", "MANAGER"].includes(session.role)
  ) {
    return null;
  }

  await refreshSessionCookie(session);

  return session;
}

export async function GET() {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const property = await prisma.property.findUnique({
      where: {
        id: session.propertyId,
      },
      select: {
        id: true,
        name: true,
        propertyType: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        {
          ok: false,
          error: "Property not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      property,
    });
  } catch (error) {
    console.error("Load onboarding property failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load property information.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body = (await request.json()) as UpdatePropertyPayload;

    const name = clean(body.name);
    const propertyType = normalizePropertyType(body.propertyType);
    const addressLine1 = clean(body.addressLine1);
    const addressLine2 = clean(body.addressLine2);
    const city = clean(body.city);
    const state = clean(body.state).toUpperCase().slice(0, 2);
    const zip = onlyDigits(body.zip).slice(0, 5);

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Property name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!addressLine1) {
      return NextResponse.json(
        {
          ok: false,
          error: "Street address is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!city) {
      return NextResponse.json(
        {
          ok: false,
          error: "City is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (state.length !== 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid two-letter state.",
        },
        {
          status: 400,
        }
      );
    }

    if (zip.length !== 5) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid five-digit ZIP code.",
        },
        {
          status: 400,
        }
      );
    }

    const property = await prisma.property.update({
      where: {
        id: session.propertyId,
      },
      data: {
        name,
        propertyType,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        state,
        zip,
      },
      select: {
        id: true,
        name: true,
        propertyType: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
      },
    });

    return NextResponse.json({
      ok: true,
      property,
    });
  } catch (error) {
    console.error("Save onboarding property failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save property information.",
      },
      {
        status: 500,
      }
    );
  }
}