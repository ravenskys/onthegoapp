"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Car,
  Check,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TechnicianJob = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  estimate_id: string | null;
  business_job_number: string | null;
  service_type: string | null;
  service_description: string | null;
  status: string | null;
  intake_state: string | null;
  notes: string | null;
  assigned_tech_user_id: string | null;
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

type JobServiceRow = {
  id: string;
  service_code: string | null;
  service_name: string;
  service_description: string | null;
  estimated_hours: number | null;
  estimated_price: number | null;
  sort_order: number | null;
  notes: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
};

type ServiceCatalogRow = {
  id: string;
  service_code: string | null;
  service_name: string;
  service_description: string | null;
  default_duration_minutes: number | null;
  default_price: number | null;
  is_active: boolean | null;
  category: string | null;
};

type EstimateRow = {
  id: string;
  estimate_status: string;
  estimate_number: string | null;
  subtotal: number | null;
  tax_total: number | null;
  total_amount: number | null;
  approved_at: string | null;
  declined_at: string | null;
  notes: string | null;
};

type PaymentRow = {
  id: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  reference_number: string | null;
  notes: string | null;
  paid_at: string | null;
};

type StageKey =
  | "dispatch"
  | "arrival"
  | "complaint"
  | "preinspection"
  | "inspection"
  | "quote"
  | "work"
  | "payment"
  | "closeout";

type TechFlowDraft = {
  currentStage: StageKey;
  complaintSummary: string;
  complaintDetails: string;
  addedServiceReason: string;
  mileage: string;
  vinConfirmed: boolean;
  cornerPhotoCount: number;
  interiorPhotoCount: number;
  vinPhotoCount: number;
  inspectionType: "" | "mini" | "full";
  inspectionSummary: string;
  quoteNotes: string;
  quoteApprovalStatus: "draft" | "pending" | "approved" | "declined" | "signed";
  customerSignatureName: string;
  postWorkSummary: string;
  receiptSent: boolean;
  receiptStored: boolean;
};

const STAGES: Array<{
  key: StageKey;
  title: string;
  description: string;
  actionLabel: string;
}> = [
  {
    key: "dispatch",
    title: "Dispatch Review",
    description: "Confirm the appointment, customer, vehicle, and service location.",
    actionLabel: "Start Arrival",
  },
  {
    key: "arrival",
    title: "Arrive at Service Location",
    description: "Mark the visit on site before the technician starts check-in.",
    actionLabel: "Begin Pre-Inspection",
  },
  {
    key: "complaint",
    title: "Complaint and Requested Services",
    description: "Capture the customer concern and confirm the services in scope.",
    actionLabel: "Confirm Complaint and Services",
  },
  {
    key: "preinspection",
    title: "Pre-Inspection Check-In",
    description: "Confirm mileage, VIN, and required pre-inspection photo counts.",
    actionLabel: "Complete Pre-Inspection",
  },
  {
    key: "inspection",
    title: "Inspection and Findings",
    description: "Pick mini or full inspection and summarize the findings.",
    actionLabel: "Finish Inspection",
  },
  {
    key: "quote",
    title: "Quote and Approval",
    description: "Review service lines, edit quote notes, and capture approval state.",
    actionLabel: "Move Into Service Work",
  },
  {
    key: "work",
    title: "Planned Service Work",
    description: "Perform approved work and check service lines off as completed.",
    actionLabel: "Prepare Payment",
  },
  {
    key: "payment",
    title: "Payment and Receipt",
    description: "Record payment, receipt details, and closeout readiness.",
    actionLabel: "Review Closeout",
  },
  {
    key: "closeout",
    title: "Customer Closeout",
    description: "Finish post-work summary and confirm receipt follow-through.",
    actionLabel: "Complete Service",
  },
];

const DEFAULT_DRAFT: TechFlowDraft = {
  currentStage: "dispatch",
  complaintSummary: "",
  complaintDetails: "",
  addedServiceReason: "",
  mileage: "",
  vinConfirmed: false,
  cornerPhotoCount: 0,
  interiorPhotoCount: 0,
  vinPhotoCount: 0,
  inspectionType: "",
  inspectionSummary: "",
  quoteNotes: "",
  quoteApprovalStatus: "draft",
  customerSignatureName: "",
  postWorkSummary: "",
  receiptSent: false,
  receiptStored: false,
};

const getFlowDraftKey = (jobId: string) => `otg-tech-flow-draft:${jobId}`;

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

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

