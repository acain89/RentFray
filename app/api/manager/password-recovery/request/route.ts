import { NextResponse } from "next/server";
import { admitPasswordRecoveryRequest } from "@/lib/authThrottle";
import { sendPasswordRecoveryEmail } from "@/lib/email";
import { issuePasswordRecovery, readRecoveryBody, recoveryAccountInput, recoverySameOrigin, RECOVERY_CONFIRMATION } from "@/lib/managementPasswordRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  if (!recoverySameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const input = recoveryAccountInput(await readRecoveryBody(request));
  if (!input) return NextResponse.json({ error: "Enter a valid email address and property code." }, { status: 400, headers });
  try {
    const admitted = await admitPasswordRecoveryRequest(input.email, input.propertyCode);
    // A scoped throttle rejection must not distinguish account eligibility.
    if (admitted.admitted) {
      const issued = await issuePasswordRecovery(input.email, input.propertyCode);
      if (issued) {
        try { await sendPasswordRecoveryEmail(issued); }
        catch { console.error("PASSWORD_RECOVERY_DELIVERY_FAILED"); }
      }
    }
    return NextResponse.json({ ok: true, message: RECOVERY_CONFIRMATION }, { headers });
  } catch {
    console.error("PASSWORD_RECOVERY_REQUEST_UNAVAILABLE");
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Please try again later." }, { status: 503, headers });
  }
}
