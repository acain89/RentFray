"use client";

import { useEffect, useRef } from "react";
import { navigateDocument } from "@/lib/documentNavigation";

/** Leave an expired identity's document without mutating browser state during render. */
export function DocumentRedirect({ path }: { path: string }) {
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (attempted.current !== path) {
      attempted.current = path;
      navigateDocument(path);
    }
  }, [path]);
  return null;
}
