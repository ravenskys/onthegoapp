import type { PortalDestination } from "@/lib/portal-auth";

export type PortalNavSection = "customer" | "tech" | "manager" | "admin";

export type PortalNavItem = {
  href: string;
  label: string;
  matchPrefixes?: string[];
  excludePrefixes?: string[];
};

export type PortalNavGroup = {
  destination: PortalDestination;
  label: string;
  items: PortalNavItem[];
};

/** Single source of truth for portal top navigation by role destination. */
export const portalNavGroups: PortalNavGroup[] = [
  {
    destination: "customer",
    label: "Customer",
    items: [
      { href: "/customer/dashboard", label: "Overview" },
      {
        href: "/customer/book",
        label: "Get Service",
        matchPrefixes: ["/customer/book", "/customer/schedule"],
      },
      { href: "/customer/progress", label: "Service Progress" },
      { href: "/customer/reports", label: "Reports" },
      { href: "/customer/account", label: "Account" },
      {
        href: "/contact",
        label: "Contact Us",
        matchPrefixes: ["/contact"],
      },
    ],
  },
  {
    destination: "tech",
    label: "Technician",
    items: [
      { href: "/tech/jobs", label: "Jobs" },
      { href: "/tech", label: "Inspection" },
    ],
  },
  {
    destination: "manager",
    label: "Manager",
    items: [
      { href: "/manager", label: "Dashboard" },
      {
        href: "/manager/jobs",
        label: "Jobs",
        matchPrefixes: ["/manager/jobs/"],
      },
      { href: "/manager/schedule", label: "Schedule" },
      { href: "/manager/availability", label: "Employee Availability" },
      {
        href: "/manager/employees",
        label: "Employees",
        matchPrefixes: ["/manager/employees"],
      },
      {
        href: "/manager/customers",
        label: "Customers",
        matchPrefixes: ["/manager/customers/"],
      },
    ],
  },
  {
    destination: "admin",
    label: "Admin",
    items: [
      { href: "/admin", label: "Admin Home" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export const isPortalNavItemActive = (pathname: string, item: PortalNavItem) => {
  if (pathname === item.href) {
    return true;
  }

  if (item.excludePrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false;
};
