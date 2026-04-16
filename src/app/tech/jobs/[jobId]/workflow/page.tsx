"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  MapPin,
  MessageSquare,
  StickyNote,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import {
  createJobCustomerUpdate,
  fetchJobCustomerUpdates,
  type JobCustomerUpdateRow,
  type JobCustomerUpdateType,
} from "@/lib/job-customer-updates";
import { techCustomerUpdateTemplates } from "@/lib/tech-customer-update-templates";

type WorkflowJob = {
  id: string;
  business_job_number: string | null;
  status: string | null;
  intake_state: string | null;
  service_type: string | null;
  service_description: string | null;
  notes: string | null;
  estimate_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  service_checklist_started_at: string | null;
  service_checklist_completed_at: string | null;
  assigned_tech_user_id: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
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

type JobServiceRow = {
  id: string;
  job_id: string;
  service_name: string;
  service_description: string | null;
  sort_order: number;
  completed_at: string | null;
};

type EstimateLineRow = {
  id: string;
  description: string;
  quantity: number | null;
  sort_order: number | null;
};

const getSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const getSupabaseErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Request failed.";
};

function formatWhen(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatLocation(job: WorkflowJob) {
  const parts = [
    job.service_location_name,
    job.service_address,
    [job.service_city, job.service_state].filter(Boolean).join(", "),
    job.service_zip,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(" · ") : null;
}

export default function TechJobWorkflowPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;

  const [loading, setLoading] = useState(true);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [completingSection, setCompletingSection] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const [job, setJob] = useState<WorkflowJob | null>(null);
  const [jobServices, setJobServices] = useState<JobServiceRow[]>([]);
  const [estimateLines, setEstimateLines] = useState<EstimateLineRow[]>([]);
  const [updates, setUpdates] = useState<JobCustomerUpdateRow[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  const [composerType, setComposerType] = useState<JobCustomerUpdateType>("status");
  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const canAccessJob = useMemo(() => {
    if (!job || !currentUserId) return false;
    if (roles.includes("manager") || roles.includes("admin")) return true;
    return job.assigned_tech_user_id === currentUserId;
  }, [job, currentUserId, roles]);

  const allPlannedLinesDone = useMemo(() => {
    if (jobServices.length === 0) return true;
    return jobServices.every((s) => s.completed_at);
  }, [jobServices]);

  const markStartedIfNeeded = useCallback(async (j: WorkflowJob) => {
    if (j.service_checklist_started_at) return;
    const started = new Date().toISOString();
    const patch: Record<string, string> = {
      service_checklist_started_at: started,
      updated_at: started,
    };
    if (!j.intake_state || j.intake_state === "claimed" || j.intake_state === "queued") {
      patch.intake_state = "in_service";
    }
    const { error } = await supabase.from("jobs").update(patch).eq("id", j.id);
    if (error) {
      console.warn("Could not mark service checklist start:", error);
      return;
    }
    setJob((prev) =>
      prev && prev.id === j.id
        ? {
            ...prev,
            service_checklist_started_at: started,
            intake_state: patch.intake_state ?? prev.intake_state,
          }
        : prev,
    );
  }, []);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data: row, error: jobError } = await supabase
        .from("jobs")
        .select(
          `
          id,
          business_job_number,
          status,
          intake_state,
          service_type,
          service_description,
          notes,
          estimate_id,
          scheduled_start,
          scheduled_end,
          service_location_name,
          service_address,
          service_city,
          service_state,
          service_zip,
          service_checklist_started_at,
          service_checklist_completed_at,
          assigned_tech_user_id,
          customer_id,
          vehicle_id,
          customer:customers(first_name, last_name, email, phone),
          vehicle:vehicles(year, make, model, license_plate, vin)
        `,
        )
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!row) {
        setJob(null);
        return;
      }

      const hydrated = {
        ...row,
        customer: getSingle(row.customer as WorkflowJob["customer"] | WorkflowJob["customer"][]),
        vehicle: getSingle(row.vehicle as WorkflowJob["vehicle"] | WorkflowJob["vehicle"][]),
      } as WorkflowJob;

      setJob(hydrated);

      const { data: services, error: svcError } = await supabase
        .from("job_services")
        .select("id, job_id, service_name, service_description, sort_order, completed_at")
        .eq("job_id", jobId)
        .order("sort_order", { ascending: true });

      if (svcError) throw svcError;
      setJobServices((services ?? []) as JobServiceRow[]);

      if (hydrated.estimate_id && (!services || services.length === 0)) {
        const { data: lines, error: lineError } = await supabase
          .from("estimate_line_items")
          .select("id, description, quantity, sort_order")
          .eq("estimate_id", hydrated.estimate_id)
          .order("sort_order", { ascending: true });
        if (!lineError) {
          setEstimateLines((lines ?? []) as EstimateLineRow[]);
        } else {
          setEstimateLines([]);
        }
      } else {
        setEstimateLines([]);
      }

      await markStartedIfNeeded(hydrated);
    } catch (e) {
      console.error(e);
      alert(getSupabaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [jobId, markStartedIfNeeded]);

  useEffect(() => {
    const init = async () => {
      const { user, roles: r } = await getUserRoles();
      if (!user) {
        router.replace("/customer/login");
        return;
      }
      if (!hasPortalAccess(r, "tech")) {
        router.replace(getPostLoginRoute(r));
        return;
      }
      setCurrentUserId(user.id);
      setRoles(r);
    };
    void init();
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;
    void load();
  }, [currentUserId, load]);

  useEffect(() => {
    if (!jobId || !job) return;
    let cancelled = false;
    const run = async () => {
      setUpdatesLoading(true);
      try {
        const rows = await fetchJobCustomerUpdates(jobId);
        if (!cancelled) setUpdates(rows.filter((u) => u.visibility === "customer"));
      } catch (e) {
        console.warn("Updates load failed:", e);
        if (!cancelled) setUpdates([]);
      } finally {
        if (!cancelled) setUpdatesLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId, job]);

  const toggleServiceDone = async (service: JobServiceRow, next: boolean) => {
    if (!currentUserId) return;
    setSavingLineId(service.id);
    try {
      const { error } = await supabase
        .from("job_services")
        .update({
          completed_at: next ? new Date().toISOString() : null,
          completed_by_user_id: next ? currentUserId : null,
        })
        .eq("id", service.id);
      if (error) throw error;
      setJobServices((prev) =>
        prev.map((s) =>
          s.id === service.id
            ? {
                ...s,
                completed_at: next ? new Date().toISOString() : null,
              }
            : s,
        ),
      );
    } catch (e) {
      alert(getSupabaseErrorMessage(e));
    } finally {
      setSavingLineId(null);
    }
  };

  const runIntakeUpdate = async (intakeState: string, status?: string | null) => {
    const { error: rpcError } = await supabase.rpc("update_job_intake_state", {
      p_job_id: jobId,
      p_intake_state: intakeState,
      p_status: status ?? null,
    });
    if (rpcError) {
      const { error: directError } = await supabase
        .from("jobs")
        .update({
          intake_state: intakeState,
          ...(status ? { status } : {}),
        })
        .eq("id", jobId);
      if (directError) throw directError;
    }
  };

  const sendCustomerMessage = async (params: {
    update_type: JobCustomerUpdateType;
    title: string;
    message: string;
  }) => {
    await createJobCustomerUpdate({
      job_id: jobId,
      update_type: params.update_type,
      title: params.title.trim(),
      message: params.message.trim(),
      visibility: "customer",
    });
    const rows = await fetchJobCustomerUpdates(jobId);
    setUpdates(rows.filter((u) => u.visibility === "customer"));
  };

  const handleSendComposer = async () => {
    if (!composerTitle.trim() || !composerBody.trim()) {
      alert("Add a title and message.");
      return;
    }
    setSendingUpdate(true);
    try {
      await sendCustomerMessage({
        update_type: composerType,
        title: composerTitle,
        message: composerBody,
      });
      setComposerTitle("");
      setComposerBody("");
    } catch (e) {
      alert(getSupabaseErrorMessage(e));
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleCompleteChecklistSection = async () => {
    if (!allPlannedLinesDone && jobServices.length > 0) {
      const ok = window.confirm(
        "Some planned services are not checked off. Mark this section complete anyway?",
      );
      if (!ok) return;
    }
    setCompletingSection(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ service_checklist_completed_at: new Date().toISOString() })
        .eq("id", jobId);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(getSupabaseErrorMessage(e));
    } finally {
      setCompletingSection(false);
    }
  };

  const handleQuickAction = async (key: string) => {
    setActionBusy(key);
    try {
      if (key === "parts") {
        await runIntakeUpdate("waiting_parts", "in_progress");
        await sendCustomerMessage({
          update_type: "parts_delay",
          title: "Waiting on parts",
          message:
            "We are waiting on parts for your vehicle. We will notify you as soon as they arrive and work resumes.",
        });
      } else if (key === "approval") {
        await runIntakeUpdate("awaiting_customer_approval", "in_progress");
        await sendCustomerMessage({
          update_type: "customer_approval",
          title: "Additional work needs your approval",
          message:
            "We recommend additional work that was not on the original plan. Please review and approve in your customer portal so we can continue.",
        });
      } else if (key === "complete") {
        await runIntakeUpdate("completed", "completed");
        await sendCustomerMessage({
          update_type: "service_complete",
          title: "Service complete",
          message:
            "Your service is complete. Please review the inspection and notes in your portal. Thank you for choosing us.",
        });
        router.push("/tech/jobs");
        return;
      }
      await load();
    } catch (e) {
      alert(getSupabaseErrorMessage(e));
    } finally {
      setActionBusy(null);
    }
  };

  const applyTemplate = (id: JobCustomerUpdateType) => {
    const t = techCustomerUpdateTemplates.find((x) => x.id === id);
    if (t) {
      setComposerType(id);
      setComposerTitle(t.title);
      setComposerBody(t.message);
    }
  };

  if (loading || !currentUserId) {
    return (
      <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
          <p className="text-slate-700">Loading job workflow…</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="p-6 text-sm text-slate-600">
              Job not found or you do not have access.
            </CardContent>
          </Card>
          <Button type="button" variant="outline" onClick={() => router.push("/tech/jobs")}>
            Back to queue
          </Button>
        </div>
      </div>
    );
  }

  if (!canAccessJob) {
    return (
      <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
        <Card className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="p-6 text-sm text-slate-600">
            You do not have access to this job. Claim it from the queue first.
          </CardContent>
        </Card>
        <div className="mx-auto mt-4 max-w-4xl">
          <Button type="button" variant="outline" onClick={() => router.push("/tech/jobs")}>
            Back to queue
          </Button>
        </div>
      </div>
    );
  }

  const locationLabel = formatLocation(job);
  const appointmentLabel = job.scheduled_start
    ? `${formatWhen(job.scheduled_start)}${
        job.scheduled_end ? ` – ${formatWhen(job.scheduled_end)}` : ""
      }`
    : null;

  return (
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardHeader className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service workflow
              </p>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Job #{job.business_job_number || job.id.slice(0, 8)}
              </CardTitle>
              <p className="text-sm text-slate-600">
                {[job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") ||
                  "Customer"}{" "}
                ·{" "}
                {[job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") ||
                  "Vehicle"}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <PortalTopNav section="tech" />
              <div className="flex flex-wrap gap-2">
                <BackToPortalButton className={headerActionButtonClassName} />
                <Button type="button" variant="outline" className={headerActionButtonClassName} asChild>
                  <Link href="/tech/jobs">Job queue</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {appointmentLabel ? (
                <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
                  <div>
                    <div className="font-medium text-slate-800">Appointment</div>
                    <div className="text-slate-600">{appointmentLabel}</div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-500">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>No appointment time on this job.</div>
                </div>
              )}
              {locationLabel ? (
                <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
                  <div>
                    <div className="font-medium text-slate-800">Location</div>
                    <div className="text-slate-600">{locationLabel}</div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>No service location on file.</div>
                </div>
              )}
            </div>

            {job.notes ? (
              <div className="flex gap-2 rounded-2xl border border-amber-200/50 bg-amber-50/30 p-3 text-sm">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <div className="font-medium text-slate-800">Notes for technician</div>
                  <div className="whitespace-pre-wrap text-slate-700">{job.notes}</div>
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ClipboardCheck className="h-5 w-5 text-lime-600" />
                Planned services
              </div>
              {jobServices.length > 0 ? (
                <ul className="space-y-2">
                  {jobServices.map((svc) => (
                    <li
                      key={svc.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <Checkbox
                        id={`svc-${svc.id}`}
                        checked={!!svc.completed_at}
                        disabled={savingLineId === svc.id}
                        onCheckedChange={(v) => void toggleServiceDone(svc, v === true)}
                      />
                      <label htmlFor={`svc-${svc.id}`} className="flex-1 cursor-pointer space-y-0.5">
                        <div className="font-medium text-slate-900">{svc.service_name}</div>
                        {svc.service_description ? (
                          <div className="text-sm text-slate-600">{svc.service_description}</div>
                        ) : null}
                      </label>
                      {savingLineId === svc.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                    </li>
                  ))}
                </ul>
              ) : estimateLines.length > 0 ? (
                <ul className="space-y-2">
                  {estimateLines.map((line) => (
                    <li
                      key={line.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700"
                    >
                      <span className="font-medium text-slate-900">{line.description}</span>
                      {line.quantity != null ? (
                        <span className="text-slate-500"> · Qty {line.quantity}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                  No line items yet. Planned work from the job record:{" "}
                  <span className="font-medium text-slate-800">
                    {job.service_description || job.service_type || "—"}
                  </span>
                </p>
              )}

              <Button
                type="button"
                className="bg-[#39FF14] font-semibold text-black hover:bg-[#32e612]"
                disabled={completingSection || !!job.service_checklist_completed_at}
                onClick={() => void handleCompleteChecklistSection()}
              >
                {job.service_checklist_completed_at ? (
                  "Service checklist section completed"
                ) : completingSection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Complete service checklist section"
                )}
              </Button>
              {!allPlannedLinesDone && jobServices.length > 0 ? (
                <p className="text-xs text-amber-700">
                  Check off each line above, or complete the section anyway if the list does not apply.
                </p>
              ) : null}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Wrench className="h-5 w-5 text-lime-600" />
                Inspection &amp; details
              </div>
              <p className="text-sm text-slate-600">
                Open the full technician inspection for this vehicle. Findings sync with the customer portal the same
                way as today.
              </p>
              <Button type="button" variant="outline" asChild>
                <Link href={`/tech?jobId=${jobId}`}>Open technician inspection</Link>
              </Button>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <MessageSquare className="h-5 w-5 text-lime-600" />
                Customer messages
              </div>
              <p className="text-sm text-slate-600">
                Messages you send here use <strong>customer</strong> visibility — customers, managers, and admins can
                read them in the app.
              </p>

              <div className="flex flex-wrap gap-2">
                {techCustomerUpdateTemplates.map((t) => (
                  <Button key={t.id} type="button" size="sm" variant="secondary" onClick={() => applyTemplate(t.id)}>
                    {t.title}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="space-y-2">
                  <Label>Update type</Label>
                  <Select
                    value={composerType}
                    onValueChange={(v) => setComposerType(v as JobCustomerUpdateType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {techCustomerUpdateTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={composerTitle} onChange={(e) => setComposerTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={composerBody}
                    onChange={(e) => setComposerBody(e.target.value)}
                    rows={4}
                    className="min-h-[100px]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void handleSendComposer()}
                  disabled={sendingUpdate}
                >
                  {sendingUpdate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send to customer"
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-800">Recent customer-visible updates</div>
                {updatesLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : updates.length === 0 ? (
                  <p className="text-sm text-slate-500">No updates yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {updates.slice(0, 12).map((u) => (
                      <li key={u.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{u.title}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(u.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{u.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-6">
              <div className="text-lg font-semibold text-slate-900">Update job status</div>
              <p className="text-sm text-slate-600">
                Quick actions set intake state and send a matching customer-visible message.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!actionBusy}
                  onClick={() => void handleQuickAction("parts")}
                >
                  {actionBusy === "parts" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Waiting on parts
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!actionBusy}
                  onClick={() => void handleQuickAction("approval")}
                >
                  {actionBusy === "approval" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Needs customer approval (added work)
                </Button>
                <Button
                  type="button"
                  className="bg-[#EEFF00] font-medium text-black hover:bg-[#dde600]"
                  disabled={!!actionBusy}
                  onClick={() => void handleQuickAction("complete")}
                >
                  {actionBusy === "complete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Mark job completed
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                For anything else, use the composer above with a custom title and message (still sent to the customer).
              </p>
            </section>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <Button type="button" variant="ghost" asChild>
                <Link href="/tech/jobs" className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to job queue
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
