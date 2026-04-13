"use client";

import type { ReactNode } from "react";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalRouteGuard destination="admin">{children}</PortalRouteGuard>;
}
