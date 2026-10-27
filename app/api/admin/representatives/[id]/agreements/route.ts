import { createRepresentativeAgreement, listRepresentativeAgreements, representativeAdminFields, representativeAdminQuery, runRepresentativeAdmin } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return runRepresentativeAdmin(request, false, async () => listRepresentativeAgreements((await context.params).id, representativeAdminQuery(request, ["cursor"]).get("cursor") ?? undefined));
}
export async function POST(request: Request, context: Context) {
  return runRepresentativeAdmin(request, true, async (actor, input) => createRepresentativeAgreement(actor, (await context.params).id,
    representativeAdminFields(input, ["effectiveAt", "agreementReference", "agreementVersion"])));
}
