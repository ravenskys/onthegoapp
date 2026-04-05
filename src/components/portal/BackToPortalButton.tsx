"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getUserRoles, hasMultiplePortalAccess } from "@/lib/portal-auth";
import { cn } from "@/lib/utils";

type BackToPortalButtonProps = {
  className?: string;
};

export function BackToPortalButton({ className }: BackToPortalButtonProps) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      const { roles } = await getUserRoles();

      if (!isMounted) {
        return;
      }

      setShowButton(hasMultiplePortalAccess(roles));
    };

    void loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!showButton) {
    return null;
  }

  return (
    <Link
      href="/portal"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Portal
    </Link>
  );
}
