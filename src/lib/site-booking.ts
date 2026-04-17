import { hasPortalAccess, type PortalRole } from "@/lib/portal-auth";

/** Customer scheduling form (calendar / slots). */
export const CUSTOMER_SCHEDULER_HREF = "/customer/schedule";

/** Public inquiry / booking request page for visitors without portal access. */
export const PUBLIC_BOOK_NOW_HREF = "/contact";

export function getBookNowHref(roles: PortalRole[]): string {
  if (hasPortalAccess(roles, "customer")) {
    return CUSTOMER_SCHEDULER_HREF;
  }
  return PUBLIC_BOOK_NOW_HREF;
}

export function isBookNowNavActive(activePath: string, roles: PortalRole[]): boolean {
  const href = getBookNowHref(roles);
  if (href === PUBLIC_BOOK_NOW_HREF) {
    return activePath === PUBLIC_BOOK_NOW_HREF;
  }
  return (
    activePath.startsWith("/customer/schedule") ||
    activePath.startsWith("/customer/book")
  );
}
