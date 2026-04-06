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
  buildVehicleReportKey,
  getCustomerRecommendedServices,
} from "@/lib/customer-portal";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

type DashboardVehicle = {
  id?: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  license_plate?: string | null;
  mileage?: number | null;
  vin?: string | null;
};

type CustomerPortalRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type DashboardInspection = {
  id?: string;
  created_at?: string;
  tech_name?: string | null;
  notes?: string | null;
  vehicles?: DashboardVehicle | DashboardVehicle[] | null;
  inspection_summary?: {
    workflow_steps?: Record<string, boolean>;
    workflow_total_count?: number;
    workflow_completed_count?: number;
  } | null;
} | null;

type DashboardReport = {
  id: string;
  created_at: string;
  pdf_path: string;
  inspections?: DashboardInspection | DashboardInspection[];
};

const buildVehicleLabel = (vehicle: DashboardVehicle | null | undefined) =>
  [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
  "Vehicle";

const formatMiles = (mileage: number | null | undefined) =>
  typeof mileage === "number"
    ? `${mileage.toLocaleString("en-US")} miles`
    : "Mileage not available";

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
  const className = `rounded-[24px] border border-slate-200 bg-slate-50 p-4 ${
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
  const [customer, setCustomer] = useState<CustomerPortalRecord | null>(null);
  const [vehicles, setVehicles] = useState<DashboardVehicle[]>([]);
  const [reports, setReports] = useState<DashboardReport[]>([]);
  const [latestInspection, setLatestInspection] =
    useState<DashboardInspection>(null);

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

        const { data: customerRow, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("auth_user_id", user.id)
          .single();

        if (customerError || !customerRow) {
          setLoading(false);
          return;
        }

        setCustomer(customerRow);

        const { data: vehicleRows, error: vehicleError } = await supabase
          .from("vehicles")
          .select("id, year, make, model, mileage, vin, license_plate")
          .eq("customer_id", customerRow.id)
          .order("year", { ascending: false });

        if (vehicleError) throw vehicleError;

        setVehicles((vehicleRows || []) as DashboardVehicle[]);

        const { data: inspectionRows, error: inspectionError } = await supabase
          .from("inspections")
          .select(`
            id,
            created_at,
            tech_name,
            inspection_summary,
            vehicles (
              year,
              make,
              model,
              mileage,
              vin
            )
          `)
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (inspectionError) throw inspectionError;

        setLatestInspection(
          inspectionRows && inspectionRows.length > 0 ? inspectionRows[0] : null
        );

        const { data: reportRows, error: reportError } = await supabase
          .from("inspection_reports")
          .select(`
            id,
            pdf_path,
            created_at,
            inspections (
              id,
              created_at,
              tech_name,
              notes,
              inspection_summary,
              vehicles (
                year,
                make,
                model,
                mileage,
                vin
              )
            )
          `)
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false });

        if (reportError) throw reportError;

        setReports((reportRows || []) as DashboardReport[]);
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
  const completedReportsCount = reports.length;
  const latestServiceDate = latestInspection?.created_at
    ? new Date(latestInspection.created_at).toLocaleDateString()
    : "No service yet";
  const primaryVehicle = latestVehicle ?? vehicles[0] ?? null;
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
    <div className="otg-page otg-portal-dark">
      <div className="otg-container space-y-6">
        <div className="otg-card overflow-hidden p-0">
          <div className="flex flex-col gap-5 border-b border-lime-500/20 bg-[linear-gradient(135deg,rgba(57,255,20,0.18),rgba(7,17,10,0.88)_35%,rgba(7,17,10,0.96)_100%)] px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="space-y-3">
              <BrandLogo priority className="max-w-[220px]" surface="dark" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Customer Vehicle Center
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-lime-50/85">
                  Your customer home page keeps vehicles, current service status,
                  and maintenance recommendations in one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <BackToPortalButton />
              <button onClick={handleLogout} className={headerActionButtonClassName}>
                Log Out
              </button>
            </div>
          </div>

          <div className="px-6 py-4 md:px-8">
            <PortalTopNav
              section="customer"
              className="!border-lime-500/25 !bg-[#0d1610]"
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="otg-card overflow-hidden p-0">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(57,255,20,0.24),transparent_40%),linear-gradient(180deg,rgba(12,22,15,0.98),rgba(9,16,11,0.98))] p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-[24px] bg-lime-400/90 p-4 text-black shadow-[0_0_24px_rgba(57,255,20,0.24)]">
                    <CarFront className="h-9 w-9" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold text-white">
                      {[customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(" ") || "Customer"}
                    </div>
                    <div className="mt-2 text-sm text-lime-50/80">
                      {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} on
                      file
                    </div>
                    <div className="mt-3 inline-flex rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-200">
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
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {vehicles.length ? (
                      vehicles.map((vehicle) => (
                        <a
                          key={
                            vehicle.id ||
                            `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.vin || vehicle.license_plate || ""}`
                          }
                          href={`/customer/reports?vehicle=${encodeURIComponent(buildVehicleReportKey(vehicle))}`}
                          className="min-w-[220px] rounded-[22px] border border-lime-400/25 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:border-lime-300/60 hover:bg-white/15"
                        >
                          <div className="text-sm font-semibold text-white">
                            {buildVehicleLabel(vehicle)}
                          </div>
                          <div className="mt-2 text-xs text-lime-50/80">
                            {formatMiles(vehicle.mileage)}
                          </div>
                          <div className="mt-1 text-xs text-lime-50/80">
                            Plate: {vehicle.license_plate || "-"}
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

              <div className="space-y-4 p-5">
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

          <main className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="otg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full border border-lime-400/35 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
                      {latestInspection ? "Inspection Active" : "No active service"}
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold text-slate-900">
                      {latestInspection
                        ? "Your latest inspection is in progress"
                        : "Your vehicle overview starts here"}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm text-slate-600">
                      {latestInspection
                        ? "Track the latest technician workflow and jump straight into service progress or customer report history when you need more detail."
                        : "As soon as a technician starts your next inspection, service progress will show up here automatically."}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = completedReportsCount
                            ? "/customer/reports"
                            : "/customer/account";
                        }}
                        className="otg-btn otg-btn-primary"
                      >
                        {completedReportsCount
                          ? "Open Report History"
                          : "Update Account"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </button>
                      <a href="/customer/progress" className="otg-btn otg-btn-secondary">
                        See Service Progress
                      </a>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-lime-400/30 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.22),rgba(17,27,20,0.9)_70%)] px-5 py-4 text-right shadow-[0_0_22px_rgba(57,255,20,0.12)]">
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
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-2xl font-semibold text-slate-900">
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

                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(workflowStepLabels).map(([stepKey, label]) => {
                        const complete = Boolean(latestWorkflowSteps?.[stepKey]);

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
                        {latestInspection.notes ||
                          "No technician notes were added to the current inspection."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
                    No live service progress is available yet.
                  </div>
                )}
              </div>

              <div className="otg-card p-6">
                <div className="flex items-center gap-3">
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
