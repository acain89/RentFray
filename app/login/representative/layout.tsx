import type { Metadata } from "next";

export const metadata: Metadata = { title: "Representative sign-in | RentFray", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function RepresentativeLoginLayout({ children }: { children: React.ReactNode }) { return children; }
