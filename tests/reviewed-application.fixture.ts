import { reviewedUnusedDeclarations } from "./reviewed-unused-declarations.fixture";
import { reviewedLintImports } from "./reviewed-lint-imports.fixture";
import assert from "node:assert/strict";

export const verifiedEmailNarrowing = '      // Preserve the non-null email established by the locked authority check above.\n      return { ...current, email: current.email };';
function replaceOnce(source: string, before: string, after: string): string {
  assert.equal(source.split(before).length, 2, "Exactly one authorized application delta");
  return source.replace(before, after);
}
export function reviewedApplicationSource(file: string, originalSource: string): string | undefined {
  const original = reviewedUnusedDeclarations(file, originalSource);
  if (file === "lib/delinquency.ts") return replaceOnce(original, "let projectedInitial = effective.lateFeeInitialCents;", "const projectedInitial = effective.lateFeeInitialCents;");
  if (file === "lib/prisma.ts") return replaceOnce(original, "global as any", "global as typeof globalThis & { prisma?: PrismaClient }");
  if (file === "app/api/auth/verify-email/route.ts") return replaceOnce(original, "      return current;", verifiedEmailNarrowing);
  if (file === "app/api/maintenance/dashboard/route.ts") return replaceOnce(original, "requests.map((row: any) =>", "requests.map((row) =>");
  const copyOnly = reviewedJsxCopy(file, original);
  if (copyOnly !== original) return copyOnly;
  const importsOnly = reviewedLintImports(file, original);
  return importsOnly === originalSource ? undefined : importsOnly;
}
export function restoreVerifiedEmailNarrowing(source: string): string {
  return replaceOnce(source, verifiedEmailNarrowing, "      return current;");
}

export function reviewedRepresentativeTyping(original: string): string {
  return replaceOnce(original, "async (tx: Prisma.TransactionClient) => {", "async (tx: Prisma.TransactionClient): Promise<RepresentativeDashboard> => {");
}

export function reviewedCreatorEntry(original: string): string {
  const withGuard = 'import { maintenanceClient } from "./maintenance-safety";\n' + replaceOnce(original, 'import { Prisma, PrismaClient } from "@prisma/client";', 'import { Prisma } from "@prisma/client";');
  return replaceOnce(replaceOnce(withGuard, "const prisma = new PrismaClient();", 'const prisma = maintenanceClient("create-creator");'),
    'main().catch((error: unknown) => {', 'export const operationalCompletion = main().catch((error: unknown) => {');
}

// Exact JSX entities preserve the rendered apostrophe; no financial expressions change.
export function reviewedJsxCopy(file: string, source: string): string {
  if (file === "app/manager/units/[id]/page.tsx") return replaceOnce(source,
    "according to the property's rules.", "according to the property&apos;s rules.");
  if (file === "app/tenant/dashboard/page.tsx") return replaceOnce(source,
    "You're all paid up. Check back on your next due date.", "You&apos;re all paid up. Check back on your next due date.");
  return source;
}

export function reviewedInternalLinks(file: string, source: string): string {
  if (file !== "app/setup/page.tsx") return source;
  let result = replaceOnce(source, '\"use client\";', '\"use client\";\nimport Link from \"next/link\";\n');
  result = replaceOnce(result, '<a\n                href="/manager/login"', '<Link\n                href="/manager/login"');
  return replaceOnce(result, 'Manager Login\n              </a>', 'Manager Login\n              </Link>');
}
