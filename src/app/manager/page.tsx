"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import {
  Loader2,
  Users,
  ClipboardList,
  Wrench,
  CalendarDays,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

export default function ManagerHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [openJobsCount, setOpenJobsCount] = useState(0);
  const [unassignedJobsCount, setUnassignedJobsCount] = useState(0);
  const [draftJobsCount, setDraftJobsCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
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

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manager Dashboard</h1>
            <p className="mt-1 text-slate-600">Start in Jobs, then run schedule and team operations.</p>
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

        <button
          type="button"
          onClick={() => router.push("/manager/jobs")}
          className="w-full text-left"
        >
          <Card className="border-2 border-lime-400/60 bg-gradient-to-br from-lime-100 to-white transition-shadow hover:shadow-md">
            <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black">
                  <ClipboardList className="h-4 w-4" />
                  Primary flow
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Start in Jobs</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-700">
                  New customer, returning customer, and full list actions all live in the Jobs hub.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {openJobsCount} open
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {unassignedJobsCount} unassigned
                  </span>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                    {draftJobsCount} drafts
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {customersCount} customers
                  </span>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                Open Jobs hub
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </button>

        <div className="grid gap-4 md:grid-cols-2">
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
                    Review upcoming work, technician load, and scheduled visits.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Open calendar
                  <ArrowRight className="h-4 w-4" />
                </div>
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
                    Manage weekly technician availability blocks and coverage.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Set hours
                  <ArrowRight className="h-4 w-4" />
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
                    Update customer profiles, contact details, and linked vehicles.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Open customers
                  <ArrowRight className="h-4 w-4" />
                </div>
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
                    Service catalog and internal business settings.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Open settings
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
