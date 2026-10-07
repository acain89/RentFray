import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  hashEmailVerificationToken,
  sendWelcomeEmail,
} from "@/lib/email";
import { createSessionToken, createManagementCredentialBinding, setSessionCookie } from "@/lib/session";

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

    const manager = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serialize verification with ordinary management-user disable/update.
      await tx.$queryRaw`SELECT "id" FROM "ManagementUser" WHERE "id" = ${verification.managementUserId} FOR UPDATE`;
      const current = await tx.managementUser.findUnique({
        where: { id: verification.managementUserId },
        select: { id: true, role: true, email: true, displayName: true, emailVerifiedAt: true, passwordHash: true,
          isActive: true, propertyId: true, property: { select: { name: true, propertyCode: true } } },
      });
      const currentToken = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
      if (!current || !current.email || !["OWNER", "MANAGER", "STAFF"].includes(current.role) ||
          (current.role !== "OWNER" && !current.isActive) || !currentToken || currentToken.usedAt ||
          currentToken.expiresAt.getTime() <= Date.now() || currentToken.managementUserId !== current.id) {
        return null;
      }
      const verifiedAt = new Date();
      await tx.managementUser.update({ where: { id: current.id },
        data: { emailVerifiedAt: current.emailVerifiedAt ?? verifiedAt, isActive: true } });
      await tx.emailVerificationToken.update({ where: { id: currentToken.id }, data: { usedAt: verifiedAt } });
      await tx.emailVerificationToken.updateMany({
        where: { managementUserId: current.id, id: { not: currentToken.id }, usedAt: null },
        data: { usedAt: verifiedAt },
      });
      return current;
    });
    if (!manager) {
      return NextResponse.redirect(`${getBaseUrl()}/verify-email?status=invalid`);
    }

    const tokenSession = createSessionToken({
      role: manager.role as "OWNER" | "MANAGER" | "STAFF",
      propertyId: manager.propertyId,
      managementUserId: manager.id,
      managementCredentialBinding: createManagementCredentialBinding(manager.id, manager.passwordHash),
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
