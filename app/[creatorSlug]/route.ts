import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCreatorSlug, normalizeCreatorSlug } from "@/lib/creatorSlugRules";
import { REFERRAL_COOKIE, REFERRAL_TTL_SECONDS, referralCookieOptions, signReferral, validFirstTouch } from "@/lib/creatorReferrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function referralPublicOrigin(requestUrl: string): string {
  if (process.env.NODE_ENV === "production") return "https://www.rentfray.com";
  const url = new URL(requestUrl);
  if (["http:", "https:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password) {
    return url.origin;
  }
  return "http://localhost:3000";
}

export async function GET(req: NextRequest, context: { params: Promise<{ creatorSlug: string }> }) {
  const slug = normalizeCreatorSlug((await context.params).creatorSlug);
  if (!isCreatorSlug(slug)) return new NextResponse(null, { status: 404 });
  const creator = await prisma.creator.findUnique({ where: { slug } });
  if (!creator) return new NextResponse(null, { status: 404 });
const response = NextResponse.redirect(new URL("/", referralPublicOrigin(req.url)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  const now = new Date();
  const first = await validFirstTouch(prisma, req.cookies.get(REFERRAL_COOKIE)?.value, now);
  if (!first) {
    try {
      response.cookies.set(REFERRAL_COOKIE, signReferral(creator.id, now),
        { ...referralCookieOptions, maxAge: REFERRAL_TTL_SECONDS });
    } catch {
      // Referral configuration failure must never interfere with registration.
      console.error("Creator referral capture unavailable: signing secret must be configured.");
    }
  }
  return response;
}