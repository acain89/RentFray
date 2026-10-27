import { recordRepresentativePayout, representativeAdminFields, runRepresentativeAdmin } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return runRepresentativeAdmin(request, true, async (actor, input) => recordRepresentativePayout(actor, (await context.params).id,
    representativeAdminFields(input, ["amountUsd", "paidAt", "reportingMonth", "externalPayoutReference", "operationKey", "note"])));
}
