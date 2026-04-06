"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getUserRoles,
  hasPortalAccess,
  type PortalDestination,
  type PortalRole,
} from "@/lib/portal-auth";

type PortalNavSection = "customer" | "tech" | "manager" | "admin";

type PortalNavItem = {
  href: string;
  label: string;
  matchPrefixes?: string[];
  excludePrefixes?: string[];
};

type PortalNavGroup = {
  destination: PortalDestination;
  label: string;
  items: PortalNavItem[];
};

const portalNavGroups: PortalNavGroup[] = [
  {
    destination: "customer",
    label: "Customer",
    items: [
      { href: "/customer/dashboard", label: "Home" },
      { href: "/customer/progress", label: "Service Progress" },
      { href: "/customer/reports", label: "Customer Report History" },
      { href: "/customer/account", label: "Account" },
    ],
  },
  {
    destination: "tech",
    label: "Technician",
    items: [
      { href: "/tech", label: "Inspection" },
      { href: "/tech/jobs", label: "Jobs" },
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
        excludePrefixes: ["/manager/jobs/new"],
      },
      { href: "/manager/jobs/new", label: "New Job" },
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

const isItemActive = (pathname: string, item: PortalNavItem) => {
  if (pathname === item.href) {
    return true;
  }

  if (item.excludePrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false;
};

type PortalTopNavProps = {
  section: PortalNavSection;
  className?: string;
};

export function PortalTopNav({ section, className }: PortalTopNavProps) {
  const pathname = usePathname();
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const skipLookup = section === "customer";

  useEffect(() => {
    if (skipLookup) {
      return;
    }

    let isMounted = true;

    const loadRoles = async () => {
      try {
        const { roles: nextRoles } = await getUserRoles();

        if (!isMounted) {
          return;
        }

        setRoles(nextRoles);
      } catch (error) {
        console.error("Failed to load portal navigation roles:", error);

        if (!isMounted) {
          return;
        }

        setRoles([]);
      }
    };

    void loadRoles();

    return () => {
      isMounted = false;
    };
  }, [skipLookup]);

  const availableGroups = useMemo(() => {
    if (skipLookup) {
      return portalNavGroups.filter((group) => group.destination === "customer");
    }

    return portalNavGroups.filter((group) =>
      hasPortalAccess(roles, group.destination),
    );
  }, [roles, skipLookup]);

  const totalItemCount = availableGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  if (availableGroups.length === 0 || totalItemCount <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "otg-portal-nav rounded-[28px] border border-lime-500/40 bg-[#0b120d] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <nav aria-label={`${section} portal navigation`}>
        <ul className="flex flex-wrap gap-2">
          {availableGroups.map((group) => {
            const groupActive = group.items.some((item) => isItemActive(pathname, item));
            const isOpen = openGroup === group.destination;

            return (
              <li key={group.destination}>
                <Popover
                  open={isOpen}
                  onOpenChange={(nextOpen) => {
                    setOpenGroup(nextOpen ? group.destination : null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "min-h-11 rounded-[22px] border px-5 py-2 text-sm font-semibold shadow-sm transition-colors",
                        groupActive
                          ? "border-lime-400 bg-lime-400 !text-black shadow-[0_0_18px_rgba(163,230,53,0.45)] hover:bg-lime-300 hover:!text-black"
                          : "border-white/15 bg-[#111a13] !text-white hover:border-lime-400/60 hover:bg-[#162119] hover:!text-white",
                      )}
                    >
                      {group.label}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="otg-portal-nav-menu w-64 rounded-[24px] border border-lime-500/40 bg-[#101827] p-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                  >
                    <div className="mb-2 px-2 pt-1 text-xs font-bold uppercase tracking-[0.18em] text-lime-300">
                      {group.label} Pages
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const itemActive = isItemActive(pathname, item);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className={cn(
                              "block rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                              itemActive
                                ? "border-lime-400 bg-lime-400 text-black"
                                : "border-white/10 bg-white/5 text-white hover:border-lime-400/60 hover:bg-white/10",
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
