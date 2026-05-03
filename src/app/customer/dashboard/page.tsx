"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  FileText,
  LayoutDashboard,
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
  hasValidCustomerOdometerMiles,
  getSingleRelation,
  type CustomerPortalVehicle,
  type CustomerPortalData,
} from "@/lib/customer-portal";
import { CustomerPortalPageHeader } from "@/components/customer/CustomerPortalPageHeader";
import { getErrorDebugFields, getErrorMessage } from "@/lib/tech-inspection";

const EMPTY_VEHICLES: CustomerPortalVehicle[] = [];

/** Account page — Vehicles section (add / edit vehicles). */
const ADD_VEHICLE_ACCOUNT_HREF = "/customer/account#customer-account-vehicles";

function OverviewHubTile({
  icon: Icon,
  title,
  subtitle,
  href,
  accent = "lime",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  href: string;
  accent?: "lime" | "slate";
}) {
  return (
    <a
      href={href}
      className={`group flex min-h-[120px] flex-col justify-between rounded-[24px] border p-4 transition sm:min-h-[128px] sm:p-5 ${
        accent === "lime"
          ? "border-lime-400/40 bg-[linear-gradient(145deg,rgba(57,255,20,0.14),rgba(12,22,15,0.92))] hover:border-lime-400/70 hover:shadow-[0_0_24px_rgba(57,255,20,0.12)]"
          : "border-slate-200 bg-slate-50 hover:border-lime-300/60 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`rounded-2xl p-2.5 ${
            accent === "lime" ? "bg-lime-400/90 text-black" : "bg-slate-200 text-slate-900"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-lime-600" />
      </div>
      <div className="mt-4 min-w-0">
        <div className="text-base font-semibold text-slate-900 sm:text-lg">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
      </div>
    </a>
  );
}

function DashboardMainSectionHeader({
  icon: Icon,
  kicker,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="shrink-0 rounded-2xl bg-slate-200 p-2.5 text-slate-900">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {kicker}
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [showSignupSuccessMessage, setShowSignupSuccessMessage] = useState(false);

  useEffect(() => {
    const signupSuccessKey = "customerSignupAutoLoginSuccess";
    const shouldShowMessage = sessionStorage.getItem(signupSuccessKey) === "1";
    if (!shouldShowMessage) {
      return;
    }

    sessionStorage.removeItem(signupSuccessKey);
    setShowSignupSuccessMessage(true);

    const timerId = window.setTimeout(() => {
      setShowSignupSuccessMessage(false);
    }, 5000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoadError(null);
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

        const nextPortalData = await fetchCustomerPortalData(user.id);
        setPortalData(nextPortalData);
      } catch (error) {
        const message = getErrorMessage(error, "Could not load your dashboard.");
        setLoadError(message);
        console.error(
          "Dashboard load failed:",
          message,
          getErrorDebugFields(error),
        );
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
  const recommendationEmptyMessage =
    !vehicles.length || !primaryVehicle
      ? "Add a vehicle and current mileage in your account to see personalized maintenance suggestions."
      : !hasValidCustomerOdometerMiles(primaryVehicle.mileage)
        ? "Add your current mileage in your account to see personalized maintenance suggestions."
        : "No recommended services are available yet for the current vehicle details.";
  const reportCountsByVehicle = reports.reduce<Record<string, number>>((acc, report) => {
    const inspection = getSingleRelation(report.inspections);
    const vehicle = getSingleRelation(inspection?.vehicles);
    const key = buildVehicleReportKey(vehicle);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="otg-section pb-12 pt-8">
        <div className="otg-site-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading customer portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="otg-section pb-12 pt-8">
        <div className="otg-site-container max-w-3xl">
          <div className="otg-card border-red-200 bg-red-50/80 p-8">
            <h1 className="otg-section-title text-red-950">Something went wrong</h1>
            <p className="otg-body mt-3 text-red-900">{loadError}</p>
            <button
              type="button"
              className="mt-6 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-50"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="otg-section pb-12 pt-8">
        <div className="otg-site-container max-w-3xl">
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
    <div className="otg-section overflow-x-hidden pb-12 pt-6 sm:pt-8">
      <div className="otg-site-container min-w-0 space-y-4 sm:space-y-6">
        {showSignupSuccessMessage ? (
          <div
            className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
            role="status"
            aria-live="polite"
          >
            Account created and signed in successfully. Welcome to your dashboard.
          </div>
        ) : null}

        <CustomerPortalPageHeader
          title="Customer Vehicle Center"
          subtitle="Start with the overview cards below—each one opens the right area. Your vehicles and last visit stay in the panels underneath."
          onLogout={handleLogout}
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <OverviewHubTile
            icon={CalendarDays}
            title="Get service"
            subtitle="Step-by-step: book a time or send a request"
            href="/customer/book"
            accent="lime"
          />
          <OverviewHubTile
            icon={LayoutDashboard}
            title="Service progress"
            subtitle={
              latestInspection
                ? `${workflowCompleted} of ${workflowTotal} steps · ${latestServiceDate}`
                : "No active visit"
            }
            href="/customer/progress"
          />
          <OverviewHubTile
            icon={FileText}
            title="Reports"
            subtitle={
              completedReportsCount
                ? `${completedReportsCount} completed report${completedReportsCount === 1 ? "" : "s"}`
                : "History will appear here"
            }
            href={vehicles.length ? "/customer/reports" : ADD_VEHICLE_ACCOUNT_HREF}
          />
          <OverviewHubTile
            icon={UserRound}
            title="Account"
            subtitle="Phone, addresses, and profile"
            href="/customer/account"
          />
        </div>

        <div className="grid gap-3 lg:hidden">
          <a
            href="/customer/progress"
            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Live Visit
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {latestInspection ? "Service in progress" : "No active visit"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {latestInspection
                ? `${workflowCompleted} of ${workflowTotal} steps · ${latestServiceDate}`
                : "Tap to view full progress details"}
            </div>
          </a>

          <a
            href={vehicles.length ? "/customer/reports" : ADD_VEHICLE_ACCOUNT_HREF}
            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Reports
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {completedReportsCount} completed report{completedReportsCount === 1 ? "" : "s"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Tap to open report history and photos.
            </div>
          </a>

          <a
            href="/customer/account"
            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account Snapshot
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} on file
            </div>
          </a>
        </div>

        <div className="hidden min-w-0 gap-4 sm:gap-6 lg:grid xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 sm:space-y-6">
            <div className="otg-card min-w-0 overflow-hidden p-0">
              <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="rounded-[22px] bg-lime-400/90 p-3 text-black shadow-sm sm:rounded-[24px] sm:p-4">
                    <CarFront className="h-7 w-7 sm:h-9 sm:w-9" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
                      {[customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(" ") || "Customer"}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} on
                      file
                    </div>
                    <div className="mt-3 inline-flex max-w-full rounded-full border border-lime-400/50 bg-lime-50 px-3 py-1 text-[11px] font-semibold uppercase leading-5 tracking-[0.12em] text-lime-900 sm:text-xs sm:tracking-[0.18em]">
                      {completedReportsCount
                        ? "Report history available"
                        : "Awaiting first report"}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
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
                          className="min-w-[170px] max-w-[78vw] rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-lime-300 hover:bg-lime-50/50 sm:min-w-[220px] sm:p-4"
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            {buildVehicleLabel(vehicle)}
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            {formatVehicleMiles(vehicle.mileage)}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {buildVehicleDetailLabel(vehicle)}
                          </div>
                          <div className="mt-3 inline-flex rounded-full border border-lime-400/35 bg-lime-400 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black">
                            {reportCountsByVehicle[buildVehicleReportKey(vehicle)] || 0} completed report{(reportCountsByVehicle[buildVehicleReportKey(vehicle)] || 0) === 1 ? "" : "s"}
                          </div>
                        </a>
                      ))
                    ) : (
                      <a
                        href={ADD_VEHICLE_ACCOUNT_HREF}
                        className="block w-full min-w-[170px] rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm leading-relaxed text-slate-700 transition-colors hover:border-lime-300 hover:bg-lime-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
                      >
                        <span className="font-semibold text-slate-900">No vehicles on file.</span>{" "}
                        Click here to add a vehicle — opens the Vehicles section on Account.
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
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
                      {customer.phone
                        ? `${customer.phone}${
                            customer.phone_extension
                              ? ` ext. ${customer.phone_extension}`
                              : ""
                          }`
                        : "No phone number on file"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="otg-card min-w-0 p-4 sm:p-6 md:p-8">
              <DashboardMainSectionHeader
                icon={LayoutDashboard}
                kicker="Service center"
                title="Your visit and maintenance ideas"
                description="Track the job in progress and see suggestions for what to book next."
              />

              <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5 md:p-6">
                <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {latestInspection ? "Current visit" : "Welcome"}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                      {latestInspection ? "Visit in progress" : "Plan your next service"}
                    </h3>
                    {latestInspection ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        All live details for this visit—steps, photos, and technician notes—are on{" "}
                        <a
                          href="/customer/progress"
                          className="font-semibold text-lime-700 underline-offset-2 hover:underline"
                        >
                          Service progress
                        </a>
                        . The Service progress card above shows your step count at a glance.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        When a technician starts work on your vehicle, status will show on the Service progress
                        card above. Book or request service with the actions on the right when you&apos;re ready.
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 lg:justify-center">
                    <a href="/customer/book" className="otg-btn otg-btn-primary w-full sm:w-auto lg:w-full">
                      Get service
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/customer/schedule"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:border-lime-300 hover:bg-lime-50 sm:w-auto lg:w-full"
                    >
                      Schedule service
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (!vehicles.length) {
                          window.location.href = ADD_VEHICLE_ACCOUNT_HREF;
                          return;
                        }
                        window.location.href = completedReportsCount
                          ? "/customer/reports"
                          : "/customer/account";
                      }}
                      className="otg-btn otg-btn-secondary w-full sm:w-auto lg:w-full"
                    >
                      {!vehicles.length
                        ? "Add a vehicle"
                        : completedReportsCount
                          ? "Open Report History"
                          : "Update Account"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recommendations
                </div>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  Suggested maintenance
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Based on your primary vehicle and mileage on file.
                </p>

                <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  {recommendedServices.length ? (
                    recommendedServices.map((item) => (
                      <div
                        key={`${item.category}-${item.service}`}
                        className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.category}
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">
                          {item.service}
                        </div>
                        {item.note ? (
                          <div className="mt-2 text-sm leading-relaxed text-slate-600">{item.note}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 sm:col-span-2 sm:p-5">
                      {recommendationEmptyMessage}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <a
                    href="/customer/book"
                    className="inline-flex items-center text-sm font-semibold text-lime-700 underline-offset-4 hover:underline"
                  >
                    {recommendedServices.length
                      ? "Book or request one of these"
                      : "Book or request service"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
