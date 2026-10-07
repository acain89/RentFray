import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PropertySettingsInput = {
  rentDueDay?: number;
  gracePeriodDays: number;
  lateFeeFlatCents?: number | null;
  lateFeeEnabled?: boolean;
  convenienceFeeEnabled?: boolean;
  convenienceFeeType?: string | null;
  convenienceFeeAmountCents?: number | null;
  allowTestMode?: boolean;
  tenantPortalEnabled?: boolean;
  maintenancePortalEnabled?: boolean;
  onboardingComplete?: boolean;
  setupComplete?: boolean;
};

export type PropertySettingsView = {
  rentDueDay: number;
  gracePeriodDays: number;
  lateFeeFlatCents: number | null;
  lateFeeEnabled: boolean;
  convenienceFeeEnabled: boolean;
  convenienceFeeType: string | null;
  convenienceFeeAmountCents: number | null;
  allowTestMode: boolean;
  tenantPortalEnabled: boolean;
  maintenancePortalEnabled: boolean;
  onboardingComplete: boolean;
  setupComplete: boolean;
};

const DEFAULT_PROPERTY_SETTINGS: PropertySettingsView = {
  rentDueDay: 1,
  gracePeriodDays: 5,
  lateFeeFlatCents: null,
  lateFeeEnabled: false,
  convenienceFeeEnabled: false,
  convenienceFeeType: null,
  convenienceFeeAmountCents: null,
  allowTestMode: true,
  tenantPortalEnabled: true,
  maintenancePortalEnabled: true,
  onboardingComplete: false,
  setupComplete: false,
};

function toNonNegativeInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function toDueDay(value: number): number {
  return Math.min(31, Math.max(1, toNonNegativeInt(value, 1)));
}

function normalizeInput(
  data: PropertySettingsInput
): Prisma.PropertySettingsUncheckedCreateInput {
  const lateFeeFlatCents =
    data.lateFeeFlatCents == null
      ? null
      : toNonNegativeInt(data.lateFeeFlatCents, 0);

const normalized: Prisma.PropertySettingsUncheckedCreateInput = {
  propertyId: "",
    gracePeriodDays: toNonNegativeInt(data.gracePeriodDays, 0),
    lateFeeFlatCents,
    lateFeeEnabled:
      data.lateFeeEnabled ?? (lateFeeFlatCents !== null && lateFeeFlatCents > 0),
    convenienceFeeEnabled: data.convenienceFeeEnabled ?? false,
    convenienceFeeType: data.convenienceFeeType ?? null,
    convenienceFeeAmountCents:
      data.convenienceFeeAmountCents == null
        ? null
        : toNonNegativeInt(data.convenienceFeeAmountCents, 0),
    allowTestMode: data.allowTestMode ?? true,
    tenantPortalEnabled: data.tenantPortalEnabled ?? true,
    maintenancePortalEnabled: data.maintenancePortalEnabled ?? true,
    onboardingComplete: data.onboardingComplete ?? false,
    setupComplete: data.setupComplete ?? false,
  };

if (data.rentDueDay !== undefined) {
  normalized.rentDueDay = toDueDay(data.rentDueDay);
}

return normalized;
}



export async function getPropertySettings(
  propertyId: string
): Promise<PropertySettingsView> {
  const settings = await prisma.propertySettings.findUnique({
    where: { propertyId },
    select: {
      rentDueDay: true,
      gracePeriodDays: true,
      lateFeeFlatCents: true,
      lateFeeEnabled: true,
      convenienceFeeEnabled: true,
      convenienceFeeType: true,
      convenienceFeeAmountCents: true,
      allowTestMode: true,
      tenantPortalEnabled: true,
      maintenancePortalEnabled: true,
      onboardingComplete: true,
      setupComplete: true,
    },
  });

  if (!settings) {
    return DEFAULT_PROPERTY_SETTINGS;
  }

  return settings;
}

export async function upsertPropertySettings(
  propertyId: string,
  data: PropertySettingsInput
) {
  const normalized = normalizeInput(data);

  return prisma.propertySettings.upsert({
    where: { propertyId },
create: {
  ...normalized,
  propertyId,
  rentDueDay: normalized.rentDueDay ?? 1,
},
    update: {
      // Creation defaults must not overwrite omitted fields on existing rows.
      ...(data.gracePeriodDays !== undefined && { gracePeriodDays: normalized.gracePeriodDays }),
      ...(data.lateFeeFlatCents !== undefined && { lateFeeFlatCents: normalized.lateFeeFlatCents }),
      ...((data.lateFeeEnabled !== undefined || data.lateFeeFlatCents !== undefined) && { lateFeeEnabled: normalized.lateFeeEnabled }),
      ...(data.convenienceFeeEnabled !== undefined && { convenienceFeeEnabled: normalized.convenienceFeeEnabled }),
      ...(data.convenienceFeeType !== undefined && { convenienceFeeType: normalized.convenienceFeeType }),
      ...(data.convenienceFeeAmountCents !== undefined && { convenienceFeeAmountCents: normalized.convenienceFeeAmountCents }),
      ...(data.allowTestMode !== undefined && { allowTestMode: normalized.allowTestMode }),
      ...(data.tenantPortalEnabled !== undefined && { tenantPortalEnabled: normalized.tenantPortalEnabled }),
      ...(data.maintenancePortalEnabled !== undefined && { maintenancePortalEnabled: normalized.maintenancePortalEnabled }),
      ...(data.onboardingComplete !== undefined && { onboardingComplete: normalized.onboardingComplete }),
      ...(data.setupComplete !== undefined && { setupComplete: normalized.setupComplete }),
    },
  });
}
