"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  getPostLoginRoute,
  getUserRoles,
  hasPortalAccess,
  type PortalDestination,
} from "@/lib/portal-auth";

const CUSTOMER_AUTH_PATH_PREFIXES = [
  "/customer/login",
  "/customer/signup",
  "/customer/reset-password",
] as const;

function isCustomerAuthPath(pathname: string) {
  return CUSTOMER_AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type PortalRouteGuardProps = {
  destination: PortalDestination;
  children: ReactNode;
  /** When true, paths under /customer/login|signup|reset-password skip the guard. */
  allowCustomerAuthPaths?: boolean;
};

export function PortalRouteGuard({
  destination,
  children,
  allowCustomerAuthPaths = false,
}: PortalRouteGuardProps) {
  const pathname = usePathname();
  const skipGuard = allowCustomerAuthPaths && isCustomerAuthPath(pathname);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (skipGuard) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      const { user, roles } = await getUserRoles();

      if (cancelled) {
        return;
      }

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roles, destination)) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      setReady(true);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [destination, skipGuard]);

  if (skipGuard) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return <>{children}</>;
}
