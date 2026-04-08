"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import {
  Loader2,
  Users,
  PlusCircle,
  ClipboardList,
  Wrench,
  CalendarDays,
  CalendarClock,
} from "lucide-react";

export default function ManagerHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [openJobsCount, setOpenJobsCount] = useState(0);
  const [unassignedJobsCount, setUnassignedJobsCount] = useState(0);
  const [draftJobsCount, setDraftJobsCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      try {
        const { user, roles } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (!hasPortalAccess(roles, "manager")) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }

        setAuthorized(true);

        const [
          { count: openJobs, error: openJobsError },
          { count: unassignedJobs, error: unassignedJobsError },
          { count: draftJobs, error: draftJobsError },
          { count: customers, error: customersError },
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .in("status", ["new_request", "in_progress"]),

          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .in("status", ["new_request", "in_progress"])
            .is("assigned_tech_user_id", null),

          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .eq("status", "draft"),

          supabase
            .from("customers")
            .select("*", { count: "exact", head: true }),
        ]);

        if (openJobsError) throw openJobsError;
        if (unassignedJobsError) throw unassignedJobsError;
        if (draftJobsError) throw draftJobsError;
        if (customersError) throw customersError;

        setOpenJobsCount(openJobs ?? 0);
        setUnassignedJobsCount(unassignedJobs ?? 0);
        setDraftJobsCount(draftJobs ?? 0);
        setCustomersCount(customers ?? 0);
      } catch (error) {
        console.error("Error loading manager dashboard:", error);
        alert("Failed to load manager dashboard.");
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndLoad();
  }, []);

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manager Dashboard</h1>
            <p className="mt-1 text-slate-600">
              Manage jobs, customers, and daily workflow.
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-4">
            <div className="flex justify-end">
              <PortalTopNav section="manager" />
            </div>
            <div className="flex justify-end">
              <BackToPortalButton />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => router.push("/manager/jobs")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <ClipboardList className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Jobs</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    View all jobs, update statuses, assign technicians, and manage work.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Draft jobs should be converted into active work or deleted.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>Open Jobs</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {openJobsCount} open
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {unassignedJobsCount} unassigned
                  </span>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                    {draftJobsCount} drafts to review
                  </span>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/manager/customers")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <Users className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Customers</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Manage customer details, tax status, and vehicles.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>Customers</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {customersCount} total
                  </span>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/manager/schedule")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <CalendarDays className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Schedule</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    View jobs on a calendar and spot unscheduled work.
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">Open Calendar</div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/manager/availability")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <CalendarClock className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Availability</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Build and update regular weekly employee availability.
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">Set Hours</div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/manager/jobs/new")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <PlusCircle className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">New Job</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Start a new service job with the fast intake flow.
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">Create Job</div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin/settings")}
            className="text-left"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <Wrench className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Settings</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Update default tax settings and other internal business controls.
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">Open Settings</div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
