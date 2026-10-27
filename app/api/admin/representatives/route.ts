import { createRepresentative, listRepresentatives, representativeAdminFields, representativeAdminQuery, runRepresentativeAdmin, sendRepresentativeSetup } from "@/lib/representativeAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return runRepresentativeAdmin(request, false, async () => listRepresentatives(representativeAdminQuery(request, ["cursor"]).get("cursor") ?? undefined));
}
export async function POST(request: Request) {
  return runRepresentativeAdmin(request, true, async (actor, input) => {
    const representative = await createRepresentative(actor, representativeAdminFields(input, ["displayName", "email"]));
    let setupEmailSent = false;
    try { setupEmailSent = await sendRepresentativeSetup(actor, representative.id); } catch { console.error("REPRESENTATIVE_CREATED_SETUP_UNAVAILABLE"); }
    return { representative, setupEmailSent };
  });
}
