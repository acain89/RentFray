
import assert from "node:assert/strict";



import { resolve } from "node:path";






export function assertApprovedRecoveryEmailChange(before: string, after: string): void {
  if (before === after) return;
  const addition = "export async function sendPasswordRecoveryEmail(input: { email: string; token: string }): Promise<void> {\n  const origin = process.env.NODE_ENV === \"production\" ? \"https://www.rentfray.com\" : getBaseUrl();\n  const url = new URL(origin);\n  if (process.env.NODE_ENV !== \"production\" && ![\"localhost\", \"127.0.0.1\", \"[::1]\"].includes(url.hostname)) {\n    throw new Error(\"Invalid recovery email configuration.\");\n  }\n  const resetUrl = `${url.origin}/login/manager/reset-password#token=${encodeURIComponent(input.token)}`;\n  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: input.email,\n    subject: \"Reset your RentFray password\", html: `<p>A password reset was requested for your RentFray management account.</p><p><a href=\"${escapeHtml(resetUrl)}\">Reset password</a></p><p>This link expires in 30 minutes. Only the latest link can be used. If you did not request this, ignore this email.</p>` });\n  if (error) throw new Error(\"Password recovery email delivery failed.\");\n}\n\n";
  assert.equal(after.split(addition).length, 2, "Exactly one approved reset email function");
  assert.equal(after.replace(addition, ""), before, "All verification-email behavior preserved");
}

export const root = resolve(__dirname, "..");
