import type { ReactNode } from "react";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BackToPortalButton />
      {children}
    </>
  );
}
