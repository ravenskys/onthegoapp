"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { TECH_SAVED_DRAFTS_STORAGE_KEY } from "@/lib/tech-inspection";
import { deleteJobWithRelatedRecords } from "@/lib/job-deletion";

const ACTIVE_JOB_STATUSES = ["new", "new_request", "in_progress", "draft"] as const;

type TechnicianJob = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  business_job_number: string | null;
  service_type: string | null;
  status: string | null;
  notes: string | null;
  assigned_tech_user_id: string | null;
  created_at: string;
  requested_date: string | null;
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

type QueueView = "open" | "unassigned" | "drafts";

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export default function TechnicianJobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<TechnicianJob[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedTechDraft[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<QueueView>("open");
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

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
    let query = supabase
      .from("jobs")
      .select(`
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
      `)
      .in("status", [...ACTIVE_JOB_STATUSES])
      .order("created_at", { ascending: false });

    if (!roles.includes("manager") && !roles.includes("admin")) {
      query = query.or(`assigned_tech_user_id.eq.${userId},assigned_tech_user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    setJobs(
      (data ?? []).map((job) => ({
        ...job,
        customer: getSingleRelation(job.customer),
        vehicle: getSingleRelation(job.vehicle),
      }))
    );
  }, []);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const { user, roles } = await getUserRoles();

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roles, "tech")) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      try {
        await loadJobs(user.id, roles);
        loadSavedDrafts();
      } catch (error) {
        console.error("Failed to load technician queue:", error);
      } finally {
        setLoading(false);
      }
    };

    void checkAccessAndLoad();
  }, [loadJobs, loadSavedDrafts]);

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      if (view === "unassigned" && job.assigned_tech_user_id) {
        return false;
      }

      const customerName = `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const jobNumber = (job.business_job_number ?? "").toLowerCase();
      const serviceType = (job.service_type ?? "").toLowerCase();
      const plate = (job.vehicle?.license_plate ?? "").toLowerCase();
      const vin = (job.vehicle?.vin ?? "").toLowerCase();

      if (!term) {
        return true;
      }

      return (
        customerName.includes(term) ||
        jobNumber.includes(term) ||
        serviceType.includes(term) ||
        plate.includes(term) ||
        vin.includes(term)
      );
    });
  }, [jobs, searchTerm, view]);

  const filteredDrafts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return savedDrafts.filter((draft) => {
      if (!term) return true;
      return `${draft.title} ${draft.subtitle}`.toLowerCase().includes(term);
    });
  }, [savedDrafts, searchTerm]);

  const handleDeleteJob = useCallback(async (job: TechnicianJob) => {
    if (job.status === "completed") {
      alert("Completed jobs cannot be deleted by technicians.");
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

    try {
      await deleteJobWithRelatedRecords(job.id);
      setJobs((prev) => prev.filter((currentJob) => currentJob.id !== job.id));
    } catch (error) {
      console.error("Failed to delete technician job:", error);
      alert(error instanceof Error ? error.message : "Failed to delete job.");
    } finally {
      setDeletingJobId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow-md">
          <p className="text-slate-700">Loading technician queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Technician Job Queue</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Open a job or draft to refill the technician inspection page.
                </p>
              </div>

              <div className="w-full max-w-2xl space-y-4">
                <div className="flex justify-end">
                  <PortalTopNav section="tech" />
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <BackToPortalButton className={headerActionButtonClassName} />
                  <Button
                    type="button"
                    variant="outline"
                    className={headerActionButtonClassName}
                    onClick={() => router.push("/tech")}
                  >
                    Back to Tech Page
                  </Button>
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

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={view === "open" ? "default" : "outline"} onClick={() => setView("open")}>
                  Open
                </Button>
                <Button type="button" variant={view === "unassigned" ? "default" : "outline"} onClick={() => setView("unassigned")}>
                  Unassigned
                </Button>
                <Button type="button" variant={view === "drafts" ? "default" : "outline"} onClick={() => setView("drafts")}>
                  Drafts
                </Button>
              </div>
            </div>
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
                    <Button type="button" variant="outline" onClick={() => router.push(`/tech?draftId=${draft.id}`)}>
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        Job #{job.business_job_number || job.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {[job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") || "Customer"}
                      </div>
                      <div className="text-sm text-slate-600">
                        {[job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {job.vehicle?.license_plate || job.vehicle?.vin || job.service_type || "No vehicle info"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        {(job.status || "new_request").replaceAll("_", " ")}
                      </Badge>
                      {!job.assigned_tech_user_id && (
                        <Badge variant="outline" className="rounded-full">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => router.push(`/tech?jobId=${job.id}`)}>
                      Open on Tech Page
                    </Button>
                    <Button
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
