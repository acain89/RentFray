import { EMAIL_FROM, resend } from "@/lib/resend";

export async function sendRepresentativeRecoveryEmail(input: { email: string; token: string }): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(input.token)) throw new Error("Invalid representative recovery token.");
  const url = `https://www.rentfray.com/login/representative/reset-password#token=${input.token}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: input.email,
    subject: "Reset your RentFray representative password",
    text: `Reset your representative password: ${url}\nThis link expires in 30 minutes and can be used once. Only the latest link works. If you did not request this, ignore this email.\n\nAfter setting your password, you can sign in anytime at https://www.rentfray.com/login/representative.`,
  });
  if (error) throw new Error("Representative recovery email delivery failed.");
}
