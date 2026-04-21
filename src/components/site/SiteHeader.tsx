"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { siteNavItems } from "./site-config";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import {
  getPostLoginRoute,
  getUserRoles,
  hasPortalAccess,
  type PortalRole,
} from "@/lib/portal-auth";
import { getBookNowHref, isBookNowNavActive } from "@/lib/site-booking";
import { isPortalNavItemActive, portalNavGroups } from "@/lib/portal-nav-config";
import { PortalSwitcherDropdown } from "@/components/portal/PortalSwitcherDropdown";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const BOOK_NOW_HREF = "/contact";

type SiteHeaderProps = {
  activePath: string;
};

/** True when the current path is the portal chooser or any role portal area the user can access. */
function isInPortalExperience(activePath: string, roles: PortalRole[]): boolean {
  if (activePath === "/portal") {
    return true;
  }
  if (hasPortalAccess(roles, "customer") && activePath.startsWith("/customer")) {
    return true;
  }
  if (hasPortalAccess(roles, "tech") && activePath.startsWith("/tech")) {
    return true;
  }
  if (hasPortalAccess(roles, "manager") && activePath.startsWith("/manager")) {
    return true;
  }
  if (hasPortalAccess(roles, "admin") && activePath.startsWith("/admin")) {
    return true;
  }
  return false;
}

export function SiteHeader({ activePath }: SiteHeaderProps) {
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { roles: nextRoles } = await getUserRoles();
        if (isMounted) {
          setRoles(nextRoles);
        }
      } catch (error) {
        console.error("SiteHeader: failed to load roles", error);
        if (isMounted) {
          setRoles([]);
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activePath]);

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

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  }, []);

  const loggedIn = roles.length > 0;
  const portalHref = loggedIn ? getPostLoginRoute(roles) : "/portal";
  const portalLabel = loggedIn ? "My Portal" : "Login";
  const showCustomerPortalNav =
    authReady && hasPortalAccess(roles, "customer");

  const customerPortalItems = useMemo(
    () =>
      portalNavGroups.find((group) => group.destination === "customer")?.items ??
      [],
    [],
  );

  const portalLinkActive = useMemo(() => {
    if (!loggedIn) {
      return activePath === "/portal";
    }
    return isInPortalExperience(activePath, roles);
  }, [activePath, loggedIn, roles]);

  const headerNavItems = useMemo(() => {
    if (authReady && roles.includes("customer")) {
      return siteNavItems.filter((item) => item.href !== BOOK_NOW_HREF);
    }
    return siteNavItems;
  }, [authReady, roles]);

  const mainNavLinks = useMemo(() => {
    return headerNavItems.map((item) => {
      const isPortalSlot = item.href === "/portal";
      const isContactSlot = item.href === BOOK_NOW_HREF;
      const href = isPortalSlot
        ? portalHref
        : isContactSlot
          ? getBookNowHref(roles)
          : item.href;
      const label = isPortalSlot ? portalLabel : item.label;
      const isActive = isPortalSlot
        ? portalLinkActive
        : isContactSlot
          ? isBookNowNavActive(activePath, roles)
          : activePath === item.href;

      return {
        key: item.href,
        href,
        label,
        isActive,
      };
    });
  }, [headerNavItems, portalHref, portalLabel, portalLinkActive, activePath, roles]);

  const linkClass = (isActive: boolean) =>
    cn(
      "block rounded-lg px-3 py-3 text-base font-semibold transition-colors md:py-0",
      isActive ? "text-[var(--otg-primary)]" : "text-white hover:text-[var(--otg-primary)]",
    );

  return (
    <header className="otg-site-header relative z-[1000] overflow-visible">
      {mobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[999] bg-black/55 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "otg-site-container otg-site-nav otg-site-nav--mobile-bar",
        )}
      >
        <Link href="/" className="otg-site-logo min-w-0 shrink">
          <Image
            src="/logo-transparent-2026.png"
            alt="On The Go Maintenance Logo"
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 md:h-14 md:w-14"
          />
          <div className="otg-site-logo-text truncate text-sm font-extrabold uppercase tracking-wide md:text-2xl">
            On The <span>Go</span> Maintenance
          </div>
        </Link>

        <button
          type="button"
          className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-controls="site-mobile-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden />
          ) : (
            <Menu className="h-6 w-6" aria-hidden />
          )}
          <span className="sr-only">{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
        </button>

        <nav className="hidden md:block" aria-label="Site sections">
          <ul className="otg-site-nav-links">
            {mainNavLinks.map(({ key, href, label, isActive }) => (
              <li key={key}>
                <Link href={href} className={isActive ? "active" : undefined}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {mobileMenuOpen ? (
        <div
          id="site-mobile-menu"
          className="absolute left-0 right-0 top-full z-[1001] max-h-[min(85vh,calc(100dvh-3.5rem))] overflow-y-auto overscroll-contain border-b border-lime-500/35 bg-[var(--otg-black)] shadow-[0_24px_48px_rgba(0,0,0,0.45)] md:hidden"
        >
          <div className="otg-site-container flex flex-col gap-1 py-4">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.2em] text-lime-400/90">
              Website
            </p>
            {mainNavLinks.map(({ key, href, label, isActive }) => (
              <Link
                key={key}
                href={href}
                className={linkClass(isActive)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </Link>
            ))}

            {showCustomerPortalNav && customerPortalItems.length > 0 ? (
              <>
                <div className="my-3 border-t border-white/15" role="presentation" />
                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.2em] text-lime-400/90">
                  Customer portal
                </p>
                {customerPortalItems.map((item) => {
                  const itemActive = isPortalNavItemActive(activePath, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={linkClass(itemActive)}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-2 flex flex-col gap-2 border-t border-white/15 px-3 pt-4">
                  <PortalSwitcherDropdown
                    variant="dark"
                    align="start"
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void handleLogout();
                    }}
                    className="rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-left text-base font-semibold text-white"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCustomerPortalNav ? (
        <div className="hidden overflow-visible border-t border-lime-500/25 px-[5%] pb-3 pt-3 md:block sm:px-0">
          <div className="otg-site-container overflow-visible">
            <PortalTopNav section="customer" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
