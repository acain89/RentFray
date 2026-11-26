# Assignment3D reviewed changes

The ledger, monthly rent, late-fee jobs, payment fee calculation and mutation services are unchanged.

## Monetary displays

All amounts remain integer cents. `formatConfiguredMoney` validates safe nonnegative integers and formats via integer/BigInt division, not financial floating-point calculations. Missing, invalid or inconsistent data is shown as Unavailable; actual zero remains $0.00.

- Property flat late fee: PropertySettings.lateFeeFlatCents.
- Stored convenience fee: PropertySettings.convenienceFeeAmountCents (configuration, not a Checkout quote).
- Tier base rent: PropertyTier.baseRentCents.
- Stored tier processing fee: PropertyTier.processingFeeCents, explicitly labelled stored. Checkout retains billingConfig.getProcessingFeeCents and ledger-derived amounts.
- Tier initial/daily late fees: PropertyTier.lateFeeInitialCents/lateFeeDailyCents.
- Unit base rent: current same-property PropertyTier.baseRentCents, matching jobs/monthlyRent.ts. Never the legacy nullable Unit.baseRentCents override. Missing/mismatched tier is unavailable.
- Configured unit add-ons: sum of active, correctly scoped UnitRecurringFee.amountCents. Empty loaded set is legitimately zero; absent or invalid set is unavailable. No outstanding-balance calculation.
- Individual recurring charge: UnitRecurringFee.amountCents.

## Occupancy removal evidence

A complete source/text search found getUnitOccupancy only in lib/occupancy.ts itself. Its path appears only in historical file-list artifacts and the protected-file inventory. Direct/import/export/require/import() and operational script searches found no consumer or computed loader for occupancy. Next routes are under app, not auto-discovered lib modules. The obsolete helper queried the absent Assignment model; it was removed rather than introducing another occupancy authority. The164-file guard retains the pinned committed file and asserts its sole authorized deletion; all other missing protected files remain failures.

## Type and verification contracts

The lib/prisma.ts singleton uses typeof globalThis & { prisma?: PrismaClient } in place of any. Emitted JavaScript is identical. Existing email verification rejects missing email inside the locked transaction before writes; returning its already-narrowed email explicitly preserves that proven string through the transaction result. No token, account, role, password, session, ownership or expiry condition changes. Representative reporting has a contextual Promise<RepresentativeDashboard> return type; status values and financial calculations are unchanged.

The preservation fixtures allow only the exact singleton type annotation and verified-email return narrowing. They retain exact whole-source comparisons and negative mutation checks, not a new HEAD baseline.
