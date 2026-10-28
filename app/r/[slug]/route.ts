import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRepresentativeSlug, normalizeRepresentativeSlug, readRepresentativeReferral,
  representativeCookieOptions, REPRESENTATIVE_COOKIE, REPRESENTATIVE_ORIGIN, REPRESENTATIVE_TTL_SECONDS,
  signRepresentativeReferral, validRepresentativeFirstTouch } from "@/lib/representativeReferrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const slug = normalizeRepresentativeSlug((await context.params).slug);
  const headers = { "Cache-Control": "private, no-store" };
  if (!isRepresentativeSlug(slug)) return new NextResponse(null, { status: 404, headers });
  const canonical = await prisma.representative.findFirst({ where: { slug: { equals: slug, mode: "insensitive" } }, select: { id: true } });
  const alias = canonical ? null : await prisma.representativeReferralAlias.findUnique({ where: { slug }, select: { representativeId: true } });
  const representative = canonical ?? (alias ? { id: alias.representativeId } : null);
  if (!representative) return new NextResponse(null, { status: 404, headers });
  const response = NextResponse.redirect(new URL("/", REPRESENTATIVE_ORIGIN), 303);
  response.headers.set("Cache-Control", headers["Cache-Control"]);
  const now = new Date();
  const first = await validRepresentativeFirstTouch(prisma,
    readRepresentativeReferral(req.cookies.get(REPRESENTATIVE_COOKIE)?.value, now));
  if (!first) {
    try {
      response.cookies.set(REPRESENTATIVE_COOKIE, signRepresentativeReferral(representative.id, now),
        { ...representativeCookieOptions, maxAge: REPRESENTATIVE_TTL_SECONDS });
    } catch {
      console.error("Representative referral capture unavailable: signing secret must be configured.");
    }
  }
  return response;
}
