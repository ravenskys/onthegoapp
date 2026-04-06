"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/input-formatters";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { getErrorMessage } from "@/lib/tech-inspection";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

interface DeletedJobAuditEntry {
  id: string;
  job_id: string;
  business_job_number: string | null;
  customer_name: string | null;
  vehicle_label: string | null;
  status: string | null;
  priority: string | null;
  service_type: string | null;
  deleted_by_name: string | null;
  deleted_by_email: string | null;
  deleted_at: string;
  related_counts: Record<string, number> | null;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("technician");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [deletedJobs, setDeletedJobs] = useState<DeletedJobAuditEntry[]>([]);
  const [deletedJobsLoading, setDeletedJobsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      const { user, roles: roleNames } = await getUserRoles();

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (roleNames.length === 0) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roleNames, "admin")) {
        window.location.href = getPostLoginRoute(roleNames);
        return;
      }

      setAuthorized(true);
      await fetchDeletedJobs();
      setLoading(false);
    };

    checkAccess();
  }, []);

  const fetchDeletedJobs = async () => {
    setDeletedJobsLoading(true);

    try {
      const { data, error } = await supabase
        .from("deleted_jobs_audit")
        .select(`
          id,
          job_id,
          business_job_number,
          customer_name,
          vehicle_label,
          status,
          priority,
          service_type,
          deleted_by_name,
          deleted_by_email,
          deleted_at,
          related_counts
        `)
        .order("deleted_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setDeletedJobs(data ?? []);
    } catch (error) {
      console.error("Error fetching deleted jobs audit:", error);
    } finally {
      setDeletedJobsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
          role: selectedRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Failed to assign role.");
        setSubmitting(false);
        return;
      }

      setMessage(`Role "${selectedRole}" assigned to ${normalizeEmail(email)}.`);
      setEmail("");
      setSelectedRole("technician");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to assign role."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container max-w-6xl">
        <div className="otg-app-panel">
          <p className="text-slate-700">Loading admin dashboard...</p>
        </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="otg-page otg-portal-dark">
      <div className="otg-container max-w-6xl space-y-6">
        <div className="otg-app-panel">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <BrandLogo priority />
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="mt-2 text-slate-600">
                Manage users, roles, and system settings.
              </p>
            </div>

            <div className="w-full max-w-2xl space-y-4">
              <div className="flex justify-end">
                <PortalTopNav section="admin" />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <BackToPortalButton />
                <button
                  onClick={handleLogout}
                  className={headerActionButtonClassName}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="otg-app-panel">
          <h2 className="text-2xl font-bold text-slate-900">Assign User Role</h2>
          <p className="mt-2 text-slate-600">
            Add a role to an existing account by email.
          </p>

          <form onSubmit={handleAssignRole} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="otg-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                className="otg-input"
                placeholder="user@email.com"
              />
            </div>

            <div className="space-y-2">
              <label className="otg-label">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="otg-select"
              >
                <option value="customer">customer</option>
                <option value="technician">technician</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="otg-btn otg-btn-dark disabled:opacity-50"
            >
              {submitting ? "Assigning..." : "Assign Role"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="otg-app-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Deleted Job History</h2>
              <p className="mt-2 text-slate-600">
                Review recently deleted jobs and who removed them.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void fetchDeletedJobs()}
              className="otg-btn otg-btn-dark"
            >
              Refresh Log
            </button>
          </div>

          {deletedJobsLoading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Loading deleted job history...
            </div>
          ) : deletedJobs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No deleted jobs have been recorded yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {deletedJobs.map((entry) => {
                const relatedCounts = entry.related_counts ?? {};
                const relatedSummary = Object.entries(relatedCounts)
                  .filter(([, count]) => Number(count) > 0)
                  .map(([label, count]) => `${count} ${label.replaceAll("_", " ")}`)
                  .join(", ");

                return (
                  <div
                    key={entry.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Job #{entry.business_job_number || entry.job_id.slice(0, 8)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {entry.customer_name || "Unknown customer"}
                          {entry.vehicle_label ? ` • ${entry.vehicle_label}` : ""}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {entry.service_type || "General service"}
                          {entry.status ? ` • ${entry.status.replaceAll("_", " ")}` : ""}
                          {entry.priority ? ` • ${entry.priority} priority` : ""}
                        </p>
                      </div>

                      <div className="text-sm text-slate-600 md:text-right">
                        <p className="font-medium text-slate-900">
                          {entry.deleted_by_name || entry.deleted_by_email || "Unknown user"}
                        </p>
                        {entry.deleted_by_email && (
                          <p>{entry.deleted_by_email}</p>
                        )}
                        <p>{new Date(entry.deleted_at).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      {relatedSummary || "No related child records were logged for this deletion."}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
