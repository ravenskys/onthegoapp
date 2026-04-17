"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { PortalSwitcherDropdown } from "@/components/portal/PortalSwitcherDropdown";
import { getUserRoles, hasPortalAccess, type PortalRole } from "@/lib/portal-auth";
import {
  isPortalNavItemActive,
  portalNavGroups,
  type PortalNavSection,
} from "@/lib/portal-nav-config";

type PortalTopNavProps = {
  section: PortalNavSection;
  className?: string;
};

const pillClass = (active: boolean) =>
  cn(
    "block min-h-11 whitespace-nowrap rounded-[22px] border px-4 py-2 text-sm font-semibold shadow-sm transition-colors sm:px-5",
    active
      ? "border-lime-400 bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.45)] hover:bg-lime-300"
      : "border-white/15 bg-[#111a13] text-white hover:border-lime-400/60 hover:bg-[#162119]",
  );

const actionOutlineClass =
  "min-h-11 rounded-[22px] border border-white/15 bg-[#111a13] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-lime-400/60 hover:bg-[#162119] sm:px-5";

export function PortalTopNav({ section, className }: PortalTopNavProps) {
  const pathname = usePathname();
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const isCustomerSection = section === "customer";

  useEffect(() => {
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
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  }, []);

  const availableGroups = useMemo(() => {
    if (isCustomerSection) {
      return portalNavGroups.filter((group) => group.destination === "customer");
    }

    return portalNavGroups.filter((group) => hasPortalAccess(roles, group.destination));
  }, [roles, isCustomerSection]);

  const totalItemCount = availableGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );
  const customerItems = isCustomerSection ? (availableGroups[0]?.items ?? []) : [];

  if (isCustomerSection) {
    if (customerItems.length === 0) {
      return null;
    }

    return (
      <div
        className={cn(
          "otg-portal-nav overflow-visible rounded-[28px] border border-lime-500/40 bg-[#0b120d] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.35)]",
          className,
        )}
      >
        <div className="flex flex-col gap-3 overflow-visible sm:flex-row sm:items-center sm:gap-3">
          <nav
            aria-label="Customer portal navigation"
            className="-mx-1 min-w-0 flex-1 overflow-x-auto overflow-y-visible px-1 pb-1"
          >
            <ul className="flex min-w-max flex-nowrap gap-2 sm:min-w-0 sm:flex-wrap">
              {customerItems.map((item) => {
                const itemActive = isPortalNavItemActive(pathname, item);

                return (
                  <li key={item.href} className="shrink-0">
                    <Link href={item.href} className={pillClass(itemActive)}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
            <PortalSwitcherDropdown variant="dark" align="end" />
            <button type="button" onClick={handleLogout} className={actionOutlineClass}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <nav
        aria-label={`${section} portal navigation`}
        className="-mx-1 overflow-x-auto px-1 pb-1"
      >
        <ul className="flex flex-wrap gap-2">
          {availableGroups.map((group) => {
            const groupActive = group.items.some((item) =>
              isPortalNavItemActive(pathname, item),
            );
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
                        const itemActive = isPortalNavItemActive(pathname, item);

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
