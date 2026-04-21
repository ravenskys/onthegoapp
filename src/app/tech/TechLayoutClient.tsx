"use client";

import type { ReactNode } from "react";
import { PortalRouteGuard } from "@/components/portal/PortalRouteGuard";

export default function TechLayoutClient({ children }: { children: ReactNode }) {
  return <PortalRouteGuard destination="tech">{children}</PortalRouteGuard>;
}
