import { EMAIL_FROM, resend } from "@/lib/resend";
import type { RepresentativePasswordLink } from "./representativeAuth";

export async function sendRepresentativeRecoveryEmail(input: Pick<RepresentativePasswordLink, "email" | "token"> & Partial<Pick<RepresentativePasswordLink, "purpose">>): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(input.token)) throw new Error("Invalid representative recovery token.");
  const url = `https://www.rentfray.com/login/representative/reset-password#token=${input.token}`;
  const activation = input.purpose === "ACTIVATION";
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: input.email,
    subject: activation ? "Activate your RentFray representative account" : "Reset your RentFray representative password",
    text: `${activation ? "Activate your representative account and set your password" : "Reset your representative password"}: ${url}\nThis link expires in ${activation ? "7 days (168 hours)" : "30 minutes"} and can be used once. Only the latest link works. If you did not request this, ignore this email.\n\nAfter setting your password, you can sign in anytime at https://www.rentfray.com/login/representative.`,
  });
  if (error) throw new Error("Representative recovery email delivery failed.");
}
