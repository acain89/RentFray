import assert from "node:assert/strict";

// Reviewed unused bindings only; retained imports still carry all operational dependencies.
const deltas = [
  {
    "file": "app/api/manager/session/route.ts",
    "before": "import bcrypt from \"bcryptjs\";",
    "after": ""
  },
  {
    "file": "app/api/manager/units/move-tier/route.ts",
    "before": "import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed, lockCheckout } from \"@/lib/checkoutCollectibility\";",
    "after": "import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed } from \"@/lib/checkoutCollectibility\";"
  },
  {
    "file": "app/api/manual-payments/route.ts",
    "before": "import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed, lockCheckout } from \"@/lib/checkoutCollectibility\";",
    "after": "import { CheckoutConflict, inspectTenantCheckoutAttempts, assertCheckoutReductionAllowed } from \"@/lib/checkoutCollectibility\";"
  },
  {
    "file": "app/api/tenant/dashboard/route.ts",
    "before": "import {\n  getRentDateSummary,\n  resolveEffectiveBillingSettings,\n} from \"@/lib/rentDates\";",
    "after": ""
  },
  {
    "file": "app/api/tenant/dashboard/route.ts",
    "before": "import {\ngetProcessingFeeCents,\n  formatCentsToDollars,\n} from \"@/lib/billingConfig\";",
    "after": "import { formatCentsToDollars } from \"@/lib/billingConfig\";"
  },
  {
    "file": "jobs/delinquency.ts",
    "before": "import {\n  getBusinessDate,\n  resolveEffectiveBillingSettings,\n  getRentDateSummary,\n} from \"@/lib/rentDates\";",
    "after": "import { resolveEffectiveBillingSettings, getRentDateSummary } from \"@/lib/rentDates\";"
  }
] as const;

export function reviewedLintImports(file: string, original: string): string {
  let result = original;
  for (const delta of deltas) {
    if (file !== delta.file || !result.includes(delta.before)) continue;
    assert.equal(result.split(delta.before).length, 2, "Exactly one reviewed unused import");
    result = result.replace(delta.before, delta.after);
  }
  return result;
}
