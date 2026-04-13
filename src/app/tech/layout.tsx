"use client";

import type { ReactNode } from "react";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";

export default function TechLayout({ children }: { children: ReactNode }) {
  return <PortalRouteGuard destination="tech">{children}</PortalRouteGuard>;
}
