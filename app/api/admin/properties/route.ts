// app/api/admin/properties/route.ts

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type IncomingCharge = {
  label?: string;
  amount?: string;
};

type IncomingTier = {
  name?: string;
  unitCount?: string;
  unitLabels?: string;
  baseRent?: string;
  dueDay?: string;
  graceDays?: string;
  lateFeeInitial?: string;
  lateFeeDaily?: string;
  lateFeeMaxDays?: string;
  processingFee?: string;
  charges?: IncomingCharge[];
};

type IncomingProperty = {
  name?: string;
  code?: string;
  address?: string;
  businessType?: string;
};

type IncomingWizardPayload = {
  account?: {
    fullName?: string;
    email?: string;
    password?: string;
  };
  property?: IncomingProperty;
  tiers?: IncomingTier[];
  applySameRulesToAll?: boolean;
  paymentSetupDeferred?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function parseUnitLabels(raw: string | undefined): string[] {
  return [
    ...new Set(
      String(raw || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    ),
  ];
}

function hasDuplicateValues(values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) return true;
    seen.add(value);
  }

  return false;
}

function getDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates];
}

function getRecurringChargeTotal(charges: IncomingCharge[] = []) {
  return charges.reduce((sum, charge) => sum + toNumber(charge.amount, 0), 0);
}

function getMonthlySubtotal(tier: IncomingTier) {
  return toNumber(tier.baseRent, 0) + getRecurringChargeTotal(tier.charges || []);
}

/**
 * Lowest available processing fee estimate for the tier.
 * Mirrors the frontend preview:
 * - card rail: 2.9% + $0.30
 * - ACH rail: 1.0%
 * choose the lower of the two
 */
function getMinimumProcessingFee(monthlySubtotal: number) {
  if (monthlySubtotal <= 0) return 0;

  const cardFee = monthlySubtotal * 0.029 + 0.3;
  const achFee = monthlySubtotal * 0.01;

  return Math.min(cardFee, achFee);
}

