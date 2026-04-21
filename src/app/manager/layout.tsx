import type { Metadata } from "next";
import type { ReactNode } from "react";
import ManagerLayoutClient from "./ManagerLayoutClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <ManagerLayoutClient>{children}</ManagerLayoutClient>;
}
