"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { PortalSwitcherDropdown } from "@/components/portal/PortalSwitcherDropdown";
import { hasPortalAccess } from "@/lib/portal-auth";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import {
  isPortalNavItemActive,
  portalNavGroups,
  type PortalNavSection,
} from "@/lib/portal-nav-config";

type PortalTopNavProps = {
  section: PortalNavSection;
  className?: string;
  /** Horizontal pill bar (default) or stacked links for the mobile site header drawer. */
  variant?: "bar" | "drawer";
  /** Fires after a portal link is chosen (e.g. close the parent hamburger menu). */
  onNavigate?: () => void;
};

const pillClass = (active: boolean) =>
  cn(
    "otg-portal-pill",
    active ? "otg-portal-pill-active" : null,
  );

const actionOutlineClass = "otg-portal-trigger-dark";

export function PortalTopNav({
  section,
  className,
  variant = "bar",
  onNavigate,
}: PortalTopNavProps) {
  const pathname = usePathname();
  const roles = usePortalRoles({
    onError: (error) => {
      console.error("Failed to load portal navigation roles:", error);
    },
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCustomerSection = section === "customer";

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Failed to sign out locally:", error);
        alert("Could not sign out cleanly. Please try again.");
        setLoggingOut(false);
        return;
      }
      window.location.href = "/customer/login";
    } catch (error) {
      console.error("Unexpected sign-out failure:", error);
      alert("Could not sign out cleanly. Please try again.");
      setLoggingOut(false);
    }
  }, []);

  const availableGroups = useMemo(
    () => portalNavGroups.filter((group) => hasPortalAccess(roles, group.destination)),
    [roles],
  );
  const customerItems = availableGroups.find((group) => group.destination === "customer")?.items ?? [];
  const sectionItems = availableGroups.find((group) => group.destination === section)?.items ?? [];

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mobileMenuOpen, pathname, section]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  if (isCustomerSection) {
    if (customerItems.length === 0) {
      return null;
    }

    if (variant === "drawer") {
      return (
        <nav
          aria-label="Customer portal navigation"
          className={cn("border-t border-lime-500/25 pt-3", className)}
        >
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.18em] text-lime-400/90">
            Customer portal
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {customerItems.map((item) => {
              const itemActive = isPortalNavItemActive(pathname, item);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-xl px-3 py-3 text-base font-semibold text-white transition hover:bg-white/10",
                      itemActive && "bg-lime-500/15 text-[var(--otg-primary)]",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-lime-500/25 px-3 pb-1 pt-4">
            <PortalSwitcherDropdown
              variant="dark"
              align="start"
              side="bottom"
              className="w-full justify-center"
              onNavigate={onNavigate}
            />
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                void handleLogout();
              }}
              disabled={loggingOut}
              className={cn(actionOutlineClass, "w-full justify-center")}
            >
              {loggingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        </nav>
      );
    }

    return (
      <div
        className={cn(
          "otg-portal-nav otg-portal-nav--customer overflow-visible rounded-[28px] border border-lime-500/40 bg-[#0b120d] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.35)]",
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
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={actionOutlineClass}
            >
              {loggingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sectionItems.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "hidden overflow-visible rounded-[28px] border border-lime-500/40 bg-[#0b120d] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.35)] md:block",
          className,
        )}
      >
        <div className="flex flex-col gap-3 overflow-visible sm:flex-row sm:items-center sm:gap-3">
          <nav
            aria-label={`${section} portal navigation`}
            className="-mx-1 min-w-0 flex-1 overflow-x-auto overflow-y-visible px-1 pb-1"
          >
            <ul className="flex min-w-max flex-nowrap gap-2 sm:min-w-0 sm:flex-wrap">
              {sectionItems.map((item) => {
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
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={actionOutlineClass}
            >
              {loggingOut ? "Signing out..." : "Log out"}
            </button>
          </div>
        </div>
      </div>
      <div className={cn("md:hidden", className)}>
        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[999] bg-black/55"
            aria-label="Close portal menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}
        <div className="relative z-[1000] flex justify-end">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-[#111a13] px-3 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
            aria-expanded={mobileMenuOpen}
            aria-controls={`${section}-portal-mobile-menu`}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            <span className="sr-only">{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        {mobileMenuOpen ? (
          <div
            id={`${section}-portal-mobile-menu`}
            className="relative z-[1000] mt-3 overflow-hidden rounded-[28px] border border-lime-500/40 bg-[#0b120d] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.4)]"
          >
            <nav aria-label={`${section} portal navigation`} className="space-y-2">
              {sectionItems.map((item) => {
                const itemActive = isPortalNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-xl px-3 py-3 text-base font-semibold text-white transition hover:bg-white/10",
                      itemActive ? "bg-lime-500/15 text-[var(--otg-primary)]" : null,
                    )}
                    onClick={() => {
                      onNavigate?.();
                      setMobileMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-lime-500/25 pt-4">
              <PortalSwitcherDropdown
                variant="dark"
                align="start"
                side="bottom"
                className="w-full justify-center"
                onNavigate={() => setMobileMenuOpen(false)}
              />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                disabled={loggingOut}
                className={cn(actionOutlineClass, "w-full justify-center")}
              >
                {loggingOut ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
