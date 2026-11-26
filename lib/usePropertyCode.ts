"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
const key = "rf_property_code", changed = "rentfray:property-code";
const identity = (value: string) => value;
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener(changed, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(changed, listener); };
}
export function usePropertyCode(provided: string, normalize: (value: string) => string = identity): string {
  const snapshot = useCallback(() => {
    if (provided) return provided;
    try { return normalize(window.localStorage.getItem(key) || ""); } catch { return ""; }
  }, [provided, normalize]);
  const server = useCallback(() => provided, [provided]);
  const value = useSyncExternalStore(subscribe, snapshot, server);
  useEffect(() => {
    if (!provided) return;
    try {
      if (window.localStorage.getItem(key) !== provided) { window.localStorage.setItem(key, provided); window.dispatchEvent(new Event(changed)); }
    } catch { /* Explicit route values remain usable when storage is unavailable. */ }
  }, [provided]);
  return value;
}
