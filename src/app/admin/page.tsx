"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

      if (error || !data || data.length === 0) {
        window.location.href = "/customer/login";
        return;
      }

      const roleNames = data.map((r: any) => r.role);
      setRoles(roleNames);

      if (!roleNames.includes("admin")) {
        if (roleNames.includes("manager")) {
          window.location.href = roleNames.length > 1 ? "/portal" : "/manager";
          return;
        }

        if (roleNames.includes("technician")) {
          window.location.href = roleNames.length > 1 ? "/portal" : "/tech";
          return;
        }

        if (roleNames.includes("customer")) {
          window.location.href =
            roleNames.length > 1 ? "/portal" : "/customer/dashboard";
          return;
        }

        window.location.href = "/customer/login";
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
          email: email.trim().toLowerCase(),
          role: selectedRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Failed to assign role.");
        setSubmitting(false);
        return;
      }

      setMessage(`Role "${selectedRole}" assigned to ${email.trim().toLowerCase()}.`);
      setEmail("");
      setSelectedRole("technician");
    } catch (error: any) {
      setMessage(error?.message || "Failed to assign role.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
          <p className="text-slate-700">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="otg-brand-title-black">
                On The Go Maintenance
              </div>
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
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Portal Home
                </a>
              )}

              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
          <h2 className="text-2xl font-bold text-slate-900">Assign User Role</h2>
          <p className="mt-2 text-slate-600">
            Add a role to an existing account by email.
          </p>

          <form onSubmit={handleAssignRole} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
                placeholder="user@email.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
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
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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