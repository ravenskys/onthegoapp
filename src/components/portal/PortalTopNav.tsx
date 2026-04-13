"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const customerItems = skipLookup ? availableGroups[0]?.items ?? [] : [];

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
        className={cn(skipLookup && "-mx-1 overflow-x-auto px-1 pb-1")}
      >
        <ul
          className={cn(
            "flex gap-2",
            skipLookup ? "min-w-max flex-nowrap sm:min-w-0 sm:flex-wrap" : "flex-wrap",
          )}
        >
          {skipLookup
            ? customerItems.map((item) => {
                const itemActive = isPortalNavItemActive(pathname, item);

                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className={cn(
                        "block min-h-11 whitespace-nowrap rounded-[22px] border px-4 py-2 text-sm font-semibold shadow-sm transition-colors sm:px-5",
                        itemActive
                          ? "border-lime-400 bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.45)] hover:bg-lime-300"
                          : "border-white/15 bg-[#111a13] text-white hover:border-lime-400/60 hover:bg-[#162119]",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })
            : availableGroups.map((group) => {
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
