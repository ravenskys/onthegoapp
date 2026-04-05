"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getUserRoles, hasMultiplePortalAccess } from "@/lib/portal-auth";

export function BackToPortalButton() {
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
    <div className="pointer-events-none fixed right-4 top-4 z-50 md:right-6 md:top-6">
      <Link
        href="/portal"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>
    </div>
  );
}
