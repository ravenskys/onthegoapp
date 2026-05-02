"use client";

import { usePathname } from "next/navigation";
import { PortalSwitcherDropdown, portalSwitcherLightTriggerClass } from "@/components/portal/PortalSwitcherDropdown";

type BackToPortalButtonProps = {
  className?: string;
};

/** @deprecated Use `portalSwitcherLightTriggerClass` from `PortalSwitcherDropdown` — kept for existing imports. */
export const headerActionButtonClassName = portalSwitcherLightTriggerClass;

/**
 * Multi-role portal switching (replaces the old `/portal` chooser link).
 * Renders nothing when the account only has one portal.
 */
export function BackToPortalButton({ className }: BackToPortalButtonProps) {
  const pathname = usePathname() ?? "";
  if (
    pathname.startsWith("/manager") ||
    pathname.startsWith("/tech") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }
  return <PortalSwitcherDropdown variant="light" className={className} align="end" />;
}
