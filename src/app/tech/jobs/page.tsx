"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2, MapPin, StickyNote, Trash2 } from "lucide-react";
import { headerActionButtonClassName } from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { TECH_SAVED_DRAFTS_STORAGE_KEY } from "@/lib/tech-inspection";
import { deleteJobWithRelatedRecords } from "@/lib/job-deletion";
import { cn } from "@/lib/utils";

const ACTIVE_JOB_STATUSES = ["new", "new_request", "in_progress", "draft"] as const;

type TechnicianJob = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  business_job_number: string | null;
  service_type: string | null;
  service_description: string | null;
  status: string | null;
  notes: string | null;
  assigned_tech_user_id: string | null;
  intake_state: string | null;
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  created_at: string;
  requested_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  service_checklist_started_at: string | null;
  service_checklist_completed_at: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
    vin: string | null;
  } | null;
};

type SavedTechDraft = {
  id: string;
  title: string;
  subtitle: string;
  savedAt: string;
};

type QueueView = "all" | "unclaimed" | "claimed" | "needsUpdate" | "blocked" | "drafts";

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const getSupabaseErrorMessage = (error: unknown): string => {
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

const formatAppointment = (start: string | null, end: string | null) => {
  if (!start) return null;
  try {
    const s = new Date(start).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    if (!end) return s;
    const e = new Date(end).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${s} – ${e}`;
  } catch {
    return start;
  }
};

const formatJobLocation = (job: TechnicianJob) => {
  const parts = [
    job.service_location_name,
    job.service_address,
    [job.service_city, job.service_state].filter(Boolean).join(", ") || null,
    job.service_zip,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(" · ") : null;
};

const startServiceButtonClass = (job: TechnicianJob) => {
  if (job.service_checklist_completed_at) {
    return "!bg-[#39FF14] !text-black border-black/25 hover:!bg-[#32e612]";
  }
  if (job.service_checklist_started_at) {
    return "!bg-[#EEFF00] !text-black border-black/30 hover:!bg-[#dde600]";
  }
  return "";
};

const mobileActionButtonClassName =
  "min-h-12 w-full whitespace-normal break-words px-4 py-3 text-center sm:w-auto";

export default function TechnicianJobsPage() {
  const router = useRouter();
  const portalRolesRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessIssue, setAccessIssue] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState<"info" | "success" | "error">("info");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [jobs, setJobs] = useState<TechnicianJob[]>([]);
  const [customerUpdateMetaByJobId, setCustomerUpdateMetaByJobId] = useState<
    Record<string, { count: number; latestAt: string | null }>
  >({});
  const [savedDrafts, setSavedDrafts] = useState<SavedTechDraft[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<QueueView>("all");
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null);
  const [intakeUpdatePending, setIntakeUpdatePending] = useState<{ jobId: string; intakeState: string } | null>(
    null,
  );

  const loadSavedDrafts = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const storedDrafts = window.localStorage.getItem(TECH_SAVED_DRAFTS_STORAGE_KEY);
      setSavedDrafts(storedDrafts ? JSON.parse(storedDrafts) : []);
    } catch (error) {
      console.error("Failed to load saved drafts:", error);
      setSavedDrafts([]);
    }
  }, []);

  const loadJobs = useCallback(async (userId: string, roles: string[]) => {
    const applyRoleScope = <T,>(query: T): T => {
      if (!roles.includes("manager") && !roles.includes("admin")) {
        return (query as {
          or: (filters: string) => T;
        }).or(`assigned_tech_user_id.eq.${userId},assigned_tech_user_id.is.null`);
      }
      return query;
    };

    const runJobsQuery = async (selectClause: string) => {
      const query = applyRoleScope(
        supabase
          .from("jobs")
          .select(selectClause)
          .in("status", [...ACTIVE_JOB_STATUSES])
          .order("created_at", { ascending: false }),
      ) as {
        then: (onfulfilled?: (value: { data: unknown[] | null; error: unknown | null }) => unknown) => unknown;
      };

      return (await query) as { data: unknown[] | null; error: unknown | null };
    };

    const selectFull = `
      id,
      customer_id,
      vehicle_id,
      business_job_number,
      service_type,
      service_description,
      status,
      intake_state,
      claimed_at,
      claimed_by_user_id,
      notes,
      assigned_tech_user_id,
      created_at,
      requested_date,
      scheduled_start,
      scheduled_end,
      service_location_name,
      service_address,
      service_city,
      service_state,
      service_zip,
      service_checklist_started_at,
      service_checklist_completed_at,
      customer:customers(first_name, last_name, email, phone),
      vehicle:vehicles(year, make, model, license_plate, vin)
    `;
    const selectWithoutServiceDescription = `
      id,
      customer_id,
      vehicle_id,
      business_job_number,
      service_type,
      status,
      intake_state,
      claimed_at,
      claimed_by_user_id,
      notes,
      assigned_tech_user_id,
      created_at,
      requested_date,
      scheduled_start,
      scheduled_end,
      service_location_name,
      service_address,
      service_city,
      service_state,
      service_zip,
      service_checklist_started_at,
      service_checklist_completed_at,
      customer:customers(first_name, last_name, email, phone),
      vehicle:vehicles(year, make, model, license_plate, vin)
    `;
    const selectLegacy = `
      id,
      customer_id,
      vehicle_id,
      business_job_number,
      service_type,
      status,
      notes,
      assigned_tech_user_id,
      created_at,
      requested_date,
      customer:customers(first_name, last_name, email, phone),
      vehicle:vehicles(year, make, model, license_plate, vin)
    `;

    let { data, error } = await runJobsQuery(selectFull);

    if (error) {
      console.warn("Technician queue full select failed; retrying without service_description.", error);
      const retryNoDesc = await runJobsQuery(selectWithoutServiceDescription);
      data = retryNoDesc.data;
      error = retryNoDesc.error;
    }

    if (error) {
      console.warn("Technician queue intake-aware select failed; retrying with legacy columns.", error);
      const retryResult = await runJobsQuery(selectLegacy);
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) throw error;
    const hydratedJobs = ((data ?? []) as Array<Record<string, unknown>>).map((job) => ({
        ...job,
        service_description: "service_description" in job ? job.service_description : null,
        intake_state: "intake_state" in job ? job.intake_state : null,
        claimed_at: "claimed_at" in job ? job.claimed_at : null,
        claimed_by_user_id: "claimed_by_user_id" in job ? job.claimed_by_user_id : null,
        scheduled_start: "scheduled_start" in job ? (job.scheduled_start as string | null) : null,
        scheduled_end: "scheduled_end" in job ? (job.scheduled_end as string | null) : null,
        service_location_name: "service_location_name" in job ? (job.service_location_name as string | null) : null,
        service_address: "service_address" in job ? (job.service_address as string | null) : null,
        service_city: "service_city" in job ? (job.service_city as string | null) : null,
        service_state: "service_state" in job ? (job.service_state as string | null) : null,
        service_zip: "service_zip" in job ? (job.service_zip as string | null) : null,
        service_checklist_started_at:
          "service_checklist_started_at" in job
            ? (job.service_checklist_started_at as string | null)
            : null,
        service_checklist_completed_at:
          "service_checklist_completed_at" in job
            ? (job.service_checklist_completed_at as string | null)
            : null,
        customer: getSingleRelation(job.customer),
        vehicle: getSingleRelation(job.vehicle),
      })) as TechnicianJob[];
    setJobs(hydratedJobs);

    if (!hydratedJobs.length) {
      setCustomerUpdateMetaByJobId({});
      return;
    }

    const { data: updatesData, error: updatesError } = await supabase
      .from("job_customer_updates")
      .select("job_id, visibility, created_at")
      .in(
        "job_id",
        hydratedJobs.map((job) => job.id),
      )
      .eq("visibility", "customer")
      .order("created_at", { ascending: false });
    if (updatesError) {
      // Keep queue usable when the updates migration is not yet applied.
      setCustomerUpdateMetaByJobId({});
      console.warn("Job update metadata unavailable; showing queue without update freshness.", updatesError);
      return;
    }
    const meta = (updatesData ?? []).reduce<Record<string, { count: number; latestAt: string | null }>>(
      (acc, row) => {
        const current = acc[row.job_id] ?? { count: 0, latestAt: null };
        current.count += 1;
        if (!current.latestAt) {
          current.latestAt = row.created_at;
        }
        acc[row.job_id] = current;
        return acc;
      },
      {},
    );
    setCustomerUpdateMetaByJobId(meta);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: number | null = null;

    const checkAccessAndLoad = async (attempt = 0) => {
      const { user, roles } = await getUserRoles();

      if (cancelled) {
        return;
      }

      if (!user) {
        if (attempt < 6) {
          retryTimeout = window.setTimeout(() => {
            void checkAccessAndLoad(attempt + 1);
          }, 250);
          return;
        }

        setAccessIssue("We could not confirm your technician session on this device. Refresh and try the Tech portal again.");
        setLoading(false);
        return;
      }

      if (!hasPortalAccess(roles, "tech")) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      try {
        setAccessIssue("");
        setCurrentUserId(user.id);
        portalRolesRef.current = roles;
        await loadJobs(user.id, roles);
        loadSavedDrafts();
      } catch (error) {
        console.error("Failed to load technician queue:", error);
      } finally {
        setLoading(false);
      }
    };

    void checkAccessAndLoad();

    return () => {
      cancelled = true;
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [loadJobs, loadSavedDrafts]);

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const staleUpdateThresholdMs = 2 * 60 * 60 * 1000;
    const now = Date.now();

    return jobs.filter((job) => {
      const updateMeta = customerUpdateMetaByJobId[job.id];
      const latestUpdateAtMs = updateMeta?.latestAt ? new Date(updateMeta.latestAt).getTime() : null;
      const needsCustomerUpdate =
        (job.intake_state === "on_site" || job.intake_state === "in_service" || job.intake_state === "waiting_parts") &&
        (!latestUpdateAtMs || now - latestUpdateAtMs > staleUpdateThresholdMs);

      if (view === "unclaimed" && job.assigned_tech_user_id) return false;
      if (view === "claimed" && job.assigned_tech_user_id !== currentUserId) return false;
      if (view === "needsUpdate" && !needsCustomerUpdate) return false;
      if (
        view === "blocked" &&
        job.intake_state !== "waiting_parts" &&
        job.intake_state !== "awaiting_customer_approval"
      ) {
        return false;
      }

      const customerName = `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const jobNumber = (job.business_job_number ?? "").toLowerCase();
      const serviceType = (job.service_type ?? "").toLowerCase();
      const serviceDescription = (job.service_description ?? "").toLowerCase();
      const plate = (job.vehicle?.license_plate ?? "").toLowerCase();
      const vin = (job.vehicle?.vin ?? "").toLowerCase();

      if (!term) {
        return true;
      }

      return (
        customerName.includes(term) ||
        jobNumber.includes(term) ||
        serviceType.includes(term) ||
        serviceDescription.includes(term) ||
        plate.includes(term) ||
        vin.includes(term)
      );
    });
  }, [jobs, searchTerm, view, customerUpdateMetaByJobId, currentUserId]);

  const filteredDrafts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return savedDrafts.filter((draft) => {
      if (!term) return true;
      return `${draft.title} ${draft.subtitle}`.toLowerCase().includes(term);
    });
  }, [savedDrafts, searchTerm]);

  const handleDeleteJob = useCallback(async (job: TechnicianJob) => {
    if (job.status === "completed") {
      setActionTone("error");
      setActionMessage("Completed jobs cannot be deleted by technicians.");
      return;
    }

    const jobLabel = job.business_job_number || job.id.slice(0, 8);
    const customerName = `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim();
    const confirmed = window.confirm(
      `Delete job #${jobLabel}${customerName ? ` for ${customerName}` : ""}? This will be logged in the admin deleted job history.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingJobId(job.id);
    setActionTone("info");
    setActionMessage(`Deleting job #${jobLabel}...`);

    try {
      await deleteJobWithRelatedRecords(job.id);
      setJobs((prev) => prev.filter((currentJob) => currentJob.id !== job.id));
      setActionTone("success");
      setActionMessage(`Deleted job #${jobLabel}.`);
    } catch (error) {
      console.error("Failed to delete technician job:", error);
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "Failed to delete job.");
    } finally {
      setDeletingJobId(null);
    }
  }, []);

  const handleClaimJob = useCallback(async (jobId: string) => {
    setClaimingJobId(jobId);
    setActionTone("info");
    setActionMessage("Claiming job...");
    const roles = portalRolesRef.current;
    try {
      const { error } = await supabase.rpc("claim_job_for_current_tech", { p_job_id: jobId });
      if (error) throw error;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                assigned_tech_user_id: currentUserId,
                intake_state: j.intake_state ?? "claimed",
                claimed_at: j.claimed_at ?? new Date().toISOString(),
                claimed_by_user_id: currentUserId,
                status:
                  j.status === "new" || j.status === "new_request" || j.status === "draft"
                    ? "in_progress"
                    : j.status,
              }
            : j,
        ),
      );
      await loadJobs(currentUserId, roles.length ? roles : ["technician"]);
      setActionTone("success");
      setActionMessage("Job claimed. You can now open the service workflow.");
    } catch (error) {
      setActionTone("error");
      setActionMessage(getSupabaseErrorMessage(error));
    } finally {
      setClaimingJobId(null);
    }
  }, [currentUserId, loadJobs]);

  const handleSetIntakeState = useCallback(
    async (jobId: string, intakeState: string, nextStatus?: string | null) => {
      setIntakeUpdatePending({ jobId, intakeState });
      setActionTone("info");
      setActionMessage(`Updating job status to ${intakeState.replaceAll("_", " ")}...`);
      const roles = portalRolesRef.current;
      try {
        const { error: rpcError } = await supabase.rpc("update_job_intake_state", {
          p_job_id: jobId,
          p_intake_state: intakeState,
          p_status: nextStatus ?? null,
        });

        if (rpcError) {
          const { error: directError } = await supabase
            .from("jobs")
            .update({
              intake_state: intakeState,
              ...(nextStatus ? { status: nextStatus } : {}),
            })
            .eq("id", jobId);
          if (directError) throw directError;
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  intake_state: intakeState,
                  status: nextStatus ?? j.status,
                }
              : j,
          ),
        );
        await loadJobs(currentUserId, roles.length ? roles : ["technician"]);
        setActionTone("success");
        setActionMessage(`Updated job status to ${intakeState.replaceAll("_", " ")}.`);
      } catch (error) {
        setActionTone("error");
        setActionMessage(getSupabaseErrorMessage(error));
      } finally {
        setIntakeUpdatePending(null);
      }
    },
    [currentUserId, loadJobs],
  );

  const handleOpenServiceWorkflow = useCallback(
    (job: TechnicianJob) => {
      if (job.assigned_tech_user_id !== currentUserId) {
        setActionTone("error");
        setActionMessage("Claim this job first.");
        return;
      }
      setActionTone("info");
      setActionMessage("Opening service workflow...");
      router.push(`/tech/jobs/${job.id}`);
    },
    [currentUserId, router],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-slate-700">Loading technician queue...</p>
        </div>
      </div>
    );
  }

  if (accessIssue) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-base font-semibold text-slate-900">Technician queue unavailable</p>
          <p className="mt-2 text-sm text-slate-700">{accessIssue}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Technician Job Queue</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Claim a job, then continue inside the single guided mechanic workspace.
                </p>
              </div>

              <div className="w-full max-w-2xl space-y-4">
                <div className="flex justify-end">
                  <PortalTopNav section="tech" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customer, job number, vehicle, plate, or VIN"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className={mobileActionButtonClassName} type="button" variant={view === "all" ? "default" : "outline"} onClick={() => setView("all")}>
                  All
                </Button>
                <Button className={mobileActionButtonClassName} type="button" variant={view === "unclaimed" ? "default" : "outline"} onClick={() => setView("unclaimed")}>
                  Unclaimed
                </Button>
                <Button className={mobileActionButtonClassName} type="button" variant={view === "claimed" ? "default" : "outline"} onClick={() => setView("claimed")}>
                  My Claimed
                </Button>
                <Button className={mobileActionButtonClassName} type="button" variant={view === "needsUpdate" ? "default" : "outline"} onClick={() => setView("needsUpdate")}>
                  Needs Customer Update
                </Button>
                <Button className={mobileActionButtonClassName} type="button" variant={view === "blocked" ? "default" : "outline"} onClick={() => setView("blocked")}>
                  Held (parts / approval)
                </Button>
                <Button className={mobileActionButtonClassName} type="button" variant={view === "drafts" ? "default" : "outline"} onClick={() => setView("drafts")}>
                  Drafts
                </Button>
              </div>
            </div>
            {actionMessage ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  actionTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : actionTone === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                {actionMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {view === "drafts" ? (
          filteredDrafts.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredDrafts.map((draft) => (
                <Card key={draft.id} className="rounded-3xl border border-slate-200 bg-white shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="font-semibold text-slate-900">{draft.title}</div>
                    <div className="text-sm text-slate-600">{draft.subtitle}</div>
                    <div className="text-xs text-slate-500">
                      Saved {new Date(draft.savedAt).toLocaleString()}
                    </div>
                    <Button className={mobileActionButtonClassName} type="button" variant="outline" onClick={() => router.push(`/tech/inspection?draftId=${draft.id}`)}>
                      Open Draft
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="p-6 text-sm text-slate-600">
                No saved drafts match this search.
              </CardContent>
            </Card>
          )
        ) : filteredJobs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        Job #{job.business_job_number || job.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {[job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") || "Customer"}
                      </div>
                      <div className="text-sm text-slate-600">
                        {[job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
                      </div>
                      <div className="text-sm text-slate-500 break-words">
                        {job.service_description || job.service_type || "No requested work listed"}
                      </div>
                      {formatAppointment(job.scheduled_start, job.scheduled_end) ||
                      formatJobLocation(job) ||
                      job.notes ? (
                        <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 text-xs">
                          {formatAppointment(job.scheduled_start, job.scheduled_end) ? (
                            <div className="flex gap-2 text-slate-600">
                              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
                              <div className="min-w-0 break-words">
                                <span className="font-medium text-slate-700">Appointment: </span>
                                {formatAppointment(job.scheduled_start, job.scheduled_end)}
                              </div>
                            </div>
                          ) : null}
                          {formatJobLocation(job) ? (
                            <div className="flex gap-2 text-slate-600">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
                              <div className="min-w-0 break-words">
                                <span className="font-medium text-slate-700">Location: </span>
                                {formatJobLocation(job)}
                              </div>
                            </div>
                          ) : null}
                          {job.notes ? (
                            <div className="flex gap-2 text-slate-600">
                              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                              <div className="min-w-0 break-words">
                                <span className="font-medium text-slate-700">Notes for technician: </span>
                                <span className="whitespace-pre-wrap">{job.notes}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-row flex-wrap items-start gap-2 sm:flex-col sm:items-end">
                      <Badge variant="secondary" className="rounded-full whitespace-normal text-center">
                        {(job.status || "new_request").replaceAll("_", " ")}
                      </Badge>
                      {!job.assigned_tech_user_id && (
                        <Badge variant="outline" className="rounded-full whitespace-normal text-center">
                          Unassigned
                        </Badge>
                      )}
                      {job.intake_state ? (
                        <Badge variant="outline" className="rounded-full whitespace-normal text-center">
                          {job.intake_state.replaceAll("_", " ")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {!job.assigned_tech_user_id ? (
                      <Button
                        className={mobileActionButtonClassName}
                        type="button"
                        disabled={claimingJobId === job.id}
                        onClick={() => void handleClaimJob(job.id)}
                      >
                        {claimingJobId === job.id ? "Claiming..." : "Claim Job"}
                      </Button>
                    ) : null}
                    {job.assigned_tech_user_id === currentUserId ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(headerActionButtonClassName, mobileActionButtonClassName, startServiceButtonClass(job))}
                          disabled={!!intakeUpdatePending && intakeUpdatePending.jobId === job.id}
                          onClick={() => handleOpenServiceWorkflow(job)}
                        >
                          {job.service_checklist_completed_at
                            ? "Open completed flow"
                            : job.service_checklist_started_at
                              ? "Continue guided flow"
                              : "Start guided flow"}
                        </Button>
                        <Button
                          className={mobileActionButtonClassName}
                          type="button"
                          variant="outline"
                          disabled={!!intakeUpdatePending && intakeUpdatePending.jobId === job.id}
                          onClick={() => void handleSetIntakeState(job.id, "waiting_parts", "in_progress")}
                        >
                          {intakeUpdatePending?.jobId === job.id &&
                          intakeUpdatePending.intakeState === "waiting_parts" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating…
                            </>
                          ) : (
                            "Mark Waiting on Parts"
                          )}
                        </Button>
                        <Button
                          className={mobileActionButtonClassName}
                          type="button"
                          variant="outline"
                          onClick={() => router.push(`/tech/jobs/${job.id}?composeUpdate=1`)}
                        >
                          Send Update
                        </Button>
                      </>
                    ) : null}
                    <Button className={mobileActionButtonClassName} type="button" variant="outline" onClick={() => router.push(`/tech/jobs/${job.id}`)}>
                      Open guided flow
                    </Button>
                    <Button
                      className={mobileActionButtonClassName}
                      type="button"
                      variant="destructive"
                      disabled={deletingJobId === job.id || job.status === "completed"}
                      onClick={() => void handleDeleteJob(job)}
                    >
                      {deletingJobId === job.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete Job
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="p-6 text-sm text-slate-600">
              No matching jobs found.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
