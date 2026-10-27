import { NextResponse } from "next/server";
import { authenticateRepresentative, representativeEmailInput, representativePasswordInput } from "@/lib/representativeAuth";
import { admitRepresentativeAuth } from "@/lib/representativeThrottle";
import { createRepresentativeSessionToken, getRepresentativeSession, readRepresentativeBody, representativePrivateHeaders as headers,
  representativeSameOrigin, setRepresentativeSession } from "@/lib/representativeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getRepresentativeSession();
    return session ? NextResponse.json({ authenticated: true, displayName: session.displayName }, { headers }) :
      NextResponse.json({ error: "Please sign in." }, { status: 401, headers });
  } catch { return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!representativeSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const body = await readRepresentativeBody(request), email = representativeEmailInput(body?.email);
  if (!body || !email || !representativePasswordInput(body.password)) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400, headers });
  try {
    const admission = await admitRepresentativeAuth("login", email);
    if (!admission.admitted) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { ...headers, "Retry-After": String(admission.retryAfter) } });
    const session = await authenticateRepresentative(email, body.password);
    if (!session) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers });
    await setRepresentativeSession(createRepresentativeSessionToken(session.id, session.sessionVersion));
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503, headers }); }
}
