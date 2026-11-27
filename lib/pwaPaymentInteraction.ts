/** UI-only reference-counted suppression; contains no payment data or requests. */
const active = new Set<symbol>();
const listeners = new Set<() => void>();
export function isPaymentInteractionActive(): boolean { return active.size > 0; }
export function subscribePaymentInteraction(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function beginPaymentInteraction(): () => void {
  const token = Symbol(); active.add(token); listeners.forEach(listener => listener());
  return () => { if (active.delete(token)) listeners.forEach(listener => listener()); };
}

// Page exit ends this document's interaction. A bfcache restoration starts idle;
// ordinary initial pageshow must never clear a request that is already running.
if (typeof window !== "undefined") {
  const reset = () => { if (active.size) { active.clear(); listeners.forEach(listener => listener()); } };
  window.addEventListener("pagehide", reset);
  window.addEventListener("pageshow", event => { if (event.persisted) reset(); });
}