function isPrismaKnownError(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

function generateFourDigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateFiveDigitCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function generateUniquePropertyCode(tx: Prisma.TransactionClient) {
  const fourDigitCount = await tx.property.count({
    where: {
      propertyCode: {
        gte: "1000",
        lte: "9999",
      },
    },
  });

  if (fourDigitCount < 9000) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const propertyCode = generateFourDigitCode();

      const exists = await tx.property.findFirst({
        where: { propertyCode },
        select: { id: true },
      });

      if (!exists) {
        return propertyCode;
      }
    }

    const existingFourDigitRows = await tx.property.findMany({
      where: {
        propertyCode: {
          gte: "1000",
          lte: "9999",
        },
      },
      select: { propertyCode: true },
    });

    const used = new Set(existingFourDigitRows.map((row) => row.propertyCode));

    for (let i = 1000; i <= 9999; i++) {
      const candidate = String(i);
      if (!used.has(candidate)) {
        return candidate;
      }
    }
  }

  for (let attempt = 0; attempt < 500; attempt++) {
    const propertyCode = generateFiveDigitCode();

    const exists = await tx.property.findFirst({
      where: { propertyCode },
      select: { id: true },
    });

    if (!exists) {
      return propertyCode;
    }
  }

  throw new Error("Unable to generate a unique property code.");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingWizardPayload;

    const property = (body.property || {}) as IncomingProperty;
    const tiers = Array.isArray(body.tiers) ? body.tiers : [];
    const applySameRulesToAll = Boolean(body.applySameRulesToAll);

    if (!safeTrim(property.name) || !safeTrim(property.address)) {
      return NextResponse.json(
        { error: "Missing property information." },
        { status: 400 }
      );
    }

    if (!tiers.length) {
      return NextResponse.json(
        { error: "At least one tier is required." },
        { status: 400 }
      );
    }

    const normalizedAllLabels = tiers.flatMap((tier) =>
      parseUnitLabels(tier.unitLabels)
    );

    if (!normalizedAllLabels.length) {
      return NextResponse.json(
        { error: "At least one unit label is required." },
        { status: 400 }
      );
    }

    if (hasDuplicateValues(normalizedAllLabels)) {
      return NextResponse.json(
        {
          error: `Duplicate unit labels found: ${getDuplicateValues(
            normalizedAllLabels
          ).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const firstTier = tiers[0];

    if (!firstTier) {
      return NextResponse.json(
        { error: "At least one tier is required." },
        { status: 400 }
      );
    }

    for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
      const tier = tiers[tierIndex];
      const tierName = safeTrim(tier.name);
      const unitLabels = parseUnitLabels(tier.unitLabels);
      const unitCount = unitLabels.length;
      const baseRent = toNumber(tier.baseRent);
      const ruleSource = applySameRulesToAll ? firstTier : tier;
      const dueDay = toNumber(ruleSource?.dueDay);
      const graceDays = toNumber(ruleSource?.graceDays);
      const lateFeeInitial = toNumber(ruleSource?.lateFeeInitial);
      const lateFeeDaily = toNumber(ruleSource?.lateFeeDaily);
      const lateFeeMaxDays = toNumber(ruleSource?.lateFeeMaxDays);
      const monthlySubtotal = getMonthlySubtotal(tier);
      const processingFee = getMinimumProcessingFee(monthlySubtotal);

      if (!tierName) {
        return NextResponse.json(
          { error: `Tier ${tierIndex + 1} must have a description.` },
          { status: 400 }
        );
      }

      if (unitCount <= 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" must have at least one unit.` },
          { status: 400 }
        );
      }

      if (baseRent < 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" has an invalid monthly rent.` },
          { status: 400 }
        );
      }

      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        return NextResponse.json(
          { error: `Tier "${tierName}" must have a due day between 1 and 31.` },
          { status: 400 }
        );
      }

      if (!Number.isInteger(graceDays) || graceDays < 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" has an invalid grace period.` },
          { status: 400 }
        );
      }

      if (lateFeeInitial < 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" has an invalid late fee amount.` },
          { status: 400 }
        );
      }

      if (lateFeeDaily < 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" has an invalid daily late fee.` },
          { status: 400 }
        );
      }

      if (
        !Number.isInteger(lateFeeMaxDays) ||
        lateFeeMaxDays < 0 ||
        lateFeeMaxDays > 31
      ) {
        return NextResponse.json(
          {
            error: `Tier "${tierName}" has an invalid max days daily fee is active value.`,
          },
          { status: 400 }
        );
      }

      if (processingFee < 0) {
        return NextResponse.json(
          { error: `Tier "${tierName}" has an invalid processing fee.` },
          { status: 400 }
        );
      }

      const charges = Array.isArray(tier.charges) ? tier.charges : [];

      for (const charge of charges) {
        const label = safeTrim(charge.label);
        const amount = toNumber(charge.amount);

        if (!label) {
          return NextResponse.json(
            { error: `Tier "${tierName}" has a charge with no label.` },
            { status: 400 }
          );
        }

        if (amount < 0) {
          return NextResponse.json(
            { error: `Tier "${tierName}" has an invalid charge amount.` },
            { status: 400 }
          );
        }
      }
    }

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const propertyCode = await generateUniquePropertyCode(tx);

        const createdProperty = await tx.property.create({
          data: {
            name: safeTrim(property.name),
            propertyCode,
            status: "SETUP",
            propertyType: safeTrim(property.businessType || "OTHER"),
            addressLine1: safeTrim(property.address),
            isActive: true,
          },
        });

        const propertySettingsRuleSource = applySameRulesToAll
          ? firstTier
          : firstTier;

        await tx.propertySettings.create({
          data: {
            propertyId: createdProperty.id,
            rentDueDay: toNumber(propertySettingsRuleSource?.dueDay, 1),
            gracePeriodDays: toNumber(propertySettingsRuleSource?.graceDays, 0),
            lateFeeEnabled: true,
            lateFeeFlat: toNumber(
              propertySettingsRuleSource?.lateFeeInitial,
              0
            ),
            convenienceFeeEnabled: true,
            convenienceFeeType: "FLAT",
            convenienceFeeAmount: getMinimumProcessingFee(
              getMonthlySubtotal(firstTier)
            ),
          },
        });

        for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
          const tier = tiers[tierIndex];
          const unitLabels = parseUnitLabels(tier.unitLabels);
          const recurringTotal = getRecurringChargeTotal(tier.charges || []);
          const ruleSource = applySameRulesToAll ? firstTier : tier;
          const calculatedProcessingFee = getMinimumProcessingFee(
            getMonthlySubtotal(tier)
          );

          const tierData: Prisma.PropertyTierUncheckedCreateInput = {
            propertyId: createdProperty.id,
            name: safeTrim(tier.name),
            baseRent: toNumber(tier.baseRent),
            unitCount: unitLabels.length,
            rentDueDay: toNumber(ruleSource?.dueDay, 1),
            gracePeriodDays: toNumber(ruleSource?.graceDays, 0),
            lateFeeInitial: toNumber(ruleSource?.lateFeeInitial, 0),
            lateFeeDaily: toNumber(ruleSource?.lateFeeDaily, 0),
            lateFeeMaxDays: toNumber(ruleSource?.lateFeeMaxDays, 0),
            processingFee: calculatedProcessingFee,
            sortOrder: tierIndex,
            isActive: true,
          };

          const createdTier = await tx.propertyTier.create({
            data: tierData,
          });

          for (const unitLabel of unitLabels) {
            const unitData: Prisma.UnitUncheckedCreateInput = {
              propertyId: createdProperty.id,
              tierId: createdTier.id,
              unitNumber: unitLabel,
              unitType: safeTrim(tier.name),
              baseRent: toNumber(tier.baseRent),
              recurringFees: recurringTotal,
              isActive: true,
            };

            const createdUnit = await tx.unit.create({
              data: unitData,
            });

            const charges = Array.isArray(tier.charges) ? tier.charges : [];

            if (charges.length) {
              const validCharges: Prisma.UnitRecurringFeeCreateManyInput[] =
                charges
                  .filter((charge) => safeTrim(charge.label))
                  .map((charge, index) => ({
                    propertyId: createdProperty.id,
                    unitId: createdUnit.id,
                    label: safeTrim(charge.label),
                    amount: toNumber(charge.amount),
                    isActive: true,
                    displayOrder: index,
                  }));

              if (validCharges.length) {
                await tx.unitRecurringFee.createMany({
                  data: validCharges,
                });
              }
            }
          }
        }

        return createdProperty;
      }
    );

    return NextResponse.json({
      ok: true,
      property: {
        id: result.id,
        name: result.name,
        propertyCode: result.propertyCode,
      },
    });
  } catch (err: unknown) {
    if (isPrismaKnownError(err) && err.code === "P2002") {
      return NextResponse.json(
        { error: "A unique property code could not be assigned." },
        { status: 400 }
      );
    }

    console.error(err);

    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}