"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import {
  getAccessiblePortals,
  getPortalDestinationFromPathname,
  PORTAL_DESTINATION_HOME,
  PORTAL_DESTINATION_LABEL,
} from "@/lib/portal-auth";

const darkTriggerClass = "otg-portal-trigger-dark";

/** Matches account header actions on light surfaces (legacy `headerActionButtonClassName`). */
export const portalSwitcherLightTriggerClass =
  "otg-header-action-btn";

/** Same surface as `.otg-site-header`: `--otg-black`, bottom lime stripe like the main nav bar. */
const menuClass = "otg-portal-switcher-menu";

type PortalSwitcherDropdownProps = {
  className?: string;
  variant?: "dark" | "light";
  align?: "start" | "end";
  /** Open above (customer tab bar) or below (light buttons in page headers). Defaults by variant. */
  side?: "top" | "bottom";
  /** e.g. close the mobile header menu after choosing a portal. */
  onNavigate?: () => void;
};

/**
 * Replaces the old `/portal` chooser: lists every portal destination the account can use.
 */
export function PortalSwitcherDropdown({
  className,
  variant = "dark",
  align = "end",
  side: sideProp,
  onNavigate,
}: PortalSwitcherDropdownProps) {
  const side = sideProp ?? (variant === "dark" ? "top" : "bottom");
  const pathname = usePathname();
  const roles = usePortalRoles();
  const [open, setOpen] = useState(false);

  const accessible = useMemo(() => getAccessiblePortals(roles), [roles]);

  if (accessible.length <= 1) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            variant === "dark"
              ? cn(
                  darkTriggerClass,
                  "!inline-flex items-center gap-2 !text-white hover:!text-white",
                )
              : cn(portalSwitcherLightTriggerClass, "!border-slate-300 !bg-white !text-slate-900"),
            className,
          )}
        >
          Portals
          <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
        className={menuClass}
      >
        <div className="mb-2 border-b border-white/10 pb-2">
          <div className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-white/85">
            Switch portal
          </div>
        </div>
        <div className="space-y-1.5">
          {accessible.map((destination) => {
            const href = PORTAL_DESTINATION_HOME[destination];
            const label = PORTAL_DESTINATION_LABEL[destination];
            const current = getPortalDestinationFromPathname(pathname) === destination;

            return (
              <Link
                key={destination}
                href={href}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className={cn(
                  "otg-portal-switcher-item",
                  current
                    ? "otg-portal-switcher-item-current"
                    : null,
                )}
              >
                {label}
                {current ? (
                  <span className="ml-1.5 text-xs font-normal text-black/70">(current)</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
