"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold text-slate-900">Link Customer Account</h1>
        <p className="mt-3 text-slate-700">{status}</p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
          Logged in email: {email || "-"}
        </div>

        <button
          onClick={handleLink}
          className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Link My Account
        </button>
      </div>
    </div>
  );
}