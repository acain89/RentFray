import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateAccountPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildDisplayName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

async function generateUniquePropertyCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const propertyCode = String(
      Math.floor(1000 + Math.random() * 9000)
    );

    const existingProperty = await tx.property.findUnique({
      where: {
        propertyCode,
      },
      select: {
        id: true,
      },
    });

    if (!existingProperty) {
      return propertyCode;
    }
  }

  throw new Error("Could not generate a unique property code.");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateAccountPayload;

    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const email = clean(body.email).toLowerCase();
    const password = clean(body.password);
    const displayName = buildDisplayName(firstName, lastName);

    if (!firstName) {
      return NextResponse.json(
        {
          ok: false,
          error: "First name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!lastName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Last name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: "Password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const existingManager = await prisma.managementUser.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            username: email,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingManager) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account with that email already exists.",
        },
        {
          status: 409,
        }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const propertyCode = await generateUniquePropertyCode(tx);

        const property = await tx.property.create({
          data: {
            name: "My Property",
            propertyCode,
            status: "SETUP",
            unitCount: 0,
            isActive: true,
            ownerDisplayName: displayName,
            contactEmail: email,
          },
          select: {
            id: true,
            propertyCode: true,
          },
        });

        const manager = await tx.managementUser.create({
          data: {
            propertyId: property.id,
            role: "OWNER",
            email,
            username: email,
            passwordHash,
            displayName,
            isActive: false,
          },
          select: {
            id: true,
          },
        });

        await tx.propertySettings.create({
          data: {
            propertyId: property.id,
            onboardingComplete: false,
            setupComplete: false,
          },
        });

        await tx.paymentConnectionStatus.create({
          data: {
            propertyId: property.id,
          },
        });

        return {
          propertyId: property.id,
          propertyCode: property.propertyCode,
          managementUserId: manager.id,
        };
    },
  {
    maxWait: 10_000,
    timeout: 20_000,
  }
);

let verificationEmailSent = true;

try {
  await sendVerificationEmail({
    managementUserId: result.managementUserId,
    email,
    displayName,
  });
} catch (error) {
  verificationEmailSent = false;
  console.error("Initial verification email failed:", error);
}

return NextResponse.json({
  ok: true,
  propertyId: result.propertyId,
  propertyCode: result.propertyCode,
  verificationEmailSent,
  redirectTo: `/verify-email?email=${encodeURIComponent(
    email
  )}&sent=${verificationEmailSent ? "1" : "0"}`,
});
  } catch (error) {
    console.error("Create manager account failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not create your account.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}