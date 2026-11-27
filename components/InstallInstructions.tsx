"use client";
import { useEffect, useState, type ReactNode } from "react";
import { isInstalled } from "@/lib/pwa";
/** Explicitly visited guide only; installation invitations never render in standalone. */
export function InstallInstructions({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(isInstalled(display.matches, (navigator as Navigator & { standalone?: boolean }).standalone === true));
    const completed = () => setInstalled(true);
    const timer = setTimeout(sync, 0);
    display.addEventListener("change", sync); window.addEventListener("pageshow", sync); window.addEventListener("appinstalled", completed);
    return () => { clearTimeout(timer); display.removeEventListener("change", sync); window.removeEventListener("pageshow", sync); window.removeEventListener("appinstalled", completed); };
  }, []);
  if (installed === null) return null;
  return installed ? <p>RentFray is already installed. No installation is needed.</p> : children;
}
