import { NextResponse } from "next/server";
import { runLateFeesJob } from "@/jobs/lateFees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiError = {
  ok: false;
  error: string;
};

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
    const rawAuth =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";
    const token = rawAuth.replace(/^Bearer\s+/i, "").trim();

    if (!cronSecret) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "CRON_SECRET is not configured." },
        { status: 500 }
      );
    }

    if (token !== cronSecret) {
      return NextResponse.json<ApiError>(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await runLateFeesJob();

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/cron/late-fees error:", error);

    return NextResponse.json<ApiError>(
      { ok: false, error: "Failed to run late fees job." },
      { status: 500 }
    );
  }
}