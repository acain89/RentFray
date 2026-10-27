import { NextResponse } from "next/server";
import { isRepresentativeResetToken, redeemRepresentativeRecovery, representativePasswordInput } from "@/lib/representativeAuth";
import { admitRepresentativeAuth } from "@/lib/representativeThrottle";
import { clearRepresentativeSession, readRepresentativeBody, representativePrivateHeaders as headers, representativeSameOrigin } from "@/lib/representativeSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!representativeSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const body = await readRepresentativeBody(request);
  if (!body || !isRepresentativeResetToken(body.token) || !representativePasswordInput(body.password) || body.password !== body.confirmation) {
    return NextResponse.json({ error: "Enter matching passwords of at least 8 characters and a valid reset link." }, { status: 400, headers });
  }
  try {
    const admission = await admitRepresentativeAuth("reset", body.token);
    if (!admission.admitted) return NextResponse.json({ error: "Too many attempts. Request a new link or try again later." }, { status: 429, headers });
    if (!await redeemRepresentativeRecovery(body.token, body.password)) return NextResponse.json({ error: "This reset link is invalid or expired. Request a new link." }, { status: 400, headers });
    await clearRepresentativeSession();
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "Password recovery is temporarily unavailable." }, { status: 503, headers }); }
}
