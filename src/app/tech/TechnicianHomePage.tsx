"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarClock, ClipboardList, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { TECH_SAVED_DRAFTS_STORAGE_KEY } from "@/lib/tech-inspection";
import { cn } from "@/lib/utils";

type HubJob = {
  id: string;
  business_job_number: string | null;
  service_type: string | null;
  service_description: string | null;
  status: string | null;
  intake_state: string | null;
  assigned_tech_user_id: string | null;
  requested_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
  } | null;
};

const ACTIVE_JOB_STATUSES = ["new", "new_request", "in_progress", "draft"] as const;

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Request failed.";
};

const formatJobLocation = (job: HubJob) => {
  const parts = [
    job.service_location_name,
    job.service_address,
    [job.service_city, job.service_state].filter(Boolean).join(", ") || null,
    job.service_zip,
  ].filter((value) => value && String(value).trim());

  return parts.length ? parts.join(" · ") : "Location pending";
};

const formatAppointment = (job: HubJob) => {
  if (!job.scheduled_start) {
    return job.requested_date ? `Requested ${job.requested_date}` : "Scheduling pending";
  }

  try {
    const start = new Date(job.scheduled_start).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (!job.scheduled_end) {
      return start;
    }

    const end = new Date(job.scheduled_end).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return `${start} - ${end}`;
  } catch {
    return job.scheduled_start;
  }
};

