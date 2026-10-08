import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageFinancials } from "@/lib/permissions";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || !session.propertyId || !canManageFinancials(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: !session ? 401 : 403 });
    }

    return NextResponse.json(
      { error: "Manual payment connection status updates are retired. Connection state is managed by Stripe reconciliation." },
      { status: 410 }
    );
  } catch (error: unknown) {
    console.error("POST set-payment-status error:", error);

    return NextResponse.json(
      { error: "Failed to update payment status" },
      { status: 500 }
    );
  }
}
