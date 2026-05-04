"use client";

import { useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { normalizeEmail } from "@/lib/input-formatters";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  getPostLoginRouteForDestination,
  getUserRoles,
} from "@/lib/portal-auth";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    if (supabaseConfigError) {
      setLoading(false);
      setLoginError(supabaseConfigError);
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    let errorMessage: string | null = null;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        errorMessage = error.message;
      }
    } catch {
      errorMessage =
        "Could not reach Supabase while signing in. If this is the deployed site, check the Vercel NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values and redeploy.";
    }

    if (errorMessage) {
      setLoading(false);
      setLoginError(
        `${errorMessage} If you are new here, you can create an account instead.`
      );
      return;
    }

    const { user, roles } = await getUserRoles();

    if (!user) {
      setLoading(false);
      alert("Could not load user after login.");
      return;
    }

    setLoading(false);

    if (!roles.length) {
      alert("Could not load user role.");
      return;
    }

    const next =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("next");

    router.push(getPostLoginRouteForDestination(roles, next));
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert("Enter your email first.");
      return;
    }

    if (supabaseConfigError) {
      alert(supabaseConfigError);
      return;
    }

    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    let errorMessage: string | null = null;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/customer/reset-password`,
        }
      );

      if (error) {
        errorMessage = error.message;
      }
    } catch {
      errorMessage =
        "Could not reach Supabase to send the reset email. Check the public Supabase env vars for this environment and redeploy if needed.";
    }

    setLoading(false);

    if (errorMessage) {
      alert(errorMessage);
      return;
    }

    alert("Password reset email sent.");
  };

  return (
    <>
      <PublicPageHero
        title="Customer"
        accent="Login"
        body="Sign in to view inspection reports, vehicle history, and service recommendations."
      />

      <section className="otg-section">
        <div className="otg-site-container">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
            <div className="otg-card-dark overflow-hidden p-0">
              <div
                className="flex h-full min-h-[320px] flex-col justify-end bg-cover bg-center p-8"
                style={{ backgroundImage: "url('/images/inspection.webp')" }}
              >
                <div className="max-w-lg rounded-2xl p-6 backdrop-blur-sm">
                  <BrandLogo surface="dark" priority />
                  <h2 className="mt-3 text-3xl font-bold uppercase text-white">
                    Customer Portal
                  </h2>
                  <p className="mt-3 text-sm text-white/85">
                    Access service history, documents, and updates tied to your account.
                  </p>
                </div>
              </div>
            </div>

            <div className="otg-contact-card">
              <div className="otg-eyebrow">Secure Account Access</div>
              <h2 className="otg-page-title">Sign In</h2>
              <p className="otg-body mt-2">
                Use the email connected to your service records to access your portal.
              </p>

              <form onSubmit={handlePasswordLogin} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label className="otg-label">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(normalizeEmail(e.target.value))}
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

                <div className="otg-button-row pt-2">
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

              {loginError && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="otg-card-title text-red-700">Sign-in issue</div>
                  <p className="mt-2 text-sm text-red-700">{loginError}</p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => router.push("/customer/signup")}
                      className="otg-btn otg-btn-secondary"
                    >
                      Go to Sign Up
                    </button>
                  </div>
                </div>
              )}

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
      </section>
    </>
  );
}
