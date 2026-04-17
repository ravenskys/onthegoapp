"use client";

import { CustomerPortalPageHeader } from "@/components/customer/CustomerPortalPageHeader";

type CustomerPortalShellProps = {
  title: string;
  subtitle: string;
  onLogout: () => void;
  children: React.ReactNode;
};

/** Customer portal content framed like the main marketing site (light shell; nav lives in SiteHeader). */
export function CustomerPortalShell({
  title,
  subtitle,
  onLogout,
  children,
}: CustomerPortalShellProps) {
  return (
    <div className="otg-section pb-12 pt-6 sm:pt-8">
      <div className="otg-site-container space-y-6">
        <CustomerPortalPageHeader title={title} subtitle={subtitle} onLogout={onLogout} />
        {children}
      </div>
    </div>
  );
}
