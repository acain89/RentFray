import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, resend } from "@/lib/resend";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not configured.");
  }

  return baseUrl.replace(/\/+$/, "");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(
  managementUserId: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        managementUserId,
        usedAt: null,
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        managementUserId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return token;
}

export async function sendVerificationEmail(input: {
  managementUserId: string;
  email: string;
  displayName?: string | null;
}): Promise<void> {
  const token = await createEmailVerificationToken(input.managementUserId);

  const verificationUrl = `${getBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(
    token
  )}`;

  const name = input.displayName?.trim() || "there";

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: input.email,
    subject: "Verify your RentFray email",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#0f172a;">
        <h1 style="font-size:28px;margin:0 0 16px;">Verify your email</h1>

        <p style="font-size:16px;line-height:1.6;">
          Hi ${escapeHtml(name)},
        </p>

        <p style="font-size:16px;line-height:1.6;">
          Confirm your email address to finish creating your RentFray manager account.
        </p>

        <p style="margin:32px 0;">
          <a
            href="${verificationUrl}"
            style="display:inline-block;background:#233143;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;"
          >
            Verify Email
          </a>
        </p>

        <p style="font-size:14px;line-height:1.6;color:#64748b;">
          This verification link expires in 24 hours.
        </p>

        <p style="font-size:14px;line-height:1.6;color:#64748b;">
          If you did not create a RentFray account, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend verification email failed: ${error.message}`);
  }
}

export async function sendWelcomeEmail(input: {
  email: string;
  displayName?: string | null;
  propertyName: string;
  propertyCode: string;
}): Promise<void> {
  const loginUrl = `${getBaseUrl()}/manager/login`;
  const name = input.displayName?.trim() || "there";

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: input.email,
    subject: "Welcome to RentFray",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#0f172a;">
        <h1 style="font-size:28px;margin:0 0 16px;">Welcome to RentFray</h1>

        <p style="font-size:16px;line-height:1.6;">
          Hi ${escapeHtml(name)},
        </p>

        <p style="font-size:16px;line-height:1.6;">
          Your RentFray manager account is verified and ready to use.
        </p>

        <div style="margin:32px 0;padding:24px;border:1px solid #cbd5e1;border-radius:16px;background:#f8fafc;text-align:center;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#64748b;text-transform:uppercase;">
            Property Code
          </div>

          <div style="font-size:42px;font-weight:800;letter-spacing:0.08em;margin-top:8px;color:#0f172a;">
            ${escapeHtml(input.propertyCode)}
          </div>
        </div>

        <p style="font-size:16px;line-height:1.6;">
          Property: <strong>${escapeHtml(input.propertyName)}</strong>
        </p>

        <p style="margin:32px 0;">
          <a
            href="${loginUrl}"
            style="display:inline-block;background:#233143;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;"
          >
            Manager Login
          </a>
        </p>

        <p style="font-size:14px;line-height:1.6;color:#64748b;">
          Keep your Property Code somewhere easy to find. Managers, tenants, and maintenance users may need it to access your property's RentFray account.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend welcome email failed: ${error.message}`);
  }
}

export function hashEmailVerificationToken(token: string): string {
  return hashToken(token);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}