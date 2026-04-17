"use client";

import { useEffect } from "react";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";
import { getPrimaryPortalRoute, getUserRoles } from "@/lib/portal-auth";

/**
 * `/portal` used to be a chooser page. Switching portals is now done via the **Portals**
 * dropdown in the site header (customer strip or account headers). This route redirects
 * signed-in users to their primary portal home.
 */
export default function PortalRedirectPage() {
  useEffect(() => {
    const run = async () => {
      const { user, roles } = await getUserRoles();

      if (!user || !roles.length) {
        window.location.replace("/customer/login");
        return;
      }

      window.location.replace(getPrimaryPortalRoute(roles));
    };

    void run();
  }, []);

  return (
    <PublicSiteLayout activePath="/portal">
      <section className="otg-section">
        <div className="otg-site-container">
          <div className="otg-contact-card">
            <p className="otg-body">Redirecting to your portal…</p>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
