"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CustomerSignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedPhone = phone.trim();

      const { data: existingCustomers, error: customerLookupError } = await supabase
        .from("customers")
        .select("*")
        .eq("email", normalizedEmail)
        .limit(1);

      if (customerLookupError) {
        throw new Error(customerLookupError.message);
      }

      const existingCustomer =
        existingCustomers && existingCustomers.length > 0
          ? existingCustomers[0]
          : null;

      if (existingCustomer?.auth_user_id) {
        setLoading(false);
        alert(
          "An account already exists for this email. Please sign in or use Forgot Password."
        );
        router.push("/customer/login");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          setLoading(false);
          alert(
            "An account already exists for this email. Please sign in or use Forgot Password."
          );
          router.push("/customer/login");
          return;
        }

        throw new Error(error.message);
      }

      const user = data.user;

      if (!user) {
        throw new Error("User account was not created.");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: normalizedEmail,
            role: "customer",
          },
          { onConflict: "id" }
        );

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: user.id,
            role: "customer",
          },
          { onConflict: "user_id,role" }
        );

      if (roleError) {
        throw new Error(roleError.message);
      }

      if (existingCustomer) {
        const { error: updateCustomerError } = await supabase
          .from("customers")
          .update({
            auth_user_id: user.id,
            first_name: existingCustomer.first_name || trimmedFirstName,
            last_name: existingCustomer.last_name || trimmedLastName,
            phone: existingCustomer.phone || trimmedPhone,
            email: normalizedEmail,
          })
          .eq("id", existingCustomer.id);

        if (updateCustomerError) {
          throw new Error(updateCustomerError.message);
        }
      } else {
        const { error: insertCustomerError } = await supabase.from("customers").insert([
          {
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            phone: trimmedPhone,
            email: normalizedEmail,
            auth_user_id: user.id,
          },
        ]);

        if (insertCustomerError) {
          throw new Error(insertCustomerError.message);
        }
      }

      setLoading(false);
      alert("Account created. You can now sign in.");
      router.push("/customer/login");
    } catch (error: any) {
      setLoading(false);
      alert(error?.message || "Signup failed.");
    }
  };

  return (
    <div className="otg-page">
      <div className="otg-container max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="otg-card-dark overflow-hidden p-0">
            <div
              className="flex h-full min-h-[320px] flex-col justify-end bg-cover bg-center p-8"
              style={{ backgroundImage: "url('/preventive-maintenance.png')" }}
            >
              <div className="max-w-lg rounded-2xl bg-black/55 p-6 backdrop-blur-sm">
                <div className="otg-brand-title-white">On The Go Maintenance</div>
                <h1 className="mt-3 text-3xl font-bold uppercase text-white">
                  Create Your Account
                </h1>
                <p className="mt-3 text-sm text-white/85">
                  Use the same email connected to your service records so your
                  inspection history links automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="otg-card p-8 md:p-10">
            <div className="otg-eyebrow">Customer Registration</div>
            <h2 className="otg-page-title">Sign Up</h2>
            <p className="otg-body mt-2">
              Create one account to access inspection reports, vehicle history,
              and recommendations.
            </p>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="otg-label">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="otg-input"
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <label className="otg-label">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="otg-input"
                  placeholder="Smith"
                />
              </div>

              <div className="space-y-2">
                <label className="otg-label">Phone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="otg-input"
                  placeholder="(555) 555-5555"
                />
              </div>

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
                  placeholder="Create a password"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="otg-btn otg-btn-primary disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/customer/login")}
                  className="otg-btn otg-btn-secondary"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}