"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CarFront,
  ClipboardList,
  FileText,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { workflowStepLabels } from "@/lib/inspection-workflow";
import {
  getPostLoginRoute,
  getUserRoles,
  hasPortalAccess,
} from "@/lib/portal-auth";
import {
  buildVehicleLabel,
  buildVehicleDetailLabel,
  buildVehicleReportKey,
  formatVehicleMiles,
  fetchCustomerPortalData,
  getCustomerRecommendedServices,
  getCustomerWorkflowStepState,
  getSingleRelation,
  type CustomerPortalVehicle,
  type CustomerPortalData,
} from "@/lib/customer-portal";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

const EMPTY_VEHICLES: CustomerPortalVehicle[] = [];

function DashboardMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "success";
  onClick?: () => void;
}) {
  const className = `w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 ${
    onClick
      ? "text-left transition-colors hover:border-lime-400/40 hover:bg-lime-400/10"
      : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-2xl p-2 ${
              tone === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-800"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {value}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div
          className={`rounded-2xl p-2 ${
            tone === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-200 text-slate-800"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { user, roles: roleNames } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (roleNames.length === 0) {
          setLoading(false);
          return;
        }

        if (!hasPortalAccess(roleNames, "customer")) {
          window.location.href = getPostLoginRoute(roleNames);
          return;
        }

        const portalData = await fetchCustomerPortalData(user.id);

        if (!portalData.customer) {
          setLoading(false);
          return;
        }

        setPortalData(portalData);
      } catch (error) {
        console.error("Dashboard load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const customer = portalData?.customer ?? null;
  const vehicles = portalData?.vehicles ?? EMPTY_VEHICLES;
  const reports = portalData?.reports ?? [];
  const latestInspection = portalData?.latestInspection ?? null;
  const latestInspectionPhotoCount =
    portalData?.latestInspectionPhotoCount ?? 0;
  const latestWorkflowSteps =
    latestInspection?.inspection_summary?.workflow_steps || {};
  const workflowTotal =
    latestInspection?.inspection_summary?.workflow_total_count ||
    Object.keys(workflowStepLabels).length;
  const workflowCompleted =
    latestInspection?.inspection_summary?.workflow_completed_count ||
    Object.values(latestWorkflowSteps).filter(Boolean).length;
  const latestVehicle = useMemo(
    () => getSingleRelation(latestInspection?.vehicles),
    [latestInspection]
  );
  const primaryVehicle = useMemo<CustomerPortalVehicle | null>(() => {
    if (!latestVehicle) {
      return vehicles[0] ?? null;
    }

    const matchingVehicle = latestVehicle.id
      ? vehicles.find((vehicle) => vehicle.id === latestVehicle.id)
      : null;

    return {
      ...latestVehicle,
      ...(matchingVehicle || {}),
    };
  }, [latestVehicle, vehicles]);
  const completedReportsCount = reports.length;
  const latestServiceDate = latestInspection?.created_at
    ? new Date(latestInspection.created_at).toLocaleDateString()
    : "No service yet";
  const recommendedServices = getCustomerRecommendedServices(primaryVehicle);
  const reportCountsByVehicle = reports.reduce<Record<string, number>>((acc, report) => {
    const inspection = getSingleRelation(report.inspections);
    const vehicle = getSingleRelation(inspection?.vehicles);
    const key = buildVehicleReportKey(vehicle);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading customer portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="otg-page">
        <div className="otg-container max-w-3xl">
          <div className="otg-card p-8">
            <h1 className="otg-section-title">Customer account not linked yet</h1>
            <p className="otg-body mt-3">
              Your login worked, but your portal account has not been connected
              to a customer record yet.
            </p>
            <p className="otg-muted mt-2">
              Once we connect your customer record, your inspection reports will
              appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-page otg-portal-dark overflow-x-hidden">
      <div className="otg-container min-w-0 space-y-4 sm:space-y-6">
        <div className="otg-card min-w-0 overflow-hidden p-0">
          <div className="flex flex-col gap-5 border-b border-lime-500/20 bg-[linear-gradient(135deg,rgba(57,255,20,0.18),rgba(7,17,10,0.88)_35%,rgba(7,17,10,0.96)_100%)] px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="space-y-3">
              <BrandLogo priority className="max-w-[190px] sm:max-w-[220px]" surface="dark" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Customer Vehicle Center
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-lime-50/85">
                  Your customer home page keeps vehicles, current service status,
                  and maintenance recommendations in one place.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <BackToPortalButton className="w-full sm:w-auto" />
              <button onClick={handleLogout} className={`${headerActionButtonClassName} w-full sm:w-auto`}>
                Log Out
              </button>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 md:px-8">
            <PortalTopNav
              section="customer"
              className="!border-lime-500/25 !bg-[#0d1610]"
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 sm:space-y-6">
            <div className="otg-card min-w-0 overflow-hidden p-0">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(57,255,20,0.24),transparent_40%),linear-gradient(180deg,rgba(12,22,15,0.98),rgba(9,16,11,0.98))] p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="rounded-[22px] bg-lime-400/90 p-3 text-black shadow-[0_0_24px_rgba(57,255,20,0.24)] sm:rounded-[24px] sm:p-4">
                    <CarFront className="h-7 w-7 sm:h-9 sm:w-9" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-semibold text-white sm:text-2xl">
                      {[customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(" ") || "Customer"}
                    </div>
                    <div className="mt-2 text-sm text-lime-50/80">
                      {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} on
                      file
                    </div>
                    <div className="mt-3 inline-flex max-w-full rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-lime-200 sm:text-xs sm:tracking-[0.18em]">
                      {completedReportsCount
                        ? "Report history available"
                        : "Awaiting first report"}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-200">
                    Vehicles on Your Account
                  </div>
                  <div className="-mx-1 mt-3 flex max-w-full gap-3 overflow-x-auto px-1 pb-2">
                    {vehicles.length ? (
                      vehicles.map((vehicle) => (
                        <a
                          key={
                            vehicle.id ||
                            `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.vin || vehicle.license_plate || ""}`
                          }
                          href={`/customer/reports?vehicle=${encodeURIComponent(buildVehicleReportKey(vehicle))}`}
                          className="min-w-[170px] max-w-[78vw] rounded-[22px] border border-lime-400/25 bg-white/10 p-3 backdrop-blur-sm transition-colors hover:border-lime-300/60 hover:bg-white/15 sm:min-w-[220px] sm:p-4"
                        >
                          <div className="text-sm font-semibold text-white">
                            {buildVehicleLabel(vehicle)}
                          </div>
                          <div className="mt-2 text-xs text-lime-50/80">
                            {formatVehicleMiles(vehicle.mileage)}
                          </div>
                          <div className="mt-1 text-xs text-lime-50/80">
                            {buildVehicleDetailLabel(vehicle)}
                          </div>
                          <div className="mt-3 inline-flex rounded-full border border-lime-400/35 bg-lime-400 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                            {reportCountsByVehicle[buildVehicleReportKey(vehicle)] || 0} completed report{(reportCountsByVehicle[buildVehicleReportKey(vehicle)] || 0) === 1 ? "" : "s"}
                          </div>
                        </a>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-lime-400/25 bg-white/10 px-4 py-3 text-sm text-lime-50/80">
                        No vehicles are linked to this customer account yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <DashboardMetric
                  icon={ClipboardList}
                  label="Latest Service"
                  value={latestServiceDate}
                  onClick={() => {
                    window.location.href = "/customer/progress";
                  }}
                />
                <DashboardMetric
                  icon={FileText}
                  label="Completed Reports"
                  value={String(completedReportsCount)}
                  onClick={() => {
                    window.location.href = "/customer/reports";
                  }}
                />

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Account Snapshot
                  </div>
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-slate-700">
                      <UserRound className="h-4 w-4 text-lime-400" />
                      {[customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(" ") || "Customer"}
                    </div>
                    <div className="flex items-center gap-3 text-slate-700">
                      <UserRound className="h-4 w-4 text-lime-400" />
                      {customer.phone || "No phone number on file"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-4 sm:space-y-6">
            <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="otg-card min-w-0 p-4 sm:p-6">
                <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="inline-flex rounded-full border border-lime-400/35 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
                      {latestInspection ? "Inspection Active" : "No active service"}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl">
                      {latestInspection
                        ? "Your latest inspection is in progress"
                        : "Your vehicle overview starts here"}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm text-slate-600">
                      {latestInspection
                        ? "Track the latest technician workflow and jump straight into service progress or customer report history when you need more detail."
                        : "As soon as a technician starts your next inspection, service progress will show up here automatically."}
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <a href="/customer/schedule" className="otg-btn otg-btn-primary sm:w-auto">
                        Schedule Service
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = completedReportsCount
                            ? "/customer/reports"
                            : "/customer/account";
                        }}
                        className="otg-btn otg-btn-secondary sm:w-auto"
                      >
                        {completedReportsCount
                          ? "Open Report History"
                          : "Update Account"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </button>
                      <a href="/customer/progress" className="otg-btn otg-btn-secondary sm:w-auto">
                        See Service Progress
                      </a>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-lime-400/30 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.22),rgba(17,27,20,0.9)_70%)] px-5 py-4 text-left shadow-[0_0_22px_rgba(57,255,20,0.12)] sm:text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-200">
                      Customer Status
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {latestInspection ? "In service" : "Waiting on next visit"}
                    </div>
                  </div>
                </div>

                {latestInspection ? (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
                            {buildVehicleLabel(latestVehicle)}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            Last updated:{" "}
                            {latestInspection.created_at
                              ? new Date(latestInspection.created_at).toLocaleString()
                              : "-"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Technician: {latestInspection.tech_name || "-"}
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-lime-400/35 bg-lime-400 px-4 py-3 text-sm font-semibold text-black">
                          {workflowCompleted} of {workflowTotal} steps complete
                        </div>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                      {Object.entries(workflowStepLabels).map(([stepKey, label]) => {
                        const stepState = getCustomerWorkflowStepState(
                          latestInspection,
                          stepKey,
                          latestInspectionPhotoCount
                        );

                        return (
                          <div
                            key={stepKey}
                            className={`rounded-[22px] border p-4 text-sm ${stepState.className}`}
                          >
                            <div className="font-semibold">{label}</div>
                            <div className="mt-1">
                              {stepState.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Technician Notes
                      </div>
                      <div className="mt-3 text-sm leading-7 text-slate-700">
                        {latestInspection.notes ||
                          "No technician notes were added to the current inspection."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-slate-600 sm:p-5">
                    No live service progress is available yet.
                  </div>
                )}
              </div>

              <div className="otg-card min-w-0 p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:items-center">
                  <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Recommended Services
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Suggestions are based on the current primary vehicle and mileage on file.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {recommendedServices.length ? (
                    recommendedServices.map((item) => (
                      <div
                        key={`${item.category}-${item.service}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.category}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {item.service}
                        </div>
                        {item.note ? (
                          <div className="mt-2 text-sm text-slate-600">{item.note}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      No recommended services are available yet for the current vehicle details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