const formatJobLocation = (job: TechnicianJob) => {
  const parts = [
    job.service_location_name,
    job.service_address,
    [job.service_city, job.service_state].filter(Boolean).join(", ") || null,
    job.service_zip,
  ].filter((value) => value && String(value).trim());

  return parts.length ? parts.join(" · ") : "Location pending";
};

const formatAppointment = (job: TechnicianJob) => {
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

const getCustomerName = (job: TechnicianJob | null) =>
  job ? [job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") || "Customer" : "Customer";

const getVehicleLabel = (job: TechnicianJob | null) =>
  job ? [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle" : "Vehicle";

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

const parseNumberInput = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function TechnicianJobFlowPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessIssue, setAccessIssue] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [job, setJob] = useState<TechnicianJob | null>(null);
  const [services, setServices] = useState<JobServiceRow[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogRow[]>([]);
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [draft, setDraft] = useState<TechFlowDraft>(DEFAULT_DRAFT);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServiceDescription, setCustomServiceDescription] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const setFeedback = useCallback((tone: "info" | "success" | "error", text: string) => {
    setMessageTone(tone);
    setMessage(text);
  }, []);

  const persistDraft = useCallback((nextDraft: TechFlowDraft) => {
    setDraft(nextDraft);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(getFlowDraftKey(jobId), JSON.stringify(nextDraft));
    } catch (error) {
      console.error("Failed to persist technician flow draft:", error);
    }
  }, [jobId]);

  const updateDraft = useCallback((patch: Partial<TechFlowDraft>) => {
    persistDraft({ ...draft, ...patch });
  }, [draft, persistDraft]);

  const loadDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return DEFAULT_DRAFT;
    }

    try {
      const raw = window.localStorage.getItem(getFlowDraftKey(jobId));
      if (!raw) {
        return DEFAULT_DRAFT;
      }
      return { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<TechFlowDraft>) };
    } catch {
      return DEFAULT_DRAFT;
    }
  }, [jobId]);

  const loadJobData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { user, roles } = await getUserRoles();
      if (!user) {
        window.location.href = `/customer/login?next=/tech/jobs/${jobId}`;
        return;
      }
      if (!hasPortalAccess(roles, "tech")) {
        setAccessIssue("This account does not have technician access.");
        return;
      }

      setCurrentUserId(user.id);
      setDraft(loadDraft());

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select(`
          id,
          customer_id,
          vehicle_id,
          estimate_id,
          business_job_number,
          service_type,
          service_description,
          status,
          intake_state,
          notes,
          assigned_tech_user_id,
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
        `)
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) {
        throw jobError;
      }

      if (!jobData) {
        setAccessIssue("That technician job could not be found.");
        return;
      }

      const normalizedJob = {
        ...(jobData as unknown as TechnicianJob),
        customer: getSingleRelation(
          jobData.customer as unknown as NonNullable<TechnicianJob["customer"]>[],
        ),
        vehicle: getSingleRelation(
          jobData.vehicle as unknown as NonNullable<TechnicianJob["vehicle"]>[],
        ),
      };
      setJob(normalizedJob);

      const [
        { data: serviceRows, error: serviceError },
        { data: catalogRows, error: catalogError },
        estimateResponse,
        paymentResponse,
      ] = await Promise.all([
        supabase
          .from("job_services")
          .select(
            "id, service_code, service_name, service_description, estimated_hours, estimated_price, sort_order, notes, completed_at, completed_by_user_id",
          )
          .eq("job_id", jobId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("service_catalog")
          .select("id, service_code, service_name, service_description, default_duration_minutes, default_price, is_active, category")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        normalizedJob.estimate_id
          ? supabase
              .from("estimates")
              .select("id, estimate_status, estimate_number, subtotal, tax_total, total_amount, approved_at, declined_at, notes")
              .eq("id", normalizedJob.estimate_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("job_payments")
          .select("id, payment_method, payment_status, amount, reference_number, notes, paid_at")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (serviceError) {
        throw serviceError;
      }
      if (catalogError) {
        throw catalogError;
      }
      if (estimateResponse.error) {
        throw estimateResponse.error;
      }
      if (paymentResponse.error) {
        throw paymentResponse.error;
      }

      setServices((serviceRows ?? []) as JobServiceRow[]);
      setServiceCatalog((catalogRows ?? []) as ServiceCatalogRow[]);
      setEstimate((estimateResponse.data as EstimateRow | null) ?? null);
      setPayment((paymentResponse.data as PaymentRow | null) ?? null);
      setPaymentMethod(paymentResponse.data?.payment_method ?? "card");
      setPaymentStatus(paymentResponse.data?.payment_status ?? "pending");
      setPaymentAmount(
        typeof paymentResponse.data?.amount === "number"
          ? String(paymentResponse.data.amount.toFixed(2))
          : "",
      );
      setPaymentReference(paymentResponse.data?.reference_number ?? "");
      setPaymentNotes(paymentResponse.data?.notes ?? "");
    } catch (error) {
      setAccessIssue(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId, loadDraft]);

  useEffect(() => {
    void loadJobData();
  }, [loadJobData]);

  const serviceTotal = useMemo(
    () => services.reduce((sum, service) => sum + (service.estimated_price ?? 0), 0),
    [services],
  );

  const completedServiceCount = useMemo(
    () => services.filter((service) => Boolean(service.completed_at)).length,
    [services],
  );

  const stageIssues = useMemo<Record<StageKey, string[]>>(() => {
    const issues: Record<StageKey, string[]> = {
      dispatch: [],
      arrival: [],
      complaint: [],
      preinspection: [],
      inspection: [],
      quote: [],
      work: [],
      payment: [],
      closeout: [],
    };

    if (!job?.service_location_name && !job?.service_address) {
      issues.dispatch.push("Add or confirm a service location.");
    }
    if (!job?.customer?.phone) {
      issues.dispatch.push("Customer phone is still missing.");
    }

    if (job?.intake_state !== "on_site" && job?.intake_state !== "in_service" && job?.intake_state !== "awaiting_customer_approval" && job?.intake_state !== "waiting_parts" && job?.intake_state !== "completed") {
      issues.arrival.push("Mark the job on site before moving forward.");
    }

    if (!draft.complaintSummary.trim()) {
      issues.complaint.push("Capture the customer complaint summary.");
    }
    if (services.length === 0) {
      issues.complaint.push("Add at least one requested or approved service.");
    }

    if (!draft.mileage.trim()) {
      issues.preinspection.push("Enter current mileage.");
    }
    if (draft.cornerPhotoCount < 4) {
      issues.preinspection.push("Add all 4 corner photos before continuing.");
    }
    if (draft.interiorPhotoCount < 2) {
      issues.preinspection.push("Add at least 2 interior photos before continuing.");
    }
    if (draft.vinPhotoCount < 1) {
      issues.preinspection.push("Add a VIN photo before continuing.");
    }
    if (!draft.vinConfirmed && !job?.vehicle?.vin) {
      issues.preinspection.push("Confirm VIN before finishing pre-inspection.");
    }

    if (!draft.inspectionType) {
      issues.inspection.push("Choose mini or full inspection.");
    }
    if (!draft.inspectionSummary.trim()) {
      issues.inspection.push("Summarize the inspection findings.");
    }

    if (services.length === 0) {
      issues.quote.push("No service lines are available for quoting.");
    }
    if (draft.quoteApprovalStatus === "signed" && !draft.customerSignatureName.trim()) {
      issues.quote.push("Enter the customer signature name for signed approval.");
    }

    if (services.length > 0 && completedServiceCount < services.length) {
      issues.work.push("Check off all approved service lines before closeout.");
    }

    if (!paymentAmount.trim()) {
      issues.payment.push("Record the final payment amount.");
    }
    if (paymentStatus !== "paid") {
      issues.payment.push("Payment should be marked paid before final closeout.");
    }

    if (!draft.postWorkSummary.trim()) {
      issues.closeout.push("Add the post-work summary.");
    }
    if (!draft.receiptSent) {
      issues.closeout.push("Confirm the receipt was sent to the customer.");
    }
    if (!draft.receiptStored) {
      issues.closeout.push("Confirm the receipt is stored in portal history.");
    }

    return issues;
  }, [completedServiceCount, draft, job, paymentAmount, paymentStatus, services.length]);

  const currentStageIndex = useMemo(
    () => STAGES.findIndex((stage) => stage.key === draft.currentStage),
    [draft.currentStage],
  );

  const activeStage = STAGES[currentStageIndex] ?? STAGES[0];

  const advanceStage = useCallback(async () => {
    const activeIssues = stageIssues[activeStage.key];
    if (activeIssues.length > 0) {
      setFeedback("error", activeIssues[0]);
      return;
    }

    setActionBusy(`advance-${activeStage.key}`);
    try {
      if (activeStage.key === "dispatch") {
        await supabase.rpc("update_job_intake_state", {
          p_job_id: jobId,
          p_intake_state: "on_site",
          p_status: "in_progress",
        });
      }

      if (activeStage.key === "quote") {
        const targetState =
          draft.quoteApprovalStatus === "pending" ? "awaiting_customer_approval" : "in_service";
        await supabase.rpc("update_job_intake_state", {
          p_job_id: jobId,
          p_intake_state: targetState,
          p_status: "in_progress",
        });
      }

      if (activeStage.key === "work") {
        await supabase
          .from("jobs")
          .update({ service_checklist_completed_at: new Date().toISOString() })
          .eq("id", jobId);
      }

      if (activeStage.key === "closeout") {
        await supabase.rpc("update_job_intake_state", {
          p_job_id: jobId,
          p_intake_state: "completed",
          p_status: "completed",
        });
      }

      const nextStage = STAGES[currentStageIndex + 1];
      if (nextStage) {
        persistDraft({ ...draft, currentStage: nextStage.key });
        setFeedback("success", `${activeStage.title} completed. ${nextStage.title} is ready.`);
      } else {
        setFeedback("success", "Service marked complete.");
      }

      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [activeStage, currentStageIndex, draft, jobId, loadJobData, persistDraft, setFeedback, stageIssues]);

  const goToStage = useCallback((stageKey: StageKey) => {
    updateDraft({ currentStage: stageKey });
  }, [updateDraft]);

  const handleAddCatalogService = useCallback(async () => {
    if (!selectedCatalogServiceId) {
      setFeedback("error", "Choose a service to add.");
      return;
    }

    const selected = serviceCatalog.find((item) => item.id === selectedCatalogServiceId);
    if (!selected) {
      setFeedback("error", "That service could not be found.");
      return;
    }

    setActionBusy("add-catalog-service");
    try {
      const maxSort = services.reduce((max, service) => Math.max(max, service.sort_order ?? 0), 0);
      const { error } = await supabase.from("job_services").insert({
        job_id: jobId,
        service_code: selected.service_code,
        service_name: selected.service_name,
        service_description: selected.service_description,
        estimated_hours:
          typeof selected.default_duration_minutes === "number"
            ? Number((selected.default_duration_minutes / 60).toFixed(2))
            : null,
        estimated_price: selected.default_price,
        sort_order: maxSort + 1,
        notes: draft.addedServiceReason.trim() || null,
      });

      if (error) {
        throw error;
      }

      setSelectedCatalogServiceId("");
      updateDraft({ addedServiceReason: "" });
      setFeedback("success", `${selected.service_name} added to this job.`);
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [draft.addedServiceReason, jobId, loadJobData, selectedCatalogServiceId, serviceCatalog, services, setFeedback, updateDraft]);

  const handleAddCustomService = useCallback(async () => {
    if (!customServiceName.trim()) {
      setFeedback("error", "Enter a custom service name.");
      return;
    }

    setActionBusy("add-custom-service");
    try {
      const maxSort = services.reduce((max, service) => Math.max(max, service.sort_order ?? 0), 0);
      const { error } = await supabase.from("job_services").insert({
        job_id: jobId,
        service_name: customServiceName.trim(),
        service_description: customServiceDescription.trim() || null,
        estimated_price: parseNumberInput(customServicePrice),
        sort_order: maxSort + 1,
        notes: draft.addedServiceReason.trim() || null,
      });

      if (error) {
        throw error;
      }

      setCustomServiceName("");
      setCustomServiceDescription("");
      setCustomServicePrice("");
      updateDraft({ addedServiceReason: "" });
      setFeedback("success", "Custom service line added.");
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [customServiceDescription, customServiceName, customServicePrice, draft.addedServiceReason, jobId, loadJobData, services, setFeedback, updateDraft]);

  const handleDeleteService = useCallback(async (serviceId: string) => {
    setActionBusy(`delete-${serviceId}`);
    try {
      const { error } = await supabase.from("job_services").delete().eq("id", serviceId);
      if (error) {
        throw error;
      }
      setFeedback("success", "Service line removed from the quote.");
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [loadJobData, setFeedback]);

  const handleToggleServiceComplete = useCallback(async (service: JobServiceRow) => {
    setActionBusy(`complete-${service.id}`);
    try {
      const payload = service.completed_at
        ? { completed_at: null, completed_by_user_id: null }
        : { completed_at: new Date().toISOString(), completed_by_user_id: currentUserId };
      const { error } = await supabase.from("job_services").update(payload).eq("id", service.id);
      if (error) {
        throw error;
      }
      setFeedback(
        "success",
        service.completed_at
          ? `${service.service_name} reopened for more work.`
          : `${service.service_name} marked complete.`,
      );
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [currentUserId, loadJobData, setFeedback]);

  const handleSavePayment = useCallback(async () => {
    if (!paymentAmount.trim()) {
      setFeedback("error", "Enter the payment amount.");
      return;
    }

    const parsedAmount = parseNumberInput(paymentAmount);
    if (parsedAmount == null) {
      setFeedback("error", "Payment amount must be a valid number.");
      return;
    }

    setActionBusy("save-payment");
    try {
      if (payment?.id) {
        const { error } = await supabase
          .from("job_payments")
          .update({
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            amount: parsedAmount,
            reference_number: paymentReference.trim() || null,
            notes: paymentNotes.trim() || null,
            paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
          })
          .eq("id", payment.id);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("job_payments").insert({
          job_id: jobId,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          amount: parsedAmount,
          reference_number: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        });
        if (error) {
          throw error;
        }
      }

      setFeedback("success", "Payment record saved.");
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [jobId, loadJobData, payment, paymentAmount, paymentMethod, paymentNotes, paymentReference, paymentStatus, setFeedback]);

  const renderActiveStage = () => {
    switch (activeStage.key) {
      case "dispatch":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryInfoCard icon={Phone} label="Customer" value={`${getCustomerName(job)}${job?.customer?.phone ? ` · ${job.customer.phone}` : ""}`} />
              <SummaryInfoCard icon={Car} label="Vehicle" value={`${getVehicleLabel(job)}${job?.vehicle?.license_plate ? ` · Plate ${job.vehicle.license_plate}` : ""}`} />
              <SummaryInfoCard icon={MapPin} label="Location" value={job ? formatJobLocation(job) : "Location pending"} />
              <SummaryInfoCard icon={CalendarClock} label="Appointment" value={job ? formatAppointment(job) : "Scheduling pending"} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Requested work</div>
              <div className="mt-2">{job?.service_description || job?.service_type || "No requested work listed yet."}</div>
              {job?.notes ? (
                <div className="mt-3 border-t border-slate-200 pt-3 text-slate-600">
                  <span className="font-medium text-slate-800">Internal notes: </span>
                  {job.notes}
                </div>
              ) : null}
            </div>
          </div>
        );
      case "arrival":
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">On-site status</div>
                  <div className="text-sm text-slate-600">Once you arrive, the rest of the visit flows from here.</div>
                </div>
                <Badge className={cn("rounded-full border", getIntakeTone(job?.intake_state ?? null))}>
                  {(job?.intake_state || "queued").replaceAll("_", " ")}
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryInfoCard icon={Phone} label="Customer phone" value={job?.customer?.phone || "Phone missing"} />
              <SummaryInfoCard icon={ShieldCheck} label="VIN on file" value={job?.vehicle?.vin || "VIN not on file"} />
            </div>
          </div>
        );
      case "complaint":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="complaint-summary">Customer complaint summary</Label>
              <Textarea
                id="complaint-summary"
                value={draft.complaintSummary}
                onChange={(event) => updateDraft({ complaintSummary: event.target.value })}
                placeholder="Capture the issue in the customer's own words."
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-details">Technician intake notes</Label>
              <Textarea
                id="complaint-details"
                value={draft.complaintDetails}
                onChange={(event) => updateDraft({ complaintDetails: event.target.value })}
                placeholder="Add any extra context the technician needs before inspection."
                className="min-h-20"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl border border-slate-200 bg-slate-50 shadow-none">
                <CardHeader>
                  <CardTitle>Planned services</CardTitle>
                  <CardDescription>These lines will become the working quote and completion checklist.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {services.length ? (
                    services.map((service) => (
                      <div key={service.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900">{service.service_name}</div>
                            <div className="text-sm text-slate-600">{service.service_description || "No description added."}</div>
                            <div className="text-xs text-slate-500">
                              Est. {formatCurrency(service.estimated_price)}{service.estimated_hours ? ` · ${service.estimated_hours} hr` : ""}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            type="button"
                            disabled={actionBusy === `delete-${service.id}`}
                            onClick={() => void handleDeleteService(service.id)}
                          >
                            {actionBusy === `delete-${service.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                      No service lines are attached yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="rounded-2xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>Add catalog service</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Select service</Label>
                      <Select value={selectedCatalogServiceId} onValueChange={setSelectedCatalogServiceId}>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Choose from service catalog" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceCatalog.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.service_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="added-reason">Reason for added service</Label>
                      <Textarea
                        id="added-reason"
                        value={draft.addedServiceReason}
                        onChange={(event) => updateDraft({ addedServiceReason: event.target.value })}
                        placeholder="Why is this service being added on site?"
                      />
                    </div>
                    <Button type="button" className="min-h-11 w-full" disabled={actionBusy === "add-catalog-service"} onClick={() => void handleAddCatalogService()}>
                      {actionBusy === "add-catalog-service" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add catalog service
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>Add custom service</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="custom-service-name">Service name</Label>
                      <Input id="custom-service-name" value={customServiceName} onChange={(event) => setCustomServiceName(event.target.value)} placeholder="Example: Cabin air filter replacement" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-service-description">Description</Label>
                      <Textarea id="custom-service-description" value={customServiceDescription} onChange={(event) => setCustomServiceDescription(event.target.value)} placeholder="Add parts, labor, or diagnostic context." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-service-price">Estimated price</Label>
                      <Input id="custom-service-price" inputMode="decimal" value={customServicePrice} onChange={(event) => setCustomServicePrice(event.target.value)} placeholder="0.00" />
                    </div>
                    <Button type="button" className="min-h-11 w-full" disabled={actionBusy === "add-custom-service"} onClick={() => void handleAddCustomService()}>
                      {actionBusy === "add-custom-service" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add custom service
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );
      case "preinspection":
        return (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mileage">Current mileage</Label>
                <Input id="mileage" inputMode="numeric" value={draft.mileage} onChange={(event) => updateDraft({ mileage: event.target.value })} placeholder="Enter odometer reading" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vin-confirmed">VIN confirmation</Label>
                <Button
                  type="button"
                  variant={draft.vinConfirmed || Boolean(job?.vehicle?.vin) ? "default" : "outline"}
                  className="min-h-11 w-full justify-start"
                  onClick={() => updateDraft({ vinConfirmed: !draft.vinConfirmed })}
                >
                  {draft.vinConfirmed || job?.vehicle?.vin ? "VIN confirmed for this vehicle" : "Tap to confirm VIN on site"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <PhotoCountField
                label="Corner photos"
                help="Need 4 total"
                value={draft.cornerPhotoCount}
                onChange={(value) => updateDraft({ cornerPhotoCount: value })}
              />
              <PhotoCountField
                label="Interior photos"
                help="Need 2 minimum"
                value={draft.interiorPhotoCount}
                onChange={(value) => updateDraft({ interiorPhotoCount: value })}
              />
              <PhotoCountField
                label="VIN photos"
                help="Need 1"
                value={draft.vinPhotoCount}
                onChange={(value) => updateDraft({ vinPhotoCount: value })}
              />
            </div>

            <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
              Use the fallback inspection workspace when you need the current live photo capture flow.
              <div className="mt-3">
                <Button asChild variant="outline" className="min-h-11 border-lime-300 bg-white">
                  <Link href={`/tech/jobs/${jobId}/inspection`}>Open legacy photo / inspection workspace</Link>
                </Button>
              </div>
            </div>
          </div>
        );
      case "inspection":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant={draft.inspectionType === "mini" ? "default" : "outline"}
                className="min-h-12 justify-start"
                onClick={() => updateDraft({ inspectionType: "mini" })}
              >
                Mini inspection
              </Button>
              <Button
                type="button"
                variant={draft.inspectionType === "full" ? "default" : "outline"}
                className="min-h-12 justify-start"
                onClick={() => updateDraft({ inspectionType: "full" })}
              >
                Full paid inspection
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {draft.inspectionType === "mini"
                ? "Mini inspection keeps the visit lighter, brings tire information back in, and avoids deeper steering detail."
                : draft.inspectionType === "full"
                  ? "Full inspection is the deeper billable inspection with expanded findings and recommendations."
                  : "Pick the inspection type so the tech knows how deep to go."}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspection-summary">Inspection findings summary</Label>
              <Textarea
                id="inspection-summary"
                value={draft.inspectionSummary}
                onChange={(event) => updateDraft({ inspectionSummary: event.target.value })}
                placeholder="Summarize the major findings, tire/brake observations, and what should make it into the quote."
                className="min-h-28"
              />
            </div>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/tech/jobs/${jobId}/inspection`}>Open legacy inspection details</Link>
            </Button>
          </div>
        );
      case "quote":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryInfoCard icon={Wrench} label="Service lines" value={`${services.length}`} />
              <SummaryInfoCard icon={Receipt} label="Working total" value={formatCurrency(serviceTotal)} />
              <SummaryInfoCard icon={FileSignature} label="Estimate" value={estimate?.estimate_number || estimate?.estimate_status || "Not created"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-notes">Quote notes</Label>
              <Textarea
                id="quote-notes"
                value={draft.quoteNotes}
                onChange={(event) => updateDraft({ quoteNotes: event.target.value })}
                placeholder="Explain recommended services, what the quote covers, and what the customer needs to approve."
                className="min-h-24"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { value: "draft", label: "Draft" },
                { value: "pending", label: "Awaiting approval" },
                { value: "approved", label: "Approved" },
                { value: "signed", label: "Approved + signed" },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={draft.quoteApprovalStatus === option.value ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => updateDraft({ quoteApprovalStatus: option.value as TechFlowDraft["quoteApprovalStatus"] })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {draft.quoteApprovalStatus === "signed" ? (
              <div className="space-y-2">
                <Label htmlFor="signature-name">Customer signature name</Label>
                <Input id="signature-name" value={draft.customerSignatureName} onChange={(event) => updateDraft({ customerSignatureName: event.target.value })} placeholder="Enter the approving customer name" />
              </div>
            ) : null}
          </div>
        );
      case "work":
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Approved and in-scope services should be checked off as the technician finishes them.
            </div>
            <div className="space-y-3">
              {services.length ? (
                services.map((service) => (
                  <div key={service.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">{service.service_name}</div>
                      <div className="text-sm text-slate-600">{service.service_description || "No description added."}</div>
                      <div className="text-xs text-slate-500">{formatCurrency(service.estimated_price)}</div>
                    </div>
                    <Button
                      type="button"
                      variant={service.completed_at ? "default" : "outline"}
                      className="min-h-11 sm:min-w-40"
                      disabled={actionBusy === `complete-${service.id}`}
                      onClick={() => void handleToggleServiceComplete(service)}
                    >
                      {actionBusy === `complete-${service.id}` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : service.completed_at ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : null}
                      {service.completed_at ? "Completed" : "Mark complete"}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No service lines are available yet.
                </div>
              )}
            </div>
          </div>
        );
      case "payment":
        return (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="invoice">Invoice / bill later</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Payment amount</Label>
                <Input id="payment-amount" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={serviceTotal ? String(serviceTotal.toFixed(2)) : "0.00"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference number</Label>
                <Input id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Swipe ref, invoice, or check number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Payment notes</Label>
              <Textarea id="payment-notes" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Anything the customer should see later with the receipt." />
            </div>
            <Button type="button" className="min-h-11" disabled={actionBusy === "save-payment"} onClick={() => void handleSavePayment()}>
              {actionBusy === "save-payment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Save payment record
            </Button>
          </div>
        );
      case "closeout":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="post-work-summary">Post-work summary</Label>
              <Textarea
                id="post-work-summary"
                value={draft.postWorkSummary}
                onChange={(event) => updateDraft({ postWorkSummary: event.target.value })}
                placeholder="Summarize completed work, final notes, and what the customer should know."
                className="min-h-28"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant={draft.receiptSent ? "default" : "outline"}
                className="min-h-11"
                onClick={() => updateDraft({ receiptSent: !draft.receiptSent })}
              >
                {draft.receiptSent ? "Receipt marked sent" : "Mark receipt sent"}
              </Button>
              <Button
                type="button"
                variant={draft.receiptStored ? "default" : "outline"}
                className="min-h-11"
                onClick={() => updateDraft({ receiptStored: !draft.receiptStored })}
              >
                {draft.receiptStored ? "Portal history confirmed" : "Mark receipt stored"}
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Final closeout is ready once the work summary is done and the receipt has been both sent and stored for the customer portal history.
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-sm text-slate-600">Loading technician job flow…</p>
        </div>
      </div>
    );
  }

  if (accessIssue || !job) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <p className="text-base font-semibold text-slate-900">Technician job unavailable</p>
          <p className="mt-2 text-sm text-slate-700">{accessIssue || "That technician job could not be loaded."}</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/tech/jobs")}>
            Back to queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => router.push("/tech/jobs")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to queue
                  </Button>
                  <Badge className={cn("rounded-full border", getIntakeTone(job.intake_state))}>
                    {(job.intake_state || job.status || "queued").replaceAll("_", " ")}
                  </Badge>
                  {refreshing ? <Badge variant="outline" className="rounded-full">Refreshing…</Badge> : null}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    Job #{job.business_job_number || job.id.slice(0, 8)}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {getCustomerName(job)} · {getVehicleLabel(job)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {job.service_description || job.service_type || "Requested work pending"}
                  </p>
                </div>
              </div>
              <div className="w-full max-w-2xl">
                <div className="flex justify-end">
                  <PortalTopNav section="tech" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryInfoCard icon={Phone} label="Customer" value={`${getCustomerName(job)}${job.customer?.phone ? ` · ${job.customer.phone}` : ""}`} />
              <SummaryInfoCard icon={Car} label="Vehicle" value={`${getVehicleLabel(job)}${job.vehicle?.license_plate ? ` · Plate ${job.vehicle.license_plate}` : ""}`} />
              <SummaryInfoCard icon={MapPin} label="Location" value={formatJobLocation(job)} />
              <SummaryInfoCard icon={CalendarClock} label="Appointment" value={formatAppointment(job)} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={`/tech/jobs/${jobId}/inspection`}>Legacy inspection workspace</Link>
              </Button>
              <Button variant="outline" onClick={() => void loadJobData(true)}>
                Refresh job data
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Visit stages</h2>
                <p className="text-sm text-slate-600">Move through the job the same way the service visit actually happens.</p>
              </div>
              <div className="space-y-3">
                {STAGES.map((stage, index) => {
                  const issues = stageIssues[stage.key];
                  const isActive = draft.currentStage === stage.key;
                  const isComplete = index < currentStageIndex && issues.length === 0;

                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => goToStage(stage.key)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-md"
                          : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                            Stage {index + 1}
                          </div>
                          <div className="mt-1 font-semibold">{stage.title}</div>
                          <div className={cn("mt-1 text-sm", isActive ? "text-white/80" : "text-slate-600")}>
                            {stage.description}
                          </div>
                        </div>
                        {isComplete ? (
                          <Check className="mt-1 h-4 w-4 shrink-0" />
                        ) : issues.length > 0 ? (
                          <AlertCircle className={cn("mt-1 h-4 w-4 shrink-0", isActive ? "text-amber-200" : "text-amber-600")} />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {message ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  messageTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : messageTone === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                {message}
              </div>
            ) : null}

            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">{activeStage.title}</CardTitle>
                    <CardDescription className="mt-1">{activeStage.description}</CardDescription>
                  </div>
                  <Badge className="rounded-full bg-slate-100 text-slate-900">
                    {currentStageIndex + 1} / {STAGES.length}
                  </Badge>
                </div>
                {stageIssues[activeStage.key].length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-semibold">Before continuing:</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {stageIssues[activeStage.key].map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-6">
                {renderActiveStage()}
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={currentStageIndex === 0}
                    onClick={() => goToStage(STAGES[Math.max(0, currentStageIndex - 1)].key)}
                  >
                    Previous stage
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={actionBusy === `advance-${activeStage.key}`}
                    onClick={() => void advanceStage()}
                  >
                    {actionBusy === `advance-${activeStage.key}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    {activeStage.actionLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <SummaryInfoCard icon={ClipboardCheck} label="Completed services" value={`${completedServiceCount} / ${services.length || 0}`} />
                <SummaryInfoCard icon={Receipt} label="Quote total" value={formatCurrency(serviceTotal)} />
                <SummaryInfoCard icon={CreditCard} label="Latest payment" value={payment ? `${formatCurrency(payment.amount)} · ${payment.payment_status}` : "No payment recorded"} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryInfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
        <Icon className="h-4 w-4 text-lime-600" />
        {label}
      </div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}

function PhotoCountField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{help}</div>
      </div>
      <Input
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="h-11 bg-white"
      />
    </div>
  );
}
