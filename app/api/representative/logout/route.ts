import { NextResponse } from "next/server";
import { revokeRepresentativeSessions } from "@/lib/representativeAuth";
import { clearRepresentativeSession, getRepresentativeSession, representativePrivateHeaders as headers, representativeSameOrigin } from "@/lib/representativeSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!representativeSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  try {
    const session = await getRepresentativeSession();
    if (session) await revokeRepresentativeSessions(session);
    await clearRepresentativeSession();
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "Sign-out is temporarily unavailable." }, { status: 503, headers }); }
}
