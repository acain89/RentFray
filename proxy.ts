// /proxy.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "rf_session";

const PUBLIC_PAGE_ROUTES = [
  "/",
  "/setup",
  "/offline",
  "/how-it-works",
  "/pricing",
  "/security-payments",
  "/why-rentfray",
  "/is-rentfray-right-for-me",
  "/faq",
  "/property-code",
  "/login",
  "/manager/login",
  "/tenant/login",
  "/request-illustration",
  "/role-select",

  // SEO / AEO marketing pages
  "/best-way-to-collect-rent",
  "/buy-here-pay-here-payment-system",
  "/campground-payment-system",
  "/collect-rent-online",
  "/commercial-property-rent-collection",
  "/duplex-landlord-rent-collection",
  "/easiest-way-for-tenants-to-pay-rent",
  "/equipment-rental-payment-system",
  "/free-rent-collection-software",
  "/free-rent-collection-software-no-monthly-fee",
  "/hoa-payment-system",
  "/how-tenants-pay-rent-online",
  "/how-to-avoid-late-rent-payments",
  "/how-to-collect-rent-online",
  "/how-to-manage-rent-without-software",
  "/how-to-track-tenant-payments",
  "/landlord-payment-system",
  "/landlord-rent-payment-options",
  "/manual-rent-tracking-vs-software",
  "/marina-slip-payment-system",
  "/mobile-home-park-rent-collection",
  "/no-fee-rent-collection-system",
  "/office-rent-payment-system",
  "/online-rent-payment-system",
  "/online-rent-payment-system-apartments",
  "/property-management-payment-system",
  "/rental-payment-platform",
  "/rent-billing-system",
  "/rent-collection-software-alternative",
  "/rent-collection-software-landlords",
  "/rent-payment-app",
  "/rent-tracking-software",
  "/rv-park-rent-collection",
  "/self-storage-payment-system",
  "/spreadsheet-vs-rent-software",
  "/student-housing-rent-payment",
  "/tenant-online-rent-payments",
  "/tenant-payment-portal",
  "/tenant-rent-payment-options",
  "/trailer-park-rent-collection",
  "/warehouse-rent-payment-system",

  // Search-engine discovery files
  "/robots.txt",
  "/sitemap.xml",
] as const;

const PUBLIC_API_ROUTES = [
  "/api/setup",
  "/api/admin/session",
  "/api/admin/properties/list",
  "/api/admin/requests/list",
  "/api/request-setup",
  "/api/property/resolve",
  "/api/public/property/lookup",
  "/api/cron",
  "/api/manager/session",
  "/api/tenant/session",
  "/api/tenant/activate",
  "/api/maintenance/session",
] as const;

function matchesRoute(pathname: string, route: string): boolean {
  if (route === "/") {
    return pathname === "/";
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_PAGE_ROUTES.some((route) => matchesRoute(pathname, route)) ||
    PUBLIC_API_ROUTES.some((route) => matchesRoute(pathname, route))
  );
}


export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE)?.value;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline" ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/api/stripe/webhook")
  ) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/property-code";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|icons|images).*)",
  ],
};
