import { NextResponse } from "next/server";
import { runMonthlyRentJob } from "@/jobs/monthlyRent";

type ApiSuccess = {
  ok: true;
};

type ApiError = {
  ok: false;
  error: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    if (!cronSecret) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "CRON_SECRET is not configured." },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await runMonthlyRentJob();

    return NextResponse.json<ApiSuccess>({
      ok: true,
    });
  } catch (error: unknown) {
    console.error("POST /api/cron/monthly-rent error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to run monthly rent job." },
      { status: 500 }
    );
  }
}