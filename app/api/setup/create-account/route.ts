import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { attributeCreator, REFERRAL_COOKIE, referralCookieOptions } from "@/lib/creatorReferrals";
import { attributeRepresentative, readRepresentativeReferral, REPRESENTATIVE_COOKIE, representativeCookieOptions } from "@/lib/representativeReferrals";
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

class RegistrationConflictError extends Error {
  constructor() { super("An account with that email already exists."); }
}

function logSignupFailure(stage: "account_creation" | "verification_email", error: unknown): void {
  const code = typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && /^(P[0-9]{4}|40001|40P01|55P03)$/.test(error.code)
    ? error.code : undefined;
  console.error("Public signup failed:", { stage, category: code ? "DATABASE_ERROR" : "UNEXPECTED_ERROR", ...(code ? { code } : {}) });
}

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

    const passwordHash = await bcrypt.hash(password, 12);
    const referralCookie = (await cookies()).get(REFERRAL_COOKIE)?.value;
    const representativeTouch = readRepresentativeReferral((await cookies()).get(REPRESENTATIVE_COOKIE)?.value);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Two-integer keys occupy a separate advisory-lock space from existing
        // single-key property/tenancy locks. Read the identity only after waiting.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"public-registration"}), hashtext(${email}))`;
        const existingManager = await tx.managementUser.findFirst({
          where: { OR: [{ email }, { username: email }] },
          select: { id: true },
        });
        if (existingManager) throw new RegistrationConflictError();

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
            name: true,
            createdAt: true,
          },
        });

        const attributed = await attributeCreator(tx, referralCookie, property);
        const representativeAttributed = await attributeRepresentative(tx, representativeTouch, property, "RENTFRAY");

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
          attributed,
          representativeAttributed,
          managementUserId: manager.id,
        };
    },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
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
  propertyCode: result.propertyCode,
});
} catch (error) {
  verificationEmailSent = false;
  logSignupFailure("verification_email", error);
}

const response = NextResponse.json({
  ok: true,
  propertyId: result.propertyId,
  propertyCode: result.propertyCode,
  verificationEmailSent,
  redirectTo: `/verify-email?email=${encodeURIComponent(
    email
  )}&sent=${verificationEmailSent ? "1" : "0"}`,
});
if (result.attributed) response.cookies.set(REFERRAL_COOKIE, "", { ...referralCookieOptions, maxAge: 0 });
if (result.representativeAttributed) response.cookies.set(REPRESENTATIVE_COOKIE, "", { ...representativeCookieOptions, maxAge: 0 });
return response;
  } catch (error) {
    if (error instanceof RegistrationConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    logSignupFailure("account_creation", error);
    const message = "Could not create your account.";

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