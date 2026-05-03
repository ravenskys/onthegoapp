"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { formatPhoneNumber, normalizeEmail, normalizePhoneExtension } from "@/lib/input-formatters";
import { getEmailInputWarning } from "@/lib/input-validation-feedback";
import { CustomerContactFields } from "@/components/customer/CustomerContactFields";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getPostLoginRoute, getUserRoles } from "@/lib/portal-auth";

export default function CustomerSignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [email, setEmail] = useState("");
  const [emailFormatHint, setEmailFormatHint] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (supabaseConfigError) {
        throw new Error(supabaseConfigError);
      }

      const normalizedEmail = normalizeEmail(email);
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedPhone = formatPhoneNumber(phone).trim();
      const trimmedExtension = normalizePhoneExtension(phoneExtension);

      let data;
      let error;

      try {
        ({ data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        }));
      } catch {
        throw new Error(
          "Could not reach Supabase while creating the account. If this is the deployed site, verify the Vercel public Supabase env vars and redeploy."
        );
      }

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

      const { data: existingCustomers, error: customerLookupError } = await supabase
        .from("customers")
        .select("*")
        .eq("email", normalizedEmail)
        .limit(1);

      if (customerLookupError) {
        throw new Error(customerLookupError.message);
      }

      const existingCustomer =
        existingCustomers?.find((customer) => customer.auth_user_id === user.id) ||
        (() => {
          const claimableCustomers =
            existingCustomers?.filter((customer) => !customer.auth_user_id) || [];

          if (claimableCustomers.length > 1) {
            throw new Error(
              "We found more than one customer record for this email. Please contact the shop so we can link the right profile."
            );
          }

          return claimableCustomers[0] || null;
        })();

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
        if (
          existingCustomer.auth_user_id &&
          existingCustomer.auth_user_id !== user.id
        ) {
          setLoading(false);
          alert(
            "An account already exists for this email. Please sign in or use Forgot Password."
          );
          router.push("/customer/login");
          return;
        }

        const { error: updateCustomerError } = await supabase
          .from("customers")
          .update({
            auth_user_id: user.id,
            first_name: existingCustomer.first_name || trimmedFirstName,
            last_name: existingCustomer.last_name || trimmedLastName,
            phone: existingCustomer.phone || trimmedPhone,
            phone_extension: trimmedExtension || null,
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
            phone_extension: trimmedExtension || null,
            email: normalizedEmail,
            auth_user_id: user.id,
          },
        ]);

        if (insertCustomerError) {
          throw new Error(insertCustomerError.message);
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const { user: signedInUser, roles } = await getUserRoles();

      if (!signedInUser) {
        throw new Error("Account was created, but automatic sign-in failed.");
      }

      if (!roles.length) {
        throw new Error("Account was created, but no portal role was found.");
      }

      sessionStorage.setItem("customerSignupAutoLoginSuccess", "1");
      setLoading(false);
      router.push(getPostLoginRoute(roles));
    } catch (error) {
      setLoading(false);
      alert(error instanceof Error ? error.message : "Signup failed.");
    }
  };

  return (
    <div className="otg-page">
      <div className="otg-container max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="otg-card-dark overflow-hidden p-0">
            <div
              className="flex h-full min-h-[320px] flex-col justify-end bg-cover bg-center p-8"
              style={{ backgroundImage: "url('/images/preventive-maintenance.webp')" }}
            >
              <div className="max-w-lg rounded-2xl bg-black/55 p-6 backdrop-blur-sm">
                <BrandLogo surface="dark" priority />
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
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Already have an account please{" "}
              <button
                type="button"
                onClick={() => router.push("/customer/login")}
                className="font-semibold text-lime-700 underline underline-offset-2 hover:text-lime-800"
              >
                Login
              </button>
              .
            </div>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <CustomerContactFields
                firstName={firstName}
                lastName={lastName}
                phone={phone}
                phoneExtension={phoneExtension}
                setFirstName={setFirstName}
                setLastName={setLastName}
                setPhone={(value) => setPhone(formatPhoneNumber(value))}
                setPhoneExtension={(value) => setPhoneExtension(normalizePhoneExtension(value))}
              />

              <div className="space-y-2">
                <label className="otg-label">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setEmailFormatHint(getEmailInputWarning(raw));
                    setEmail(normalizeEmail(raw));
                  }}
                  className="otg-input"
                  placeholder="customer@email.com"
                />
                {emailFormatHint ? (
                  <p className="text-xs text-amber-800">{emailFormatHint}</p>
                ) : null}
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
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
