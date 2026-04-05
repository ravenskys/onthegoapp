"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";

export default function CustomerLinkPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setStatus("You must be logged in first.");
        return;
      }

      setEmail(user.email || "");
      setStatus("Ready to link your account.");
    };

    loadUser();
  }, []);

  const handleLink = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("You must be logged in.");
      return;
    }

    console.log("Auth user:", user);

    const { data: matchingCustomers, error: findError } = await supabase
      .from("customers")
      .select("*")
      .eq("email", user.email);

    console.log("Matching customers:", matchingCustomers);
    console.log("Find error:", findError);

    if (findError) {
      alert(`Find error: ${findError.message}`);
      return;
    }

    if (!matchingCustomers || matchingCustomers.length === 0) {
      alert("No customer row found with that email.");
      return;
    }

    const customer = matchingCustomers[0];

    const { error: updateError } = await supabase
      .from("customers")
      .update({ auth_user_id: user.id })
      .eq("id", customer.id);

    console.log("Update error:", updateError);

    if (updateError) {
      alert(`Update error: ${updateError.message}`);
      return;
    }

    alert("Account linked successfully.");
    window.location.href = "/customer/dashboard";
  };

  return (
    <div className="otg-page">
      <div className="otg-container max-w-md">
      <div className="otg-app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Link Customer Account</h1>
          <BackToPortalButton className="otg-btn otg-btn-secondary shadow-none" />
        </div>
        <p className="mt-3 text-slate-700">{status}</p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
          Logged in email: {email || "-"}
        </div>

        <button
          onClick={handleLink}
          className="otg-btn otg-btn-dark mt-6 w-full"
        >
          Link My Account
        </button>
      </div>
      </div>
    </div>
  );
}
