"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getAccessiblePortals,
  getPortalDestinationFromPathname,
  getUserRoles,
  PORTAL_DESTINATION_HOME,
  PORTAL_DESTINATION_LABEL,
  type PortalRole,
} from "@/lib/portal-auth";

const darkTriggerClass =
  "min-h-11 rounded-[22px] border border-white/15 bg-[#111a13] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-lime-400/60 hover:bg-[#162119] sm:px-5";

/** Matches account header actions on light surfaces (legacy `headerActionButtonClassName`). */
export const portalSwitcherLightTriggerClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

/** Same surface as `.otg-site-header`: `--otg-black`, bottom lime stripe like the main nav bar. */
const menuClass =
  "z-[1100] max-h-[min(70vh,22rem)] w-64 overflow-y-auto rounded-2xl border border-white/15 border-b-[3px] border-b-[var(--otg-primary)] bg-[var(--otg-black)] p-3 text-[var(--otg-white)] shadow-[0_12px_36px_rgba(0,0,0,0.35)] dark:border-white/15 dark:border-b-[var(--otg-primary)] dark:bg-[var(--otg-black)] dark:text-[var(--otg-white)]";

type PortalSwitcherDropdownProps = {
  className?: string;
  variant?: "dark" | "light";
  align?: "start" | "end";
  /** Open above (customer tab bar) or below (light buttons in page headers). Defaults by variant. */
  side?: "top" | "bottom";
};

/**
 * Replaces the old `/portal` chooser: lists every portal destination the account can use.
 */
export function PortalSwitcherDropdown({
  className,
  variant = "dark",
  align = "end",
  side: sideProp,
}: PortalSwitcherDropdownProps) {
  const side = sideProp ?? (variant === "dark" ? "top" : "bottom");
  const pathname = usePathname();
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { roles: nextRoles } = await getUserRoles();
        if (isMounted) {
          setRoles(nextRoles);
        }
      } catch {
        if (isMounted) {
          setRoles([]);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

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
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                  current
                    ? "border-lime-400 bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.35)] hover:bg-lime-300"
                    : "border-white/15 bg-[#111a13] text-white hover:border-lime-400/60 hover:bg-[#162119]",
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
