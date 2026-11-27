import assert from "node:assert/strict";
const deltas: Record<string, ReadonlyArray<readonly [string,string]>> = {
  "proxy.ts": [[ '  if (isPublicRoute(pathname)) {', '  if (pathname === "/install" || isPublicRoute(pathname)) {' ]],
  "app/components/PayNowButton.tsx": [
    ['import { navigateDocument } from "@/lib/documentNavigation";', 'import { beginPaymentInteraction } from "@/lib/pwaPaymentInteraction";\nimport { navigateDocument } from "@/lib/documentNavigation";'],
    ['    try {\n      setLoading(true);', '    const finishInstallationSuppression = beginPaymentInteraction();\n    let installationDeparture = false;\n    try {\n      setLoading(true);'],
    ['    } finally {\n      setLoading(false);', '    } finally {\n      if (!installationDeparture) finishInstallationSuppression();\n      setLoading(false);'],
    ['        navigateDocument("/property-code");\n        return;', '        navigateDocument("/property-code");\n        installationDeparture = true;\n        return;'],
    ['        window.location.href = data.data.url;\n        return;', '        window.location.href = data.data.url;\n        installationDeparture = true;\n        return;'],
  ],
};
export function applyReviewedPwaVisibility(file: string, source: string): string {
  let value=source.replace(/\r\n/g,"\n");
  for(const [before,after] of deltas[file]??[]){assert.equal(value.split(before).length,2,"exact reviewed visibility span: "+file);value=value.replace(before,after);}
  return value;
}
export function restoreReviewedPwaVisibility(file: string, source: string): string {
  let value=source.replace(/\r\n/g,"\n");
  for(const [before,after] of deltas[file]??[]){assert.equal(value.split(after).length,2,"exact reviewed visibility span: "+file);value=value.replace(after,before);}
  return value;
}
