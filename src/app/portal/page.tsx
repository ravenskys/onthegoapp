"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PortalChooserPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const loadRoles = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/customer/login";
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error || !data) {
        window.location.href = "/customer/login";
        return;
      }

      setRoles(data.map((r: any) => r.role));
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
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading portal options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-page">
      <div className="otg-container max-w-5xl">
        <div className="otg-card p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="otg-brand-title-black">On The Go Maintenance</div>
              <h1 className="otg-page-title">Choose Your Portal</h1>
              <p className="otg-body mt-2">
                This account has access to more than one portal. Choose where you want to go.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="otg-btn otg-btn-secondary"
            >
              Log Out
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {roles.includes("customer") && (
              <a
                href="/customer/dashboard"
                className="otg-card block p-6 transition hover:-translate-y-1"
              >
                <div className="otg-card-title">Customer Portal</div>
                <p className="otg-body mt-2">
                  View inspection reports, photos, and vehicle history.
                </p>
              </a>
            )}

            {roles.includes("technician") && (
              <a
                href="/tech"
                className="otg-card block p-6 transition hover:-translate-y-1"
              >
                <div className="otg-card-title">Technician Portal</div>
                <p className="otg-body mt-2">
                  Complete inspections, upload photos, and generate reports.
                </p>
              </a>
            )}

            {roles.includes("manager") && (
              <a
                href="/manager"
                className="otg-card block p-6 transition hover:-translate-y-1"
              >
                <div className="otg-card-title">Manager Portal</div>
                <p className="otg-body mt-2">
                  Search customer history, review reports, and support follow-up.
                </p>
              </a>
            )}

            {roles.includes("admin") && (
              <a
                href="/admin"
                className="otg-card block p-6 transition hover:-translate-y-1"
              >
                <div className="otg-card-title">Admin Portal</div>
                <p className="otg-body mt-2">
                  Assign roles and manage account access across the system.
                </p>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}