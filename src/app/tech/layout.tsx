import type { Metadata } from "next";
import type { ReactNode } from "react";
import TechLayoutClient from "./TechLayoutClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TechLayout({ children }: { children: ReactNode }) {
  return <TechLayoutClient>{children}</TechLayoutClient>;
}
