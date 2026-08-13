import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  hashEmailVerificationToken,
  sendWelcomeEmail,
} from "@/lib/email";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not configured.");
  }

  return baseUrl.replace(/\/+$/, "");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.redirect(
        `${getBaseUrl()}/verify-email?status=invalid`
      );
    }

    const tokenHash = hashEmailVerificationToken(token);

    const verification = await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        managementUserId: true,
        expiresAt: true,
        usedAt: true,
        managementUser: {
          select: {
            id: true,
            role: true,
            email: true,
            displayName: true,
            emailVerifiedAt: true,
            propertyId: true,
            property: {
              select: {
                name: true,
                propertyCode: true,
              },
            },
          },
        },
      },
    });

    if (
      !verification ||
      verification.usedAt ||
      verification.expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.redirect(
        `${getBaseUrl()}/verify-email?status=invalid`
      );
    }

    const manager = verification.managementUser;

    if (!manager.email) {
      return NextResponse.redirect(
        `${getBaseUrl()}/verify-email?status=invalid`
      );
    }

    const verifiedAt = new Date();

    await prisma.$transaction([
      prisma.managementUser.update({
        where: {
          id: manager.id,
        },
        data: {
          emailVerifiedAt: manager.emailVerifiedAt ?? verifiedAt,
          isActive: true,
        },
      }),
      prisma.emailVerificationToken.update({
        where: {
          id: verification.id,
        },
        data: {
          usedAt: verifiedAt,
        },
      }),
      prisma.emailVerificationToken.updateMany({
        where: {
          managementUserId: manager.id,
          id: {
            not: verification.id,
          },
          usedAt: null,
        },
        data: {
          usedAt: verifiedAt,
        },
      }),
    ]);

    const tokenSession = createSessionToken({
      role: manager.role as "OWNER" | "MANAGER" | "STAFF",
      propertyId: manager.propertyId,
      managementUserId: manager.id,
    });

    await setSessionCookie(tokenSession);

    try {
      await sendWelcomeEmail({
        email: manager.email,
        displayName: manager.displayName,
        propertyName: manager.property.name,
        propertyCode: manager.property.propertyCode,
      });
    } catch (error) {
      console.error("Welcome email failed after verification:", error);
    }

    return NextResponse.redirect(
      `${getBaseUrl()}/manager/dashboard?verified=1`
    );
  } catch (error) {
    console.error("Verify email failed:", error);

    return NextResponse.redirect(
      `${getBaseUrl()}/verify-email?status=error`
    );
  }
}