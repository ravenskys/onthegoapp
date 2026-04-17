"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/customer";

  return (
    <PublicSiteLayout activePath={pathname}>
      <PortalRouteGuard destination="customer" allowCustomerAuthPaths>
        {children}
      </PortalRouteGuard>
    </PublicSiteLayout>
  );
}
