import { authorizeRepresentativeBusiness, representativeAdminFields, runRepresentativeAdmin } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string; referralId: string }> }) {
  return runRepresentativeAdmin(request, true, async (actor, input) => {
    const { id, referralId } = await context.params;
    return authorizeRepresentativeBusiness(actor, id, referralId, representativeAdminFields(input, ["agreementId"]));
  });
}
