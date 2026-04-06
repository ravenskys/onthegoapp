"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import {
  buildVehicleLabel,
  CustomerPortalData,
  fetchCustomerPortalData,
  getCustomerWorkflowSummary,
  getSingleRelation,
} from "@/lib/customer-portal";
import { workflowStepLabels } from "@/lib/inspection-workflow";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";

export default function CustomerProgressPage() {
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);

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

        setPortalData(await fetchCustomerPortalData(user.id));
      } catch (error) {
        console.error("Customer progress load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, []);

  const handleLogout = async () => {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const latestInspection = portalData?.latestInspection ?? null;
  const latestVehicle = useMemo(
    () => getSingleRelation(latestInspection?.vehicles),
    [latestInspection]
  );
  const workflowSummary = getCustomerWorkflowSummary(
    latestInspection,
    workflowStepLabels
  );

  if (loading) {
    return <div className="otg-page"><div className="otg-container"><div className="otg-card p-8"><p className="otg-body">Loading service progress...</p></div></div></div>;
  }

  return (
    <CustomerPortalShell
      title="Service Progress"
      subtitle="This page shows the current inspection workflow in detail whenever your vehicle is actively moving through service."
      onLogout={handleLogout}
    >
      <div className="otg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Latest Inspection Workflow</h2>
            <p className="mt-1 text-sm text-slate-600">
              Follow the technician workflow from check-in through report completion.
            </p>
          </div>
        </div>

        {latestInspection ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {buildVehicleLabel(latestVehicle)}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Last updated: {latestInspection.created_at ? new Date(latestInspection.created_at).toLocaleString() : "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Technician: {latestInspection.tech_name || "-"}
                  </div>
                </div>

                <div className="rounded-[22px] border border-lime-400/35 bg-lime-400 px-4 py-3 text-sm font-semibold text-black">
                  {workflowSummary.workflowCompleted} of {workflowSummary.workflowTotal} steps complete
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(workflowStepLabels).map(([stepKey, label]) => {
                const complete = Boolean(workflowSummary.workflowSteps?.[stepKey]);

                return (
                  <div
                    key={stepKey}
                    className={`rounded-[22px] border p-4 text-sm ${
                      complete
                        ? "border-lime-400/40 bg-lime-400/15 text-slate-900"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="mt-1">
                      {complete ? "Completed" : "Waiting on this step"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Technician Notes
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">
                {latestInspection.notes || "No technician notes were added to the current inspection."}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
            No live service progress is available yet.
          </div>
        )}
      </div>
    </CustomerPortalShell>
  );
}