const getCustomerName = (job: HubJob) =>
  [job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") || "Customer";

const getVehicleLabel = (job: HubJob) =>
  [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle pending";

const getIntakeTone = (intakeState: string | null) => {
  switch (intakeState) {
    case "on_site":
      return "border-cyan-300 bg-cyan-50 text-cyan-800";
    case "in_service":
      return "border-lime-300 bg-lime-50 text-lime-800";
    case "awaiting_customer_approval":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "waiting_parts":
      return "border-orange-300 bg-orange-50 text-orange-800";
    case "completed":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
};

export default function TechnicianHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessIssue, setAccessIssue] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [jobs, setJobs] = useState<HubJob[]>([]);
  const [savedDraftCount, setSavedDraftCount] = useState(0);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setAccessIssue("");

    try {
      const { user, roles } = await getUserRoles();

      if (!user) {
        window.location.href = "/customer/login?next=/tech";
        return;
      }

      if (!hasPortalAccess(roles, "tech")) {
        setAccessIssue("This account does not have technician access.");
        return;
      }

      setCurrentUserId(user.id);

      let query = supabase
        .from("jobs")
        .select(`
          id,
          business_job_number,
          service_type,
          service_description,
          status,
          intake_state,
          assigned_tech_user_id,
          requested_date,
          scheduled_start,
          scheduled_end,
          service_location_name,
          service_address,
          service_city,
          service_state,
          service_zip,
          customer:customers(first_name, last_name, phone),
          vehicle:vehicles(year, make, model, license_plate)
        `)
        .in("status", [...ACTIVE_JOB_STATUSES])
        .order("scheduled_start", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (!roles.includes("manager") && !roles.includes("admin")) {
        query = query.or(`assigned_tech_user_id.eq.${user.id},assigned_tech_user_id.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const normalizedJobs = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...(row as unknown as HubJob),
        customer: getSingleRelation(row.customer as unknown as NonNullable<HubJob["customer"]>[]),
        vehicle: getSingleRelation(row.vehicle as unknown as NonNullable<HubJob["vehicle"]>[]),
      }));

      setJobs(normalizedJobs);

      if (typeof window !== "undefined") {
        try {
          const storedDrafts = window.localStorage.getItem(TECH_SAVED_DRAFTS_STORAGE_KEY);
          const parsed = storedDrafts ? (JSON.parse(storedDrafts) as unknown[]) : [];
          setSavedDraftCount(Array.isArray(parsed) ? parsed.length : 0);
        } catch {
          setSavedDraftCount(0);
        }
      }
    } catch (error) {
      setAccessIssue(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const assignedJobs = useMemo(
    () => jobs.filter((job) => job.assigned_tech_user_id === currentUserId),
    [currentUserId, jobs],
  );

  const activeJob = useMemo(() => {
    const preferredStateOrder = [
      "in_service",
      "on_site",
      "awaiting_customer_approval",
      "waiting_parts",
      "claimed",
      "queued",
      null,
    ];

    return [...assignedJobs].sort((a, b) => {
      const aRank = preferredStateOrder.indexOf(a.intake_state);
      const bRank = preferredStateOrder.indexOf(b.intake_state);
      return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
    })[0] ?? null;
  }, [assignedJobs]);

  const unclaimedCount = useMemo(
    () => jobs.filter((job) => !job.assigned_tech_user_id).length,
    [jobs],
  );

  const heldCount = useMemo(
    () =>
      jobs.filter((job) => ["waiting_parts", "awaiting_customer_approval"].includes(job.intake_state ?? ""))
        .length,
    [jobs],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-sm text-slate-600">Loading technician hub…</p>
        </div>
      </div>
    );
  }

  if (accessIssue) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-base font-semibold text-slate-900">Technician hub unavailable</p>
          <p className="mt-2 text-sm text-slate-700">{accessIssue}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Badge className="rounded-full bg-lime-100 text-lime-900">Technician hub</Badge>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Service stages, not a giant form</h1>
                <p className="max-w-3xl text-sm text-slate-600 sm:text-base">
                  Start from the queue, step through the visit stage by stage, and keep the customer,
                  vehicle, quote, and completion status in one mobile-first flow.
                </p>
              </div>
              <div className="w-full max-w-2xl">
                <div className="flex justify-end">
                  <PortalTopNav section="tech" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card size="sm" className="rounded-2xl border border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardDescription>Assigned jobs</CardDescription>
                  <CardTitle>{assignedJobs.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm" className="rounded-2xl border border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardDescription>Unclaimed jobs</CardDescription>
                  <CardTitle>{unclaimedCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm" className="rounded-2xl border border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardDescription>Held for approval / parts</CardDescription>
                  <CardTitle>{heldCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm" className="rounded-2xl border border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardDescription>Saved inspection drafts</CardDescription>
                  <CardTitle>{savedDraftCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Current job</h2>
                  <p className="text-sm text-slate-600">Resume the job that is furthest along in the visit.</p>
                </div>
                <Button variant="outline" onClick={() => router.push("/tech/jobs")}>
                  Open queue
                </Button>
              </div>

              {activeJob ? (
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-slate-900">
                        Job #{activeJob.business_job_number || activeJob.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-slate-700">{getCustomerName(activeJob)}</div>
                      <div className="text-sm text-slate-600">{getVehicleLabel(activeJob)}</div>
                      <div className="text-sm text-slate-500">
                        {activeJob.service_description || activeJob.service_type || "Requested work pending"}
                      </div>
                    </div>
                    <Badge className={cn("rounded-full border", getIntakeTone(activeJob.intake_state))}>
                      {(activeJob.intake_state || activeJob.status || "queued").replaceAll("_", " ")}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                        <CalendarClock className="h-4 w-4 text-lime-600" />
                        Appointment
                      </div>
                      <div>{formatAppointment(activeJob)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                        <MapPin className="h-4 w-4 text-lime-600" />
                        Service location
                      </div>
                      <div>{formatJobLocation(activeJob)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button className="min-h-12" onClick={() => router.push(`/tech/jobs/${activeJob.id}`)}>
                      Resume guided flow
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="min-h-12" onClick={() => router.push(`/tech/jobs/${activeJob.id}/inspection`)}>
                      Open legacy inspection workspace
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  No assigned active job is in progress yet. Open the queue to claim or resume work.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-slate-900">Technician workflow</h2>
                <div className="space-y-3">
                  {[
                    "Dispatch review",
                    "Arrive on site",
                    "Complaint and requested services",
                    "Pre-inspection photos and VIN",
                    "Inspection, quote, approval",
                    "Service work, payment, and receipt",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="text-slate-700">{item}</div>
                    </div>
                  ))}
                </div>
                <Link href="/tech/techflowtree.md" className="inline-flex items-center gap-2 text-sm font-medium text-lime-700 hover:text-lime-800">
                  View planning tree
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-slate-900">
                  <ClipboardList className="h-5 w-5 text-lime-600" />
                  <h2 className="text-xl font-semibold">Quick actions</h2>
                </div>
                <div className="grid gap-3">
                  <Button className="min-h-12 justify-between" variant="outline" onClick={() => router.push("/tech/jobs")}>
                    Browse technician queue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {activeJob ? (
                    <Button className="min-h-12 justify-between" variant="outline" onClick={() => router.push(`/tech/jobs/${activeJob.id}`)}>
                      Continue current job
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button className="min-h-12 justify-between" variant="outline" onClick={() => router.push("/tech/jobs")}>
                    Review queue and drafts
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      The new stage flow is the main technician path now. The older full inspection workspace is
                      still available from each job while we finish wiring photo and report details into the staged flow.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
