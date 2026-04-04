"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully.");
    router.push("/customer/login");
  };

  return (
    <div className="otg-page">
      <div className="otg-container max-w-md">
        <div className="otg-app-panel">
          <div className="mb-6">
            <BrandLogo priority />
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Reset Password
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="otg-label">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="otg-input"
                placeholder="Enter a new password"
              />
            </div>

            <div className="space-y-2">
              <label className="otg-label">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="otg-input"
                placeholder="Confirm your new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="otg-btn otg-btn-dark w-full disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
