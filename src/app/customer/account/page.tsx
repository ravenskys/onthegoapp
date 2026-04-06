"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { CustomerContactFields } from "@/components/customer/CustomerContactFields";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { getErrorMessage } from "@/lib/tech-inspection";
import { formatPhoneNumber, normalizeEmail } from "@/lib/input-formatters";
import {
  CustomerPortalRecord,
  fetchCustomerPortalData,
} from "@/lib/customer-portal";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

export default function CustomerAccountPage() {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerPortalRecord | null>(null);
  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    const loadPage = async () => {
      try {
        const { user, roles } = await getUserRoles();

        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (!hasPortalAccess(roles, "customer")) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }

        const data = await fetchCustomerPortalData(user.id);
        setCustomer(data.customer);
        setAccountFirstName(data.customer?.first_name || "");
        setAccountLastName(data.customer?.last_name || "");
        setAccountPhone(data.customer?.phone || "");
        setAccountEmail(data.customer?.email || "");
      } catch (error) {
        console.error("Customer account load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleSaveAccountInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer?.id) return;

    setSavingAccount(true);
    setAccountMessage("");

    try {
      const trimmedFirstName = accountFirstName.trim();
      const trimmedLastName = accountLastName.trim();
      const trimmedPhone = formatPhoneNumber(accountPhone).trim();
      const normalizedCustomerEmail = normalizeEmail(accountEmail);

      if (!normalizedCustomerEmail) {
        setAccountMessage(
          "Email is required because it links your customer profile and portal history."
        );
        setSavingAccount(false);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: trimmedPhone,
          email: normalizedCustomerEmail,
        })
        .eq("id", customer.id);

      if (error) throw error;

      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              first_name: trimmedFirstName,
              last_name: trimmedLastName,
              phone: trimmedPhone,
              email: normalizedCustomerEmail,
            }
          : prev
      );

      setAccountMessage("Account information updated.");
    } catch (error) {
      setAccountMessage(getErrorMessage(error, "Failed to update account information."));
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return <div className="otg-page"><div className="otg-container"><div className="otg-card p-8"><p className="otg-body">Loading account...</p></div></div></div>;
  }

  return (
    <CustomerPortalShell
      title="Account"
      subtitle="Use this page to update the account information connected to your customer record, portal access, and service history."
      onLogout={handleLogout}
    >
      <div className="otg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Account Information</h2>
            <p className="mt-1 text-sm text-slate-600">
              Keep your full customer profile current so reports, updates, and portal access stay tied to the right account.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Profile Details
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Customers can update their full contact profile here. Email is required because it is the main way portal access and service history stay linked to the correct account.
          </p>
        </div>

        <form onSubmit={handleSaveAccountInfo} className="mt-6 space-y-4">
          <CustomerContactFields
            firstName={accountFirstName}
            lastName={accountLastName}
            phone={accountPhone}
            email={accountEmail}
            setFirstName={setAccountFirstName}
            setLastName={setAccountLastName}
            setPhone={(value) => setAccountPhone(formatPhoneNumber(value))}
            setEmail={(value) => setAccountEmail(normalizeEmail(value))}
          />

          <button type="submit" disabled={savingAccount} className="otg-btn otg-btn-primary disabled:opacity-50">
            {savingAccount ? "Saving..." : "Save Account Information"}
          </button>
        </form>

        {accountMessage ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {accountMessage}
          </div>
        ) : null}
      </div>
    </CustomerPortalShell>
  );
}
