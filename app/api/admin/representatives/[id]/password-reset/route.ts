import { representativeAdminFields, runRepresentativeAdmin, sendRepresentativeSetup } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return runRepresentativeAdmin(request, true, async (actor, input) => {
    representativeAdminFields(input, []);
    return { setupEmailSent: await sendRepresentativeSetup(actor, (await context.params).id) };
  });
}
