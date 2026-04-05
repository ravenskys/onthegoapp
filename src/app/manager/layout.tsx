import type { ReactNode } from "react";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BackToPortalButton />
      {children}
    </>
  );
}
