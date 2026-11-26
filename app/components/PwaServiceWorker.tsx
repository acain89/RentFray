"use client";
import { useEffect } from "react";
import { ensureAppWorker } from "@/lib/pwa";
export default function PwaServiceWorker() {
  useEffect(() => { if (window.isSecureContext && "serviceWorker" in navigator) void ensureAppWorker().catch(() => {}); }, []);
  return null;
}
