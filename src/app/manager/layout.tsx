"use client";

import type { ReactNode } from "react";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <PortalRouteGuard destination="manager">{children}</PortalRouteGuard>;
}
