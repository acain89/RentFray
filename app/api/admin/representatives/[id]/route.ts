import { getRepresentativeAdminDetail, representativeAdminFields, representativeAdminQuery, runRepresentativeAdmin, setRepresentativeLogin } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return runRepresentativeAdmin(request, false, async () => {
    const query = representativeAdminQuery(request, ["businessCursor", "payoutCursor", "monthBefore", "agreementCursor"]);
    return getRepresentativeAdminDetail((await context.params).id, { businessCursor: query.get("businessCursor") ?? undefined,
      payoutCursor: query.get("payoutCursor") ?? undefined, monthBefore: query.get("monthBefore") ?? undefined, agreementCursor: query.get("agreementCursor") ?? undefined });
  });
}
export async function PATCH(request: Request, context: Context) {
  return runRepresentativeAdmin(request, true, async (actor, input) => setRepresentativeLogin(actor, (await context.params).id, representativeAdminFields(input, ["loginEnabled"])));
}
