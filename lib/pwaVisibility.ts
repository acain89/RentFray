/** Exact application routes only; never infer eligibility from a prefix. */
export const INSTALLATION_ROUTES: readonly string[] = ["/", "/manager", "/manager/dashboard", "/tenant/dashboard", "/admin", "/maintenance/dashboard", "/r/portal"];
export function isInstallationRoute(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && INSTALLATION_ROUTES.includes(pathname);
}
