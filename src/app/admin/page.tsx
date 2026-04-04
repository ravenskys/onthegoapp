"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/input-formatters";
import { getPostLoginRoute, getUserRoles } from "@/lib/portal-auth";
import { getErrorMessage } from "@/lib/tech-inspection";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("technician");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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
      setRoles(roleNames);

      if (!roleNames.includes("admin")) {
        window.location.href = getPostLoginRoute(roleNames);
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkAccess();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    <div className="otg-page">
      <div className="otg-container max-w-6xl space-y-6">
        <div className="otg-app-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <BrandLogo priority />
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="mt-2 text-slate-600">
                Manage users, roles, and system settings.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {roles.length > 1 && (
                <a
                  href="/portal"
                  className="otg-btn otg-btn-secondary"
                >
                  Portal Home
                </a>
              )}

              <button
                onClick={handleLogout}
                className="otg-btn otg-btn-secondary"
              >
                Log Out
              </button>
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
      </div>
    </div>
  );
}
