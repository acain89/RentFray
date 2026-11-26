/** Session changes must replace the document, not reuse another identity's router cache. */
export function navigateDocument(path: string): void {
  const target = new URL(path, window.location.origin);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || target.origin !== window.location.origin) {
    throw new Error("Invalid internal navigation destination");
  }
  window.location.assign(target.href);
}
