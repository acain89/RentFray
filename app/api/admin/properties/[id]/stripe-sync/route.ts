import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { reconcileStripeAccountStatus } from "@/lib/stripeAccountStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id: propertyId } = await params;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        stripeAccountId: true,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found." },
        { status: 404 }
      );
    }

    const { paymentStatus, account, data } = await reconcileStripeAccountStatus(propertyId, {
      expectedAccountId: property.stripeAccountId,
      audit: async (tx, mapped, stripeAccountId) => {
        await tx.auditLog.create({
          data: {
            propertyId, actorType: "ADMIN", actorAdminId: session.adminAccessId ?? null,
            action: "STRIPE_STATUS_SYNCED", targetType: "PROPERTY", targetId: propertyId,
            summary: "Admin refreshed Stripe account status from Stripe.",
            metadataJson: JSON.stringify({ stripeAccountId, chargesEnabled: mapped.chargesEnabled,
              payoutsEnabled: mapped.payoutsEnabled, onboardingComplete: mapped.onboardingComplete,
              requirementsDue: mapped.requirementsDue, readyForLive: mapped.readyForLive }),
          },
        });
      },
    });
    if (!account) return NextResponse.json({ ok: true, property, paymentStatus });
    const { chargesEnabled, payoutsEnabled, onboardingComplete, requirementsDue, requirementsSummary } = data;

    return NextResponse.json({
      ok: true,
      property,
      paymentStatus,
      stripeAccount: {
        id: account.id,
        chargesEnabled,
        payoutsEnabled,
        onboardingComplete,
        requirementsDue,
        requirementsSummary,
      },
    });
  } catch (error) {
    console.error(
      "POST /api/admin/properties/[id]/stripe-sync failed",
      error
    );

    return NextResponse.json(
      { error: "Failed to refresh Stripe status." },
      { status: 500 }
    );
  }
}