import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = cookies();

    const session = cookieStore.get("rf_session");

    if (!session) {
      return NextResponse.json({ ok: false });
    }

    const value = JSON.parse(session.value);

    return NextResponse.json({
      ok: true,
      role: value.role,
      propertyId: value.propertyId,
      unitId: value.unitId || null,
      userId: value.userId || null,
    });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      role,
      propertyId,
      unitId,
      userId,
    } = body;

    if (!role || !propertyId) {
      return NextResponse.json(
        { error: "Invalid session payload" },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set("rf_session", JSON.stringify({
      role,
      propertyId,
      unitId: unitId || null,
      userId: userId || null,
    }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set("rf_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return res;
}