import { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

type PublicSiteLayoutProps = {
  activePath: string;
  children: ReactNode;
};

export function PublicSiteLayout({ activePath, children }: PublicSiteLayoutProps) {
  return (
    <div className="otg-site-shell">
      <SiteHeader activePath={activePath} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
