"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildVehicleLabel,
  CustomerPortalData,
  CustomerPortalInspection,
  CustomerPortalVehicle,
  fetchCustomerPortalData,
  getCustomerWorkflowStepState,
  getCustomerWorkflowSummary,
  getSingleRelation,
} from "@/lib/customer-portal";
import { workflowStepLabels } from "@/lib/inspection-workflow";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { fetchJobCustomerUpdates, type JobCustomerUpdateRow } from "@/lib/job-customer-updates";

function ProgressWorkflowBody({
  inspection,
  photoCount,
  jobUpdates,
  updatesLoading,
}: {
  inspection: NonNullable<CustomerPortalInspection>;
  photoCount: number;
  jobUpdates: JobCustomerUpdateRow[];
  updatesLoading: boolean;
}) {
  const vehicle = useMemo(
    () => getSingleRelation(inspection?.vehicles),
    [inspection],
  );
  const workflowSummary = getCustomerWorkflowSummary(inspection, workflowStepLabels);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-semibold text-slate-900">
              {buildVehicleLabel(vehicle)}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Last updated:{" "}
              {inspection.created_at ? new Date(inspection.created_at).toLocaleString() : "-"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Technician: {inspection.tech_name || "-"}
            </div>
          </div>

          <div className="rounded-[22px] border border-lime-400/35 bg-lime-400 px-4 py-3 text-sm font-semibold text-black">
            {workflowSummary.workflowCompleted} of {workflowSummary.workflowTotal} steps complete
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(workflowStepLabels).map(([stepKey, label]) => {
          const stepState = getCustomerWorkflowStepState(inspection, stepKey, photoCount);

          return (
            <div
              key={stepKey}
              className={`rounded-[22px] border p-4 text-sm ${stepState.className}`}
            >
              <div className="font-semibold">{label}</div>
              <div className="mt-1">{stepState.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Technician Notes
        </div>
        <div className="mt-3 text-sm leading-7 text-slate-700">
          {inspection.notes || "No technician notes were added to the current inspection."}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Service Updates
        </div>
        {updatesLoading ? (
          <p className="mt-3 text-sm text-slate-600">Loading service updates...</p>
        ) : jobUpdates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No customer-visible updates yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {jobUpdates.slice(0, 5).map((update) => (
              <div key={update.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-900">{update.title}</p>
                <p className="mt-1 text-slate-700">{update.message}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(update.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerProgressPage() {
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeJobUpdates, setActiveJobUpdates] = useState<JobCustomerUpdateRow[]>([]);
  const [activeJobUpdatesLoading, setActiveJobUpdatesLoading] = useState(false);

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
        setPortalData(data);

        const withIds = data.vehicles.filter((v): v is CustomerPortalVehicle & { id: string } =>
          Boolean(v.id),
        );
        if (withIds.length > 0) {
          const latestVid = getSingleRelation(data.latestInspection?.vehicles)?.id;
          setSelectedVehicleId(
            latestVid && withIds.some((v) => v.id === latestVid) ? latestVid : withIds[0].id,
          );
        } else {
          setSelectedVehicleId(null);
        }
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

  const vehiclesWithIds = useMemo(
    () =>
      (portalData?.vehicles ?? []).filter((v): v is CustomerPortalVehicle & { id: string } =>
        Boolean(v.id),
      ),
    [portalData?.vehicles],
  );

  const resolvedVehicleId =
    selectedVehicleId ?? (vehiclesWithIds.length === 1 ? vehiclesWithIds[0]?.id : null);

  const activeInspection: CustomerPortalInspection | null = useMemo(() => {
    if (!portalData || !resolvedVehicleId) {
      return null;
    }
    return portalData.latestInspectionByVehicleId[resolvedVehicleId] ?? null;
  }, [portalData, resolvedVehicleId]);

  const activePhotoCount = useMemo(() => {
    if (!activeInspection?.id) {
      return 0;
    }
    return portalData?.inspectionPhotoCountsById[activeInspection.id] ?? 0;
  }, [activeInspection?.id, portalData?.inspectionPhotoCountsById]);

  useEffect(() => {
    const run = async () => {
      if (!portalData?.customer?.id || !resolvedVehicleId) {
        setActiveJobUpdates([]);
        return;
      }
      setActiveJobUpdatesLoading(true);
      try {
        const { data: jobData, error } = await supabase
          .from("jobs")
          .select("id")
          .eq("customer_id", portalData.customer.id)
          .eq("vehicle_id", resolvedVehicleId)
          .in("status", ["new_request", "in_progress", "draft", "completed"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !jobData?.id) {
          setActiveJobUpdates([]);
          return;
        }
        const updates = await fetchJobCustomerUpdates(jobData.id);
        setActiveJobUpdates(updates.filter((u) => u.visibility === "customer"));
      } catch {
        setActiveJobUpdates([]);
      } finally {
        setActiveJobUpdatesLoading(false);
      }
    };
    void run();
  }, [portalData?.customer?.id, resolvedVehicleId]);

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading service progress...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyProgress = vehiclesWithIds.some(
    (v) => portalData?.latestInspectionByVehicleId[v.id],
  );

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
            <h2 className="text-xl font-semibold text-slate-900">Inspection workflow</h2>
            <p className="mt-1 text-sm text-slate-600">
              Follow the technician workflow from check-in through report completion.
            </p>
          </div>
        </div>

        {!portalData?.vehicles.length ? (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
            Add a vehicle to your account to track service progress.
          </div>
        ) : vehiclesWithIds.length > 1 && resolvedVehicleId ? (
          <Tabs
            value={resolvedVehicleId}
            onValueChange={setSelectedVehicleId}
            className="mt-6 w-full"
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {vehiclesWithIds.map((v) => (
                <TabsTrigger
                  key={v.id}
                  value={v.id}
                  className="max-w-full shrink rounded-xl border border-transparent px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-none data-[state=active]:border-lime-400 data-[state=active]:bg-lime-50 data-[state=active]:text-slate-900"
                >
                  <span className="block truncate">{buildVehicleLabel(v)}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {vehiclesWithIds.map((v) => (
              <TabsContent key={v.id} value={v.id} className="mt-6 outline-none">
                {portalData.latestInspectionByVehicleId[v.id] ? (
                  <ProgressWorkflowBody
                    inspection={portalData.latestInspectionByVehicleId[v.id]!}
                    photoCount={
                      portalData.inspectionPhotoCountsById[
                        portalData.latestInspectionByVehicleId[v.id]!.id!
                      ] ?? 0
                    }
                    jobUpdates={resolvedVehicleId === v.id ? activeJobUpdates : []}
                    updatesLoading={resolvedVehicleId === v.id ? activeJobUpdatesLoading : false}
                  />
                ) : (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
                    No live service progress for {buildVehicleLabel(v)} yet.
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : vehiclesWithIds.length === 1 && selectedVehicleId ? (
          <div className="mt-6">
            {activeInspection ? (
              <ProgressWorkflowBody
                inspection={activeInspection}
                photoCount={activePhotoCount}
                jobUpdates={activeJobUpdates}
                updatesLoading={activeJobUpdatesLoading}
              />
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
                {hasAnyProgress
                  ? "No live service progress for this vehicle yet."
                  : "No live service progress is available yet."}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
            No vehicles with IDs on file. Contact support if this persists.
          </div>
        )}
      </div>
    </CustomerPortalShell>
  );
}
