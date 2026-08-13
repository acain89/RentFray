import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendVerificationBody = {
  email?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {

const ip =
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip") ||
  "unknown";

const rateLimit = checkRateLimit(
  `resend-verification:${ip}`,
  5,
  60_000
);

if (!rateLimit.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: "Too many requests. Please wait a minute and try again.",
    },
    {
      status: 429,
    }
  );
}
    const body = (await req.json()) as ResendVerificationBody;
    const email = clean(body.email).toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email address is required.",
        },
        {
          status: 400,
        }
      );
    }

const emailRateLimit = checkRateLimit(
  `resend-verification-email:${email}`,
  5,
  15 * 60_000
);

if (!emailRateLimit.ok) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Too many verification emails have been requested. Please wait 15 minutes and try again.",
    },
    {
      status: 429,
    }
  );
}

    const manager = await prisma.managementUser.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        isActive: true,
      },
    });

    if (!manager || !manager.email) {
      return NextResponse.json({
        ok: true,
      });
    }

    if (manager.emailVerifiedAt) {
      return NextResponse.json({
        ok: true,
      });
    }

    await sendVerificationEmail({
      managementUserId: manager.id,
      email: manager.email,
      displayName: manager.displayName,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Resend verification email failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not resend verification email.",
      },
      {
        status: 500,
      }
    );
  }
}