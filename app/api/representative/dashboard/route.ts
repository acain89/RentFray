import { NextResponse } from "next/server";
import { getRepresentativeSession, representativePrivateHeaders as headers } from "@/lib/representativeSession";
import { getRepresentativeDashboard, RepresentativeReportInputError } from "@/lib/representativeReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const session = await getRepresentativeSession();
    if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers });
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => !["businessCursor", "payoutCursor", "monthBefore"].includes(key))) {
      return NextResponse.json({ error: "Invalid report parameters." }, { status: 400, headers });
    }
    const report = await getRepresentativeDashboard(session.id, {
      businessCursor: query.get("businessCursor") ?? undefined, payoutCursor: query.get("payoutCursor") ?? undefined, monthBefore: query.get("monthBefore") ?? undefined,
    });
    return NextResponse.json(report, { headers });
  } catch (error) {
    if (error instanceof RepresentativeReportInputError) return NextResponse.json({ error: "Invalid report parameters." }, { status: 400, headers });
    return NextResponse.json({ error: "Your report is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
