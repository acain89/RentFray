import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { admitPasswordRecoveryRedemption } from "@/lib/authThrottle";
import { readRecoveryBody, recoveryPasswordInput, recoverySameOrigin, redeemPasswordRecovery } from "@/lib/managementPasswordRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  if (!recoverySameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const input = recoveryPasswordInput(await readRecoveryBody(request));
  if (!input) return NextResponse.json({ error: "Use a valid reset link and matching passwords of at least 8 characters and at most 72 UTF-8 bytes." }, { status: 400, headers });
  try {
    const admitted = await admitPasswordRecoveryRedemption(input.token);
    if (!admitted.admitted) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers });
    const result = await redeemPasswordRecovery(input.token, input.password);
    if (!result) return NextResponse.json({ error: "This reset link is invalid or expired. Please request a new link." }, { status: 400, headers });
    await clearSessionCookie();
    return NextResponse.json({ ok: true, redirectTo: `/login/manager?code=${encodeURIComponent(result.propertyCode)}` }, { headers });
  } catch {
    console.error("PASSWORD_RECOVERY_REDEMPTION_UNAVAILABLE");
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Please try again later." }, { status: 503, headers });
  }
}
