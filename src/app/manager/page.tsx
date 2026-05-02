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
  Phone,
  Mail,
} from "lucide-react";

type PublicServiceRequest = {
  id: string;
  status: string;
  requested_service: string;
  service_details: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
};

export default function ManagerHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [openJobsCount, setOpenJobsCount] = useState(0);
  const [unassignedJobsCount, setUnassignedJobsCount] = useState(0);
  const [draftJobsCount, setDraftJobsCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [publicRequestsCount, setPublicRequestsCount] = useState(0);
  const [recentPublicRequests, setRecentPublicRequests] = useState<PublicServiceRequest[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [
          { count: openJobs, error: openJobsError },
          { count: unassignedJobs, error: unassignedJobsError },
          { count: draftJobs, error: draftJobsError },
          { count: customers, error: customersError },
          { count: publicRequests, error: publicRequestsError },
          { data: publicRequestsData, error: publicRequestsListError },
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

          supabase
            .from("service_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "new"),

          supabase
            .from("service_requests")
            .select(
              "id, status, requested_service, service_details, contact_name, contact_phone, contact_email, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (openJobsError) throw openJobsError;
        if (unassignedJobsError) throw unassignedJobsError;
        if (draftJobsError) throw draftJobsError;
        if (customersError) throw customersError;
        if (publicRequestsError) throw publicRequestsError;
        if (publicRequestsListError) throw publicRequestsListError;

        setOpenJobsCount(openJobs ?? 0);
        setUnassignedJobsCount(unassignedJobs ?? 0);
        setDraftJobsCount(draftJobs ?? 0);
        setCustomersCount(customers ?? 0);
        setPublicRequestsCount(publicRequests ?? 0);
        setRecentPublicRequests((publicRequestsData || []) as PublicServiceRequest[]);
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Manager Dashboard</h1>
              <p className="mt-1 text-slate-600">
                Start in Jobs, then run schedule and team operations.
              </p>
            </div>

            <div className="flex justify-end">
              <BackToPortalButton />
            </div>
          </div>
          <PortalTopNav section="manager" />
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

        <Card className="border-2 border-sky-200 bg-white">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Public Service Requests</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Requests submitted from the public website contact form.
                </p>
              </div>
              <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
                {publicRequestsCount} new
              </div>
            </div>

            <div className="grid gap-3">
              {recentPublicRequests.length ? (
                recentPublicRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {request.requested_service}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {request.contact_name || "No name provided"}
                        </div>
                      </div>
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {new Date(request.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {request.contact_phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span>{request.contact_phone}</span>
                        </div>
                      ) : null}
                      {request.contact_email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span>{request.contact_email}</span>
                        </div>
                      ) : null}
                      <div>{request.service_details || "No details provided."}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No public service requests yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
