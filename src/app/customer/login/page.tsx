"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      alert("Could not load user after login.");
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    setLoading(false);

    if (rolesError || !roles || roles.length === 0) {
      alert("Could not load user role.");
      return;
    }

    const roleNames = roles.map((r) => r.role);

    if (roleNames.length > 1) {
      router.push("/portal");
      return;
    }

    if (roleNames.includes("customer")) {
      router.push("/customer/dashboard");
      return;
    }

    if (roleNames.includes("technician")) {
      router.push("/tech");
      return;
    }

    if (roleNames.includes("manager")) {
      router.push("/manager");
      return;
    }

    if (roleNames.includes("admin")) {
      router.push("/admin");
      return;
    }

    alert("No valid role found for this account.");
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert("Enter your email first.");
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: "http://localhost:3000/customer/reset-password",
      }
    );

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent.");
  };

  return (
    <div className="otg-page">
      <div className="otg-container max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="otg-card-dark overflow-hidden p-0">
            <div
              className="flex h-full min-h-[320px] flex-col justify-end bg-cover bg-center p-8"
              style={{ backgroundImage: "url('/inspection.png')" }}
            >
              <div className="max-w-lg rounded-2xl bg-black/0 p-6 backdrop-blur-sm">
                <div className=".otg-brand-title-black">
                  On The Go Maintenance
                </div>
                <h1 className="mt-3 text-3xl font-bold uppercase text-white">
                  Customer Portal
                </h1>
                <p className="mt-3 text-sm text-white/85">
                  Sign in to view inspection reports, vehicle history, and service recommendations.
                </p>
              </div>
            </div>
          </div>

          <div className="otg-card p-8 md:p-10">
            <div className="otg-eyebrow">Secure Account Access</div>
            <h2 className="otg-page-title">Sign In</h2>
            <p className="otg-body mt-2">
              Access your vehicle inspection history and service documents.
            </p>

            <form onSubmit={handlePasswordLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="otg-label">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="otg-input"
                  placeholder="customer@email.com"
                />
              </div>

              <div className="space-y-2">
                <label className="otg-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="otg-input"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="otg-btn otg-btn-primary disabled:opacity-50"
                >
                  {loading ? "Signing In..." : "Sign In"}
                </button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="otg-btn otg-btn-secondary disabled:opacity-50"
                >
                  Forgot Password
                </button>
              </div>
            </form>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="otg-card-title">New Here?</div>
              <p className="otg-body mt-2">
                Create an account using the same email connected to your service records.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => router.push("/customer/signup")}
                  className="otg-btn otg-btn-secondary"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}