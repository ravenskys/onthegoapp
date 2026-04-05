"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";
import { getUserRoles, hasPortalAccess, type PortalRole } from "@/lib/portal-auth";

export default function PortalChooserPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<PortalRole[]>([]);

  useEffect(() => {
    const loadRoles = async () => {
      const { user, roles } = await getUserRoles();

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!roles.length) {
        window.location.href = "/customer/login";
        return;
      }

      setRoles(roles);
      setLoading(false);
    };

    loadRoles();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  if (loading) {
    return (
      <PublicSiteLayout activePath="/portal">
        <section className="otg-section">
          <div className="otg-site-container">
            <div className="otg-contact-card">
              <p className="otg-body">Loading portal options...</p>
            </div>
          </div>
        </section>
      </PublicSiteLayout>
    );
  }

  return (
    <PublicSiteLayout activePath="/portal">
      <PublicPageHero
        title="Portal"
        accent="Login"
        body="Choose the area of the system you want to enter with this account."
      />

      <section className="otg-section">
        <div className="otg-site-container">
          <div className="otg-contact-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="otg-section-title">Choose Your Portal</h2>
                <p className="otg-body">
                  This account has access to more than one portal. Choose where you
                  want to go.
                </p>
              </div>

              <button onClick={handleLogout} className="otg-btn otg-btn-secondary">
                Log Out
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {hasPortalAccess(roles, "customer") && (
                <Link
                  href="/customer/dashboard"
                  className="otg-service-card block"
                >
                  <div className="otg-card-title">Customer Portal</div>
                  <p className="otg-body mt-2">
                    View inspection reports, photos, and vehicle history.
                  </p>
                </Link>
              )}

              {hasPortalAccess(roles, "tech") && (
                <Link href="/tech" className="otg-service-card block">
                  <div className="otg-card-title">Technician Portal</div>
                  <p className="otg-body mt-2">
                    Complete inspections, upload photos, and generate reports.
                  </p>
                </Link>
              )}

              {hasPortalAccess(roles, "manager") && (
                <Link href="/manager" className="otg-service-card block">
                  <div className="otg-card-title">Manager Portal</div>
                  <p className="otg-body mt-2">
                    Search customer history, review reports, and support follow-up.
                  </p>
                </Link>
              )}

              {hasPortalAccess(roles, "admin") && (
                <Link href="/admin" className="otg-service-card block">
                  <div className="otg-card-title">Admin Portal</div>
                  <p className="otg-body mt-2">
                    Assign roles and manage account access across the system.
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
