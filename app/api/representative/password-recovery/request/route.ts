import { NextResponse } from "next/server";
import { issueRepresentativeRecovery, representativeEmailInput, REPRESENTATIVE_RECOVERY_MESSAGE } from "@/lib/representativeAuth";
import { admitRepresentativeAuth } from "@/lib/representativeThrottle";
import { readRepresentativeBody, representativePrivateHeaders as headers, representativeSameOrigin } from "@/lib/representativeSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!representativeSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const email = representativeEmailInput((await readRepresentativeBody(request))?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers });
  try {
    const admission = await admitRepresentativeAuth("request", email);
    if (admission.admitted) {
      const issued = await issueRepresentativeRecovery(email);
      if (issued) {
        try {
          const { sendRepresentativeRecoveryEmail } = await import("@/lib/representativeEmail");
          await sendRepresentativeRecoveryEmail(issued);
        } catch { console.error("REPRESENTATIVE_RECOVERY_DELIVERY_FAILED"); }
      }
    }
    return NextResponse.json({ ok: true, message: REPRESENTATIVE_RECOVERY_MESSAGE }, { headers });
  } catch { return NextResponse.json({ error: "Password recovery is temporarily unavailable." }, { status: 503, headers }); }
}
