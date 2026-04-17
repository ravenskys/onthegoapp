"use client";

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
  return <PortalSwitcherDropdown variant="light" className={className} align="end" />;
}
