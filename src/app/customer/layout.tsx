"use client";

import type { ReactNode } from "react";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <PortalRouteGuard destination="customer" allowCustomerAuthPaths>
      {children}
    </PortalRouteGuard>
  );
}
