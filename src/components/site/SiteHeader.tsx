"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { siteNavItems } from "./site-config";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getPostLoginRoute, getUserRoles, hasPortalAccess, type PortalRole } from "@/lib/portal-auth";
import { getBookNowHref, isBookNowNavActive } from "@/lib/site-booking";

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

  const loggedIn = roles.length > 0;
  const portalHref = loggedIn ? getPostLoginRoute(roles) : "/portal";
  const portalLabel = loggedIn ? "My Portal" : "Login";
  const showCustomerPortalNav =
    authReady && hasPortalAccess(roles, "customer");

  const portalLinkActive = useMemo(() => {
    if (!loggedIn) {
      return activePath === "/portal";
    }
    return isInPortalExperience(activePath, roles);
  }, [activePath, loggedIn, roles]);

  /** Hide Contact Us for customer accounts (scheduler + Contact Us sub-tab cover it). */
  const headerNavItems = useMemo(() => {
    if (authReady && roles.includes("customer")) {
      return siteNavItems.filter((item) => item.href !== BOOK_NOW_HREF);
    }
    return siteNavItems;
  }, [authReady, roles]);

  return (
    <header className="otg-site-header overflow-visible">
      <div className="otg-site-container otg-site-nav">
        <Link href="/" className="otg-site-logo">
          <Image
            src="/logo-transparent-2026.png"
            alt="On The Go Maintenance Logo"
            width={56}
            height={56}
          />
          <div className="otg-site-logo-text">
            On The <span>Go</span> Maintenance
          </div>
        </Link>

        <nav aria-label="Site sections">
          <ul className="otg-site-nav-links">
            {headerNavItems.map((item) => {
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

              return (
                <li key={item.href}>
                  <Link href={href} className={isActive ? "active" : undefined}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {showCustomerPortalNav ? (
        <div className="overflow-visible border-t border-lime-500/25 px-[5%] pb-3 pt-3 sm:px-0">
          <div className="otg-site-container overflow-visible">
            <PortalTopNav section="customer" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
