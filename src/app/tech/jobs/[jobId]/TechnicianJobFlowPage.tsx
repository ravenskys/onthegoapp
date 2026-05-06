"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Car,
  Camera,
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
  Upload,
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

type StagedPhoto = {
  shotKey: string;
  label: string;
  note: string;
  preview: string;
  fileName: string;
  fileUrl: string | null;
  photoRowId: string | null;
};

type RequiredItemPhoto = {
  id: string;
  label: string;
  note: string;
  preview: string;
  fileName: string;
  fileUrl: string | null;
  photoRowId: string | null;
};

type ConditionValue = "" | "ok" | "sug" | "req";

type TireInspectionEntry = {
  psiIn: string;
  psiOut: string;
  treadOuter: string;
  treadInner: string;
  status: ConditionValue;
  recommendation: string;
};

type BrakeInspectionState = {
  lfPad: string;
  rfPad: string;
  lrPad: string;
  rrPad: string;
  lfRotor: string;
  rfRotor: string;
  lrRotor: string;
  rrRotor: string;
  brakeNotes: string;
  status: ConditionValue;
};

type ChecklistItemState = {
  status: ConditionValue;
  why: string;
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

type FlowSectionKey =
  | "dispatch-location"
  | "dispatch-customer"
  | "arrival-status"
  | "complaint-summary"
  | "complaint-services"
  | "preinspection-mileage"
  | "preinspection-vin"
  | "preinspection-photos"
  | "inspection-type-summary"
  | "quote-services"
  | "quote-discount"
  | "quote-signature"
  | "work-services"
  | "payment-details"
  | "closeout-summary"
  | "closeout-receipt";

type TechFlowDraft = {
  currentStage: StageKey;
  inspectionId: string | null;
  complaintSummary: string;
  complaintDetails: string;
  addedServiceReason: string;
  mileage: string;
  vinConfirmed: boolean;
  preInspectionPhotos: Partial<Record<string, Partial<StagedPhoto>>>;
  inspectionType: "" | "mini" | "full";
  inspectionSummary: string;
  tireData: Record<string, TireInspectionEntry>;
  brakes: BrakeInspectionState;
  maintenance: Record<string, ChecklistItemState>;
  undercar: Record<string, ChecklistItemState>;
  quoteNotes: string;
  quoteDiscountAmount: string;
  quoteDiscountReason: string;
  quoteDiscountOtherReason: string;
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

const getFlowDraftKey = (jobId: string) => `otg-tech-flow-draft:${jobId}`;

const PRE_INSPECTION_PHOTO_SLOTS = [
  { key: "front-left-corner", label: "Front Left Corner", category: "corner" },
  { key: "front-right-corner", label: "Front Right Corner", category: "corner" },
  { key: "rear-right-corner", label: "Rear Right Corner", category: "corner" },
  { key: "rear-left-corner", label: "Rear Left Corner", category: "corner" },
  { key: "interior-driver", label: "Interior 1", category: "interior" },
  { key: "interior-passenger", label: "Interior 2", category: "interior" },
  { key: "vin-tag", label: "VIN Photo", category: "vin" },
] as const;

const PRE_INSPECTION_INTERIOR_SLOT_KEYS = ["interior-driver", "interior-passenger"] as const;

const TIRE_POSITIONS = [
  "Left Front",
  "Right Front",
  "Right Rear",
  "Left Rear",
  "Spare",
] as const;

const MINI_MAINTENANCE_ITEMS = [
  "Wiper Blades",
  "Head Lights",
  "Accessory Lights",
  "Left Turn Signal",
  "Right Turn Signal",
  "Brake Lights",
  "Filters",
  "Oil Level",
  "Leaks",
  "Washer Fluid",
  "Brake Fluid Flush",
  "Coolant Level / Flush",
  "Battery Test",
  "A/C",
  "Belts",
] as const;

const FULL_MAINTENANCE_ITEMS = [
  "Wiper Blades",
  "Head Lights",
  "Accessory Lights",
  "Left Turn Signal",
  "Right Turn Signal",
  "Brake Lights",
  "Filters",
  "Oil Level",
  "Battery Terminal Protection",
  "Belt Tensioner",
  "Ignition Wires",
  "Leaks",
  "Lift Supports",
  "Washer Fluid",
  "Brake Fluid Flush",
  "Coolant Hoses",
  "Cabin Filter",
  "Power Steering Fluid Level",
  "Transmission Service",
  "Coolant Level / Flush",
  "Battery Test",
  "Fuel System Service",
  "Master Cylinder Fluid Level",
  "A/C",
  "Belts",
] as const;

const MINI_UNDERCAR_ITEMS = [
  "Struts / Shocks",
  "CV Boots",
  "Tie Rod Ends",
  "Exhaust System",
] as const;

const FULL_UNDERCAR_ITEMS = [
  "U-Joint",
  "Struts / Shocks",
  "Strut Mounts",
  "Rack & Pinion Assembly",
  "CV Boots",
  "Tie Rod Ends",
  "Exhaust System",
  "Muffler",
] as const;

const QUOTE_DISCOUNT_REASONS = [
  { value: "customer-retention", label: "Customer retention" },
  { value: "bundle-pricing", label: "Bundle pricing" },
  { value: "labor-adjustment", label: "Labor adjustment" },
  { value: "diagnostic-credit", label: "Diagnostic credit" },
  { value: "manager-approval", label: "Manager approval" },
  { value: "other", label: "Other" },
] as const;

const DEFAULT_DRAFT: TechFlowDraft = {
  currentStage: "dispatch",
  inspectionId: null,
  complaintSummary: "",
  complaintDetails: "",
  addedServiceReason: "",
  mileage: "",
  vinConfirmed: false,
  preInspectionPhotos: {},
  inspectionType: "",
  inspectionSummary: "",
  tireData: createEmptyTireData(),
  brakes: createEmptyBrakeState(),
  maintenance: createChecklistState(FULL_MAINTENANCE_ITEMS),
  undercar: createChecklistState(FULL_UNDERCAR_ITEMS),
  quoteNotes: "",
  quoteDiscountAmount: "",
  quoteDiscountReason: "",
  quoteDiscountOtherReason: "",
  quoteApprovalStatus: "draft",
  customerSignatureName: "",
  postWorkSummary: "",
  receiptSent: false,
  receiptStored: false,
};

const createEmptyPreInspectionPhotos = (): Record<string, StagedPhoto> =>
  Object.fromEntries(
    PRE_INSPECTION_PHOTO_SLOTS.map((slot) => [
      slot.key,
      {
        shotKey: slot.key,
        label: slot.label,
        note: "",
        preview: "",
        fileName: "",
        fileUrl: null,
        photoRowId: null,
      },
    ]),
  );

function createEmptyTireData(): Record<string, TireInspectionEntry> {
  return Object.fromEntries(
    TIRE_POSITIONS.map((position) => [
      position,
      {
        psiIn: "",
        psiOut: "",
        treadOuter: "",
        treadInner: "",
        status: "",
        recommendation: "",
      },
    ]),
  );
}

function createEmptyBrakeState(): BrakeInspectionState {
  return {
    lfPad: "",
    rfPad: "",
    lrPad: "",
    rrPad: "",
    lfRotor: "",
    rfRotor: "",
    lrRotor: "",
    rrRotor: "",
    brakeNotes: "",
    status: "",
  };
}

function createChecklistState(items: readonly string[]): Record<string, ChecklistItemState> {
  return Object.fromEntries(items.map((item) => [item, { status: "", why: "" }]));
}

const mergeTireData = (
  incoming: Partial<Record<string, Partial<TireInspectionEntry>>> | null | undefined,
) => {
  const base = createEmptyTireData();
  if (!incoming) return base;

  for (const position of TIRE_POSITIONS) {
    const next = incoming[position];
    if (!next) continue;
    base[position] = {
      ...base[position],
      ...next,
      psiIn: String(next.psiIn ?? base[position].psiIn),
      psiOut: String(next.psiOut ?? base[position].psiOut),
      treadOuter: String(next.treadOuter ?? base[position].treadOuter),
      treadInner: String(next.treadInner ?? base[position].treadInner),
      status: (next.status as ConditionValue | undefined) ?? base[position].status,
      recommendation: String(next.recommendation ?? base[position].recommendation),
    };
  }

  return base;
};

const mergeBrakeState = (incoming: Partial<BrakeInspectionState> | null | undefined): BrakeInspectionState => ({
  ...createEmptyBrakeState(),
  ...incoming,
  lfPad: String(incoming?.lfPad ?? ""),
  rfPad: String(incoming?.rfPad ?? ""),
  lrPad: String(incoming?.lrPad ?? ""),
  rrPad: String(incoming?.rrPad ?? ""),
  lfRotor: String(incoming?.lfRotor ?? ""),
  rfRotor: String(incoming?.rfRotor ?? ""),
  lrRotor: String(incoming?.lrRotor ?? ""),
  rrRotor: String(incoming?.rrRotor ?? ""),
  brakeNotes: String(incoming?.brakeNotes ?? ""),
  status: (incoming?.status as ConditionValue | undefined) ?? "",
});

const mergeChecklistState = (
  items: readonly string[],
  incoming: Partial<Record<string, Partial<ChecklistItemState>>> | null | undefined,
) => {
  const base = createChecklistState(items);
  if (!incoming) return base;

  for (const item of items) {
    const next = incoming[item];
    if (!next) continue;
    base[item] = {
      status: (next.status as ConditionValue | undefined) ?? "",
      why: String(next.why ?? ""),
    };
  }

  return base;
};

const normalizeDraft = (raw: Partial<TechFlowDraft> | null | undefined): TechFlowDraft => ({
  ...DEFAULT_DRAFT,
  ...(raw ?? {}),
  preInspectionPhotos: raw?.preInspectionPhotos ?? {},
  tireData: mergeTireData(raw?.tireData),
  brakes: mergeBrakeState(raw?.brakes),
  maintenance: mergeChecklistState(FULL_MAINTENANCE_ITEMS, raw?.maintenance),
  undercar: mergeChecklistState(FULL_UNDERCAR_ITEMS, raw?.undercar),
});

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const normalizePhotoSlotToken = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolvePreInspectionSlotKey = (
  shotLabel: string | null | undefined,
  fileUrl: string | null | undefined,
  currentPhotos: Record<string, StagedPhoto>,
) => {
  const labelToken = normalizePhotoSlotToken(shotLabel);
  const fileToken = normalizePhotoSlotToken(fileUrl);

  const exactSlot = PRE_INSPECTION_PHOTO_SLOTS.find(
    (slot) => normalizePhotoSlotToken(slot.label) === labelToken,
  );
  if (exactSlot) {
    return exactSlot.key;
  }

  if (
    labelToken === "interior" ||
    labelToken.startsWith("interior-") ||
    fileToken.includes("interior")
  ) {
    return (
      PRE_INSPECTION_INTERIOR_SLOT_KEYS.find((key) => !currentPhotos[key]?.preview) ??
      PRE_INSPECTION_INTERIOR_SLOT_KEYS[0]
    );
  }

  if (
    labelToken === "vin" ||
    labelToken === "vin-photo" ||
    labelToken === "vin-tag" ||
    fileToken.includes("vin")
  ) {
    return "vin-tag";
  }

  if (fileToken.includes("front-left-corner")) return "front-left-corner";
  if (fileToken.includes("front-right-corner")) return "front-right-corner";
  if (fileToken.includes("rear-right-corner")) return "rear-right-corner";
  if (fileToken.includes("rear-left-corner")) return "rear-left-corner";

  return null;
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

export default function TechnicianJobFlowPage({
  jobId,
  initialStage,
}: {
  jobId: string;
  initialStage?: StageKey;
}) {
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
  const [preInspectionPhotos, setPreInspectionPhotos] = useState<Record<string, StagedPhoto>>(
    createEmptyPreInspectionPhotos,
  );
  const [requiredItemPhotos, setRequiredItemPhotos] = useState<RequiredItemPhoto[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);
  const [showValidationHighlights, setShowValidationHighlights] = useState(false);
  const [showAllStagesMobile, setShowAllStagesMobile] = useState(false);
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

  const writeDraftToStorage = useCallback((nextDraft: TechFlowDraft) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(getFlowDraftKey(jobId), JSON.stringify(nextDraft));
    } catch (error) {
      console.error("Failed to persist technician flow draft:", error);
    }
  }, [jobId]);

  const hydratePreInspectionPhotos = useCallback((photos: Partial<Record<string, Partial<StagedPhoto>>> | null | undefined) => {
    const base = createEmptyPreInspectionPhotos();
    if (!photos) {
      return base;
    }

    for (const slot of PRE_INSPECTION_PHOTO_SLOTS) {
      const existing = photos[slot.key];
      if (!existing) continue;
      base[slot.key] = {
        ...base[slot.key],
        ...existing,
        shotKey: slot.key,
        label: slot.label,
        note: String(existing.note ?? ""),
        preview: String(existing.preview ?? ""),
        fileName: String(existing.fileName ?? ""),
        fileUrl: existing.fileUrl ? String(existing.fileUrl) : null,
        photoRowId: existing.photoRowId ? String(existing.photoRowId) : null,
      };
    }

    return base;
  }, []);

  const persistDraft = useCallback((nextDraft: TechFlowDraft) => {
    setDraft(nextDraft);
    writeDraftToStorage(nextDraft);
  }, [writeDraftToStorage]);

  const updateDraft = useCallback((patch: Partial<TechFlowDraft>) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, ...patch };
      writeDraftToStorage(nextDraft);
      return nextDraft;
    });
  }, [writeDraftToStorage]);

  const syncPreInspectionPhotos = useCallback(
    (nextPhotos: Record<string, StagedPhoto>, draftOverride?: TechFlowDraft) => {
      setPreInspectionPhotos(nextPhotos);
      const nextPhotoDraft = Object.fromEntries(
        Object.entries(nextPhotos).map(([key, photo]) => [
          key,
          {
            shotKey: photo.shotKey,
            label: photo.label,
            note: photo.note,
            preview: photo.preview,
            fileName: photo.fileName,
            fileUrl: photo.fileUrl,
            photoRowId: photo.photoRowId,
          },
        ]),
      );

      if (draftOverride) {
        const nextDraft = {
          ...draftOverride,
          preInspectionPhotos: nextPhotoDraft,
        };
        setDraft(nextDraft);
        writeDraftToStorage(nextDraft);
        return;
      }

      setDraft((prev) => {
        const nextDraft = {
          ...prev,
          preInspectionPhotos: nextPhotoDraft,
        };
        writeDraftToStorage(nextDraft);
        return nextDraft;
      });
    },
    [writeDraftToStorage],
  );

  const loadDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return DEFAULT_DRAFT;
    }

    try {
      const raw = window.localStorage.getItem(getFlowDraftKey(jobId));
      if (!raw) {
        return DEFAULT_DRAFT;
      }
      const normalized = normalizeDraft(JSON.parse(raw) as Partial<TechFlowDraft>);
      return initialStage ? { ...normalized, currentStage: initialStage } : normalized;
    } catch {
      return initialStage ? { ...DEFAULT_DRAFT, currentStage: initialStage } : DEFAULT_DRAFT;
    }
  }, [initialStage, jobId]);

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
      const draftFromStorage = loadDraft();
      setDraft(draftFromStorage);
      setPreInspectionPhotos(hydratePreInspectionPhotos(draftFromStorage.preInspectionPhotos));

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

      let resolvedDraft = draftFromStorage;

      if (draftFromStorage.inspectionId || normalizedJob.vehicle_id || normalizedJob.customer_id) {
        let inspectionQuery = supabase
          .from("inspections")
          .select("id, notes, tire_data, brakes, maintenance, undercar, inspection_summary")
          .order("created_at", { ascending: false })
          .limit(1);

        if (draftFromStorage.inspectionId) {
          inspectionQuery = inspectionQuery.eq("id", draftFromStorage.inspectionId);
        } else if (normalizedJob.vehicle_id) {
          inspectionQuery = inspectionQuery.eq("vehicle_id", normalizedJob.vehicle_id);
        } else if (normalizedJob.customer_id) {
          inspectionQuery = inspectionQuery.eq("customer_id", normalizedJob.customer_id);
        }

        const { data: inspectionRows, error: inspectionError } = await inspectionQuery;
        if (inspectionError) {
          throw inspectionError;
        }

        const inspectionRow = inspectionRows?.[0];
        if (inspectionRow) {
          const inspectionSummary =
            inspectionRow.inspection_summary && typeof inspectionRow.inspection_summary === "object"
              ? (inspectionRow.inspection_summary as Record<string, unknown>)
              : {};

          resolvedDraft = normalizeDraft({
            ...draftFromStorage,
            inspectionId: inspectionRow.id ?? draftFromStorage.inspectionId,
            inspectionType:
              inspectionSummary.inspection_type === "mini" || inspectionSummary.inspection_type === "full"
                ? (inspectionSummary.inspection_type as "mini" | "full")
                : draftFromStorage.inspectionType,
            inspectionSummary:
              typeof inspectionRow.notes === "string" && inspectionRow.notes.trim()
                ? inspectionRow.notes
                : draftFromStorage.inspectionSummary,
            quoteDiscountAmount:
              typeof inspectionSummary.quote_discount_amount === "number"
                ? String(inspectionSummary.quote_discount_amount)
                : typeof inspectionSummary.quote_discount_amount === "string"
                  ? inspectionSummary.quote_discount_amount
                  : draftFromStorage.quoteDiscountAmount,
            quoteDiscountReason:
              typeof inspectionSummary.quote_discount_reason === "string"
                ? inspectionSummary.quote_discount_reason
                : draftFromStorage.quoteDiscountReason,
            quoteDiscountOtherReason:
              typeof inspectionSummary.quote_discount_other_reason === "string"
                ? inspectionSummary.quote_discount_other_reason
                : draftFromStorage.quoteDiscountOtherReason,
            tireData: mergeTireData(
              inspectionRow.tire_data && typeof inspectionRow.tire_data === "object"
                ? (inspectionRow.tire_data as Partial<Record<string, Partial<TireInspectionEntry>>>)
                : draftFromStorage.tireData,
            ),
            brakes: mergeBrakeState(
              inspectionRow.brakes && typeof inspectionRow.brakes === "object"
                ? (inspectionRow.brakes as Partial<BrakeInspectionState>)
                : draftFromStorage.brakes,
            ),
            maintenance: mergeChecklistState(
              FULL_MAINTENANCE_ITEMS,
              inspectionRow.maintenance && typeof inspectionRow.maintenance === "object"
                ? (inspectionRow.maintenance as Partial<Record<string, Partial<ChecklistItemState>>>)
                : draftFromStorage.maintenance,
            ),
            undercar: mergeChecklistState(
              FULL_UNDERCAR_ITEMS,
              inspectionRow.undercar && typeof inspectionRow.undercar === "object"
                ? (inspectionRow.undercar as Partial<Record<string, Partial<ChecklistItemState>>>)
                : draftFromStorage.undercar,
            ),
          });
          setDraft(resolvedDraft);
          writeDraftToStorage(resolvedDraft);
        }
      }

      if (resolvedDraft.inspectionId) {
        const { data: photoRows, error: photoError } = await supabase
          .from("inspection_photos")
          .select("id, photo_stage, shot_label, file_name, file_url, note")
          .eq("inspection_id", resolvedDraft.inspectionId);

        if (photoError) {
          throw photoError;
        }

        const nextPhotos = hydratePreInspectionPhotos(resolvedDraft.preInspectionPhotos);
        const nextRequiredItemPhotos: RequiredItemPhoto[] = [];

        await Promise.all(
          (photoRows ?? []).map(async (row) => {
            if (row.photo_stage === "inspection_required") {
              if (!row.file_url) {
                return;
              }

              const { data: signedUrlData } = await supabase.storage
                .from("inspection-photos")
                .createSignedUrl(row.file_url, 60 * 60);

              nextRequiredItemPhotos.push({
                id: row.id,
                label: row.shot_label ?? "Required finding photo",
                note: row.note ?? "",
                preview: signedUrlData?.signedUrl ?? "",
                fileName: row.file_name ?? "",
                fileUrl: row.file_url ?? null,
                photoRowId: row.id,
              });
              return;
            }

            if (row.photo_stage !== "pre_service") {
              return;
            }

            const matchingSlotKey = resolvePreInspectionSlotKey(
              row.shot_label,
              row.file_url,
              nextPhotos,
            );
            if (!matchingSlotKey || !row.file_url) {
              return;
            }

            const matchingSlot = PRE_INSPECTION_PHOTO_SLOTS.find((slot) => slot.key === matchingSlotKey);
            if (!matchingSlot) {
              return;
            }

            const { data: signedUrlData } = await supabase.storage
              .from("inspection-photos")
              .createSignedUrl(row.file_url, 60 * 60);

            nextPhotos[matchingSlot.key] = {
              ...nextPhotos[matchingSlot.key],
              preview: signedUrlData?.signedUrl ?? nextPhotos[matchingSlot.key].preview,
              fileName: row.file_name ?? nextPhotos[matchingSlot.key].fileName,
              fileUrl: row.file_url ?? null,
              note: row.note ?? nextPhotos[matchingSlot.key].note,
              photoRowId: row.id,
            };
          }),
        );

        syncPreInspectionPhotos(nextPhotos, resolvedDraft);
        setRequiredItemPhotos(nextRequiredItemPhotos);
      }
    } catch (error) {
      setAccessIssue(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydratePreInspectionPhotos, jobId, loadDraft, syncPreInspectionPhotos, writeDraftToStorage]);

  useEffect(() => {
    void loadJobData();
  }, [loadJobData]);

  const serviceTotal = useMemo(
    () => services.reduce((sum, service) => sum + (service.estimated_price ?? 0), 0),
    [services],
  );

  const quoteDiscountAmountValue = useMemo(() => {
    const parsed = Number.parseFloat(draft.quoteDiscountAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [draft.quoteDiscountAmount]);

  const quoteNetTotal = useMemo(
    () => Math.max(serviceTotal - quoteDiscountAmountValue, 0),
    [quoteDiscountAmountValue, serviceTotal],
  );

  const completedServiceCount = useMemo(
    () => services.filter((service) => Boolean(service.completed_at)).length,
    [services],
  );

  const preInspectionPhotoCounts = useMemo(() => {
    const counts = { corner: 0, interior: 0, vin: 0 };
    for (const slot of PRE_INSPECTION_PHOTO_SLOTS) {
      if (preInspectionPhotos[slot.key]?.preview) {
        counts[slot.category] += 1;
      }
    }
    return counts;
  }, [preInspectionPhotos]);

  const activeMaintenanceItems = useMemo(
    () => (draft.inspectionType === "full" ? FULL_MAINTENANCE_ITEMS : MINI_MAINTENANCE_ITEMS),
    [draft.inspectionType],
  );

  const activeUndercarItems = useMemo(
    () => (draft.inspectionType === "full" ? FULL_UNDERCAR_ITEMS : MINI_UNDERCAR_ITEMS),
    [draft.inspectionType],
  );

  const requiredInspectionItems = useMemo(() => {
    const requiredItems: string[] = [];

    for (const position of TIRE_POSITIONS) {
      if (draft.tireData[position]?.status === "req") {
        requiredItems.push(`${position} tire`);
      }
    }

    if (draft.brakes.status === "req") {
      requiredItems.push("Brake system");
    }

    for (const item of activeMaintenanceItems) {
      if (draft.maintenance[item]?.status === "req") {
        requiredItems.push(item);
      }
    }

    for (const item of activeUndercarItems) {
      if (draft.undercar[item]?.status === "req") {
        requiredItems.push(item);
      }
    }

    return requiredItems;
  }, [activeMaintenanceItems, activeUndercarItems, draft.brakes.status, draft.maintenance, draft.tireData, draft.undercar]);

  const ensureInspectionId = useCallback(async () => {
    if (draft.inspectionId) {
      return draft.inspectionId;
    }

    const { data, error } = await supabase
      .from("inspections")
      .insert({
        customer_id: job?.customer_id ?? null,
        vehicle_id: job?.vehicle_id ?? null,
        tech_name: getCustomerName(job),
        notes: `Stage-based technician flow draft for job ${jobId}`,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw error || new Error("Could not start an inspection record for photo storage.");
    }

    const nextDraft = { ...draft, inspectionId: data.id };
    persistDraft(nextDraft);
    return data.id;
  }, [draft, job, jobId, persistDraft]);

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
    if (preInspectionPhotoCounts.corner < 4) {
      issues.preinspection.push("Add all 4 corner photos before continuing.");
    }
    if (preInspectionPhotoCounts.interior < 2) {
      issues.preinspection.push("Add at least 2 interior photos before continuing.");
    }
    if (preInspectionPhotoCounts.vin < 1) {
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
    if (quoteDiscountAmountValue > serviceTotal && serviceTotal > 0) {
      issues.quote.push("Discount cannot be greater than the quote total.");
    }
    if (quoteDiscountAmountValue > 0 && !draft.quoteDiscountReason) {
      issues.quote.push("Select a reason for the discount.");
    }
    if (
      quoteDiscountAmountValue > 0 &&
      draft.quoteDiscountReason === "other" &&
      !draft.quoteDiscountOtherReason.trim()
    ) {
      issues.quote.push("Enter the custom reason for the discount.");
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
  }, [completedServiceCount, draft, job, paymentAmount, paymentStatus, preInspectionPhotoCounts, services.length]);

  const currentStageIndex = useMemo(
    () => STAGES.findIndex((stage) => stage.key === draft.currentStage),
    [draft.currentStage],
  );

  const activeStage = STAGES[currentStageIndex] ?? STAGES[0];
  const activeStageIssues = stageIssues[activeStage.key];
  const stageAdvanceBlocked = activeStageIssues.length > 0;
  const blockedSectionKeys = useMemo<FlowSectionKey[]>(() => {
    switch (activeStage.key) {
      case "dispatch": {
        const keys: FlowSectionKey[] = [];
        if (!job?.service_location_name && !job?.service_address) keys.push("dispatch-location");
        if (!job?.customer?.phone) keys.push("dispatch-customer");
        return keys;
      }
      case "arrival":
        return ["arrival-status"];
      case "complaint": {
        const keys: FlowSectionKey[] = [];
        if (!draft.complaintSummary.trim()) keys.push("complaint-summary");
        if (services.length === 0) keys.push("complaint-services");
        return keys;
      }
      case "preinspection": {
        const keys: FlowSectionKey[] = [];
        if (!draft.mileage.trim()) keys.push("preinspection-mileage");
        if (!draft.vinConfirmed && !job?.vehicle?.vin) keys.push("preinspection-vin");
        if (
          preInspectionPhotoCounts.corner < 4 ||
          preInspectionPhotoCounts.interior < 2 ||
          preInspectionPhotoCounts.vin < 1
        ) {
          keys.push("preinspection-photos");
        }
        return keys;
      }
      case "inspection":
        return ["inspection-type-summary"];
      case "quote": {
        const keys: FlowSectionKey[] = [];
        if (services.length === 0) keys.push("quote-services");
        if (
          (quoteDiscountAmountValue > serviceTotal && serviceTotal > 0) ||
          (quoteDiscountAmountValue > 0 && !draft.quoteDiscountReason) ||
          (quoteDiscountAmountValue > 0 &&
            draft.quoteDiscountReason === "other" &&
            !draft.quoteDiscountOtherReason.trim())
        ) {
          keys.push("quote-discount");
        }
        if (draft.quoteApprovalStatus === "signed" && !draft.customerSignatureName.trim()) {
          keys.push("quote-signature");
        }
        return keys;
      }
      case "work":
        return services.length > 0 && completedServiceCount < services.length ? ["work-services"] : [];
      case "payment":
        return !paymentAmount.trim() || paymentStatus !== "paid" ? ["payment-details"] : [];
      case "closeout": {
        const keys: FlowSectionKey[] = [];
        if (!draft.postWorkSummary.trim()) keys.push("closeout-summary");
        if (!draft.receiptSent || !draft.receiptStored) keys.push("closeout-receipt");
        return keys;
      }
      default:
        return [];
    }
  }, [
    activeStage.key,
    completedServiceCount,
    draft.complaintSummary,
    draft.postWorkSummary,
    draft.quoteDiscountOtherReason,
    draft.quoteDiscountReason,
    draft.quoteApprovalStatus,
    draft.receiptSent,
    draft.receiptStored,
    draft.vinConfirmed,
    job?.customer?.phone,
    job?.service_address,
    job?.service_location_name,
    job?.vehicle?.vin,
    paymentAmount,
    paymentStatus,
    preInspectionPhotoCounts.corner,
    preInspectionPhotoCounts.interior,
    preInspectionPhotoCounts.vin,
    quoteDiscountAmountValue,
    services.length,
    serviceTotal,
  ]);
  const isSectionHighlighted = useCallback(
    (sectionKey: FlowSectionKey) =>
      showValidationHighlights && stageAdvanceBlocked && blockedSectionKeys.includes(sectionKey),
    [blockedSectionKeys, showValidationHighlights, stageAdvanceBlocked],
  );
  const advanceStage = useCallback(async () => {
    if (stageAdvanceBlocked) {
      setFeedback("error", activeStageIssues[0]);
      setShowValidationHighlights(true);
      setShowIncompleteDialog(true);
      return;
    }

    setShowValidationHighlights(false);
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

      if (activeStage.key === "inspection") {
        const inspectionId = await ensureInspectionId();
        const { error } = await supabase
          .from("inspections")
          .update({
            customer_id: job?.customer_id ?? null,
            vehicle_id: job?.vehicle_id ?? null,
            tech_name: getCustomerName(job),
            notes: draft.inspectionSummary.trim() || null,
            tire_data: draft.tireData,
            brakes: draft.brakes,
            maintenance: draft.maintenance,
            undercar: draft.undercar,
            inspection_summary: {
              inspection_type: draft.inspectionType,
              staged_flow: true,
              current_mileage: draft.mileage.trim() || null,
              vin_confirmed: draft.vinConfirmed || Boolean(job?.vehicle?.vin),
              complaint_summary: draft.complaintSummary.trim() || null,
              complaint_details: draft.complaintDetails.trim() || null,
              quote_notes: draft.quoteNotes.trim() || null,
              quote_discount_amount: quoteDiscountAmountValue || null,
              quote_discount_reason: draft.quoteDiscountReason || null,
              quote_discount_other_reason:
                draft.quoteDiscountReason === "other"
                  ? draft.quoteDiscountOtherReason.trim() || null
                  : null,
              quote_subtotal: serviceTotal,
              service_total: quoteNetTotal,
              quote_total_after_discount: quoteNetTotal,
              completed_service_count: completedServiceCount,
              total_service_count: services.length,
            },
          })
          .eq("id", inspectionId);

        if (error) {
          throw error;
        }
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
  }, [
    activeStage,
    activeStageIssues,
    completedServiceCount,
    currentStageIndex,
    draft,
    ensureInspectionId,
    job,
    jobId,
    loadJobData,
    persistDraft,
    quoteDiscountAmountValue,
    quoteNetTotal,
    serviceTotal,
    services.length,
    setFeedback,
    stageAdvanceBlocked,
  ]);

  useEffect(() => {
    if (!stageAdvanceBlocked) {
      setShowIncompleteDialog(false);
      setShowValidationHighlights(false);
    }
  }, [stageAdvanceBlocked]);

  useEffect(() => {
    setShowAllStagesMobile(false);
  }, [draft.currentStage]);

  const goToStage = useCallback((stageKey: StageKey) => {
    updateDraft({ currentStage: stageKey });
  }, [updateDraft]);

  const handleSaveInspectionStage = useCallback(async () => {
    if (!job) {
      setFeedback("error", "The job details have not loaded yet.");
      return;
    }

    if (!draft.inspectionType) {
      setFeedback("error", "Choose mini or full inspection first.");
      return;
    }

    setActionBusy("save-inspection");
    try {
      const inspectionId = await ensureInspectionId();
      const payload = {
        customer_id: job.customer_id ?? null,
        vehicle_id: job.vehicle_id ?? null,
        tech_name: getCustomerName(job),
        notes: draft.inspectionSummary.trim() || null,
        tire_data: draft.tireData,
        brakes: draft.brakes,
        maintenance: draft.maintenance,
        undercar: draft.undercar,
        inspection_summary: {
          inspection_type: draft.inspectionType,
          staged_flow: true,
          current_mileage: draft.mileage.trim() || null,
          vin_confirmed: draft.vinConfirmed || Boolean(job.vehicle?.vin),
          complaint_summary: draft.complaintSummary.trim() || null,
          complaint_details: draft.complaintDetails.trim() || null,
          quote_notes: draft.quoteNotes.trim() || null,
          quote_discount_amount: quoteDiscountAmountValue || null,
          quote_discount_reason: draft.quoteDiscountReason || null,
          quote_discount_other_reason:
            draft.quoteDiscountReason === "other"
              ? draft.quoteDiscountOtherReason.trim() || null
              : null,
          quote_subtotal: serviceTotal,
          service_total: quoteNetTotal,
          quote_total_after_discount: quoteNetTotal,
          completed_service_count: completedServiceCount,
          total_service_count: services.length,
        },
      };

      const { error } = await supabase.from("inspections").update(payload).eq("id", inspectionId);
      if (error) {
        throw error;
      }

      setFeedback("success", "Inspection details saved into the staged technician flow.");
      await loadJobData(true);
    } catch (error) {
      setFeedback("error", getErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  }, [
    completedServiceCount,
    draft,
    ensureInspectionId,
    job,
    loadJobData,
    quoteDiscountAmountValue,
    quoteNetTotal,
    serviceTotal,
    services.length,
    setFeedback,
  ]);

  const handlePreInspectionPhotoUpload = useCallback(
    async (slotKey: string, file: File) => {
      const slot = PRE_INSPECTION_PHOTO_SLOTS.find((entry) => entry.key === slotKey);
      if (!slot) {
        return;
      }

      setActionBusy(`photo-${slotKey}`);
      try {
        const inspectionId = await ensureInspectionId();
        const existing = preInspectionPhotos[slotKey];
        const filePath = `${inspectionId}/pre-service/${slot.label.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${file.name}`;
        let nextPhotoRowId = existing?.photoRowId ?? null;

        const { error: uploadError } = await supabase.storage
          .from("inspection-photos")
          .upload(filePath, file, {
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(filePath, 60 * 60);

        if (signedUrlError) {
          throw signedUrlError;
        }

        const payload = {
          inspection_id: inspectionId,
          photo_stage: "pre_service",
          shot_label: slot.label,
          file_name: file.name,
          file_url: filePath,
          note: existing?.note || null,
        };

        if (existing?.photoRowId) {
          const { error } = await supabase
            .from("inspection_photos")
            .update(payload)
            .eq("id", existing.photoRowId);
          if (error) {
            throw error;
          }
        } else {
          const { data, error } = await supabase
            .from("inspection_photos")
            .insert(payload)
            .select("id")
            .single();
          if (error) {
            throw error;
          }
          nextPhotoRowId = data.id;
        }

        const nextPhotos = {
          ...preInspectionPhotos,
          [slotKey]: {
            ...existing,
            shotKey: slot.key,
            label: slot.label,
            note: existing?.note || "",
            preview: signedUrlData.signedUrl,
            fileName: file.name,
            fileUrl: filePath,
            photoRowId: nextPhotoRowId,
          },
        };

        syncPreInspectionPhotos(nextPhotos);
        setFeedback("success", `${slot.label} uploaded.`);
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      } finally {
        setActionBusy(null);
      }
    },
    [ensureInspectionId, preInspectionPhotos, setFeedback, syncPreInspectionPhotos],
  );

  const handlePreInspectionPhotoNoteChange = useCallback(
    async (slotKey: string, note: string) => {
      const current = preInspectionPhotos[slotKey];
      if (!current) {
        return;
      }

      const nextPhotos = {
        ...preInspectionPhotos,
        [slotKey]: {
          ...current,
          note,
        },
      };

      syncPreInspectionPhotos(nextPhotos);

      if (!current.photoRowId) {
        return;
      }

      try {
        const { error } = await supabase
          .from("inspection_photos")
          .update({ note })
          .eq("id", current.photoRowId);
        if (error) {
          throw error;
        }
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      }
    },
    [preInspectionPhotos, setFeedback, syncPreInspectionPhotos],
  );

  const handleDeletePreInspectionPhoto = useCallback(
    async (slotKey: string) => {
      const current = preInspectionPhotos[slotKey];
      if (!current) {
        return;
      }

      setActionBusy(`delete-photo-${slotKey}`);
      try {
        if (current.fileUrl) {
          const { error: storageError } = await supabase.storage
            .from("inspection-photos")
            .remove([current.fileUrl]);
          if (storageError) {
            throw storageError;
          }
        }

        if (current.photoRowId) {
          const { error } = await supabase
            .from("inspection_photos")
            .delete()
            .eq("id", current.photoRowId);
          if (error) {
            throw error;
          }
        }

        const nextPhotos = {
          ...preInspectionPhotos,
          [slotKey]: {
            ...createEmptyPreInspectionPhotos()[slotKey],
          },
        };

        syncPreInspectionPhotos(nextPhotos);
        setFeedback("success", "Photo removed.");
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      } finally {
        setActionBusy(null);
      }
    },
    [preInspectionPhotos, setFeedback, syncPreInspectionPhotos],
  );

  const handleRequiredItemPhotoUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      setActionBusy("required-item-photos");
      try {
        const inspectionId = await ensureInspectionId();
        const uploadedPhotos: RequiredItemPhoto[] = [];

        for (const file of Array.from(files)) {
          const filePath = `${inspectionId}/inspection-required/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from("inspection-photos")
            .upload(filePath, file);

          if (uploadError) {
            throw uploadError;
          }

          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from("inspection-photos")
            .createSignedUrl(filePath, 60 * 60);

          if (signedUrlError) {
            throw signedUrlError;
          }

          const { data, error } = await supabase
            .from("inspection_photos")
            .insert({
              inspection_id: inspectionId,
              photo_stage: "inspection_required",
              shot_label: "Required finding photo",
              file_name: file.name,
              file_url: filePath,
              note: null,
            })
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          uploadedPhotos.push({
            id: data.id,
            label: "Required finding photo",
            note: "",
            preview: signedUrlData.signedUrl,
            fileName: file.name,
            fileUrl: filePath,
            photoRowId: data.id,
          });
        }

        setRequiredItemPhotos((current) => [...current, ...uploadedPhotos]);
        setFeedback("success", `${uploadedPhotos.length} required-item photo${uploadedPhotos.length === 1 ? "" : "s"} uploaded.`);
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      } finally {
        setActionBusy(null);
      }
    },
    [ensureInspectionId, setFeedback],
  );

  const handleRequiredItemPhotoNoteChange = useCallback(
    async (photoRowId: string, note: string) => {
      setRequiredItemPhotos((current) =>
        current.map((photo) => (photo.photoRowId === photoRowId ? { ...photo, note } : photo)),
      );

      try {
        const { error } = await supabase
          .from("inspection_photos")
          .update({ note })
          .eq("id", photoRowId);
        if (error) {
          throw error;
        }
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      }
    },
    [setFeedback],
  );

  const handleDeleteRequiredItemPhoto = useCallback(
    async (photo: RequiredItemPhoto) => {
      if (!photo.photoRowId) {
        return;
      }

      setActionBusy(`delete-required-photo-${photo.photoRowId}`);
      try {
        const { error } = await supabase
          .from("inspection_photos")
          .delete()
          .eq("id", photo.photoRowId);
        if (error) {
          throw error;
        }

        setRequiredItemPhotos((current) => current.filter((item) => item.photoRowId !== photo.photoRowId));
        setFeedback("success", "Required-item photo removed.");
      } catch (error) {
        setFeedback("error", getErrorMessage(error));
      } finally {
        setActionBusy(null);
      }
    },
    [setFeedback],
  );

  const updateTireField = useCallback(
    (position: string, field: keyof TireInspectionEntry, value: string) => {
      const nextTireData = {
        ...draft.tireData,
        [position]: {
          ...draft.tireData[position],
          [field]: value,
        },
      };
      updateDraft({ tireData: nextTireData });
    },
    [draft.tireData, updateDraft],
  );

  const updateBrakeField = useCallback(
    (field: keyof BrakeInspectionState, value: string) => {
      updateDraft({
        brakes: {
          ...draft.brakes,
          [field]: value,
        },
      });
    },
    [draft.brakes, updateDraft],
  );

  const updateChecklistField = useCallback(
    (
      section: "maintenance" | "undercar",
      item: string,
      field: keyof ChecklistItemState,
      value: string,
    ) => {
      const source = draft[section];
      updateDraft({
        [section]: {
          ...source,
          [item]: {
            ...source[item],
            [field]: value,
          },
        },
      } as Pick<TechFlowDraft, "maintenance" | "undercar">);
    },
    [draft, updateDraft],
  );

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session is no longer valid. Please sign in again.");
      }

      const response = await fetch(`/api/internal/tech/job-services/${serviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Could not remove that service line.");
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
            <div className={cn("rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700", isSectionHighlighted("inspection-type-summary") && "border-red-300 bg-red-50 ring-2 ring-red-400")}>
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
            <div className={cn("space-y-2 rounded-2xl", isSectionHighlighted("complaint-summary") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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
              <Card className={cn("rounded-2xl border border-slate-200 bg-slate-50 shadow-none", isSectionHighlighted("complaint-services") && "border-red-300 bg-red-50 ring-2 ring-red-400")}>
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
              <div className={cn("space-y-2 rounded-2xl", isSectionHighlighted("preinspection-mileage") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
                <Label htmlFor="mileage">Current mileage</Label>
                <Input id="mileage" inputMode="numeric" value={draft.mileage} onChange={(event) => updateDraft({ mileage: event.target.value })} placeholder="Enter odometer reading" />
              </div>
              <div className={cn("space-y-2 rounded-2xl", isSectionHighlighted("preinspection-vin") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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

            <div className={cn("grid gap-3 rounded-2xl md:grid-cols-3", isSectionHighlighted("preinspection-photos") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
              <SummaryInfoCard icon={Camera} label="Corner photos" value={`${preInspectionPhotoCounts.corner} / 4`} />
              <SummaryInfoCard icon={Camera} label="Interior photos" value={`${preInspectionPhotoCounts.interior} / 2`} />
              <SummaryInfoCard icon={ShieldCheck} label="VIN photos" value={`${preInspectionPhotoCounts.vin} / 1`} />
            </div>

            <div className={cn("grid gap-4 rounded-2xl md:grid-cols-2 xl:grid-cols-3", isSectionHighlighted("preinspection-photos") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
              {PRE_INSPECTION_PHOTO_SLOTS.map((slot) => {
                const photo = preInspectionPhotos[slot.key];
                return (
                  <Card key={slot.key} className="rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">{slot.label}</CardTitle>
                      <CardDescription>
                        {slot.category === "corner"
                          ? "Required vehicle corner documentation."
                          : slot.category === "interior"
                            ? "Required interior condition photo."
                            : "Required VIN confirmation photo."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed bg-white p-4 text-center">
                        {photo?.preview ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="absolute top-3 right-3 z-10 rounded-full bg-white/90 text-red-700 shadow-sm hover:bg-white"
                              disabled={actionBusy === `delete-photo-${slot.key}`}
                              onClick={() => void handleDeletePreInspectionPhoto(slot.key)}
                            >
                              {actionBusy === `delete-photo-${slot.key}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.preview} alt={slot.label} className="h-44 w-full rounded-2xl object-cover" />
                          </>
                        ) : (
                          <>
                            <Upload className="mb-3 h-8 w-8 text-slate-500" />
                            <div className="font-medium text-slate-900">Add {slot.label}</div>
                            <div className="text-sm text-slate-600">Capture on-site or upload from device.</div>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
                          Take Photo
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handlePreInspectionPhotoUpload(slot.key, file);
                              }
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>

                        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
                          Upload Existing
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handlePreInspectionPhotoUpload(slot.key, file);
                              }
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`pre-photo-note-${slot.key}`}>Photo note</Label>
                        <Textarea
                          id={`pre-photo-note-${slot.key}`}
                          value={photo?.note || ""}
                          onChange={(event) => void handlePreInspectionPhotoNoteChange(slot.key, event.target.value)}
                          placeholder="Optional condition note before service"
                          className="bg-white"
                        />
                      </div>

                      {actionBusy === `photo-${slot.key}` ? (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
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
            {draft.inspectionType ? (
              <>
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">Tire inspection</div>
                      <div className="text-sm text-slate-600">
                        {draft.inspectionType === "mini"
                          ? "Mini inspections still capture tire pressures, tread, and quick recommendations."
                          : "Full inspections include the complete tire condition review for every corner."}
                      </div>
                    </div>
                    <Badge className="rounded-full bg-white text-slate-900">{draft.inspectionType === "mini" ? "Mini flow" : "Full flow"}</Badge>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {TIRE_POSITIONS.map((position) => (
                      <Card key={position} className="rounded-2xl border border-slate-200 bg-white shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{position}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>PSI In</Label>
                              <Input
                                value={draft.tireData[position]?.psiIn ?? ""}
                                onChange={(event) => updateTireField(position, "psiIn", event.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>PSI Out</Label>
                              <Input
                                value={draft.tireData[position]?.psiOut ?? ""}
                                onChange={(event) => updateTireField(position, "psiOut", event.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tread Outer (32nds)</Label>
                              <Input
                                value={draft.tireData[position]?.treadOuter ?? ""}
                                onChange={(event) => updateTireField(position, "treadOuter", event.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tread Inner (32nds)</Label>
                              <Input
                                value={draft.tireData[position]?.treadInner ?? ""}
                                onChange={(event) => updateTireField(position, "treadInner", event.target.value)}
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Condition</Label>
                            <ConditionPillRow
                              value={draft.tireData[position]?.status ?? ""}
                              onChange={(value) => updateTireField(position, "status", value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Recommendation</Label>
                            <Textarea
                              value={draft.tireData[position]?.recommendation ?? ""}
                              onChange={(event) => updateTireField(position, "recommendation", event.target.value)}
                              placeholder="Rotation, replacement, alignment, or monitoring note"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {draft.inspectionType === "full" ? (
                  <Card className="rounded-3xl border border-slate-200 bg-slate-50 shadow-none">
                    <CardHeader>
                      <CardTitle>Brake inspection</CardTitle>
                      <CardDescription>Full paid inspections keep the measured brake section in the new flow.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-4">
                        {[
                          ["LF Pad (mm)", "lfPad"],
                          ["RF Pad (mm)", "rfPad"],
                          ["LR Pad/Shoe (mm)", "lrPad"],
                          ["RR Pad/Shoe (mm)", "rrPad"],
                          ["LF Rotor/Drum", "lfRotor"],
                          ["RF Rotor/Drum", "rfRotor"],
                          ["LR Rotor/Drum", "lrRotor"],
                          ["RR Rotor/Drum", "rrRotor"],
                        ].map(([label, key]) => (
                          <div key={key} className="space-y-2">
                            <Label>{label}</Label>
                            <Input
                              value={draft.brakes[key as keyof BrakeInspectionState] as string}
                              onChange={(event) => updateBrakeField(key as keyof BrakeInspectionState, event.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                        <div className="space-y-2">
                          <Label>Brake condition</Label>
                          <ConditionPillRow value={draft.brakes.status} onChange={(value) => updateBrakeField("status", value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Brake notes</Label>
                          <Textarea
                            value={draft.brakes.brakeNotes}
                            onChange={(event) => updateBrakeField("brakeNotes", event.target.value)}
                            placeholder="Measured values, rotor condition, and next-step recommendation"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="rounded-3xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>Maintenance inspection</CardTitle>
                    <CardDescription>
                      {draft.inspectionType === "mini"
                        ? "Mini inspection keeps only the lighter maintenance checks needed for quick services."
                        : "Full inspection keeps the deeper maintenance recommendation list in the new staged flow."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeMaintenanceItems.map((item) => (
                      <ChecklistRow
                        key={item}
                        label={item}
                        value={draft.maintenance[item]}
                        onStatusChange={(value) => updateChecklistField("maintenance", item, "status", value)}
                        onWhyChange={(value) => updateChecklistField("maintenance", item, "why", value)}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>
                      {draft.inspectionType === "mini"
                        ? "Undercar and steering quick check"
                        : "Steering, suspension, and undercar inspection"}
                    </CardTitle>
                    <CardDescription>
                      {draft.inspectionType === "mini"
                        ? "Mini inspection trims the deeper steering worksheet down to the essentials."
                        : "Full inspection keeps the broader underside and steering-component review."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeUndercarItems.map((item) => (
                      <ChecklistRow
                        key={item}
                        label={item}
                        value={draft.undercar[item]}
                        onStatusChange={(value) => updateChecklistField("undercar", item, "status", value)}
                        onWhyChange={(value) => updateChecklistField("undercar", item, "why", value)}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>Required-item photos</CardTitle>
                    <CardDescription>
                      Add multiple photos for any maintenance or undercar item marked Required so the quote and customer report have visual support.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={cn(
                      "rounded-2xl border p-4 text-sm",
                      requiredInspectionItems.length ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-600",
                    )}>
                      <div className="font-semibold">
                        {requiredInspectionItems.length ? "Current required findings" : "No required findings marked yet"}
                      </div>
                      <div className="mt-2">
                        {requiredInspectionItems.length
                          ? requiredInspectionItems.join(", ")
                          : "When an inspection item is marked Required, add supporting photos here if the technician can capture them."}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                      <div>
                        <Upload className="mx-auto mb-3 h-8 w-8" />
                        <div className="font-medium text-slate-900">Upload required-item photos</div>
                        <div className="text-sm text-slate-600">Take or upload multiple photos of leaks, worn parts, damaged components, or anything marked Required.</div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
                          Take Photos
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => void handleRequiredItemPhotoUpload(event.target.files)}
                          />
                        </label>

                        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
                          Upload Existing
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*"
                            onChange={(event) => void handleRequiredItemPhotoUpload(event.target.files)}
                          />
                        </label>
                      </div>
                    </div>

                    {actionBusy === "required-item-photos" ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        Uploading required-item photos...
                      </div>
                    ) : null}

                    {requiredItemPhotos.length ? (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {requiredItemPhotos.map((photo) => (
                          <Card key={photo.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            {photo.preview ? (
                              <img src={photo.preview} alt={photo.fileName || photo.label} className="h-48 w-full object-cover" />
                            ) : (
                              <div className="flex h-48 items-center justify-center bg-slate-100 text-slate-500">
                                Photo preview unavailable
                              </div>
                            )}
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-900">{photo.fileName || photo.label}</div>
                                  <div className="text-xs text-slate-500">{photo.label}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  type="button"
                                  disabled={actionBusy === `delete-required-photo-${photo.photoRowId}`}
                                  onClick={() => void handleDeleteRequiredItemPhoto(photo)}
                                >
                                  {actionBusy === `delete-required-photo-${photo.photoRowId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                </Button>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`required-photo-note-${photo.photoRowId}`}>What required item does this support?</Label>
                                <Textarea
                                  id={`required-photo-note-${photo.photoRowId}`}
                                  value={photo.note}
                                  onChange={(event) => void handleRequiredItemPhotoNoteChange(photo.photoRowId ?? "", event.target.value)}
                                  placeholder="Example: Oil leak at valve cover, front pads near metal-to-metal, torn CV boot"
                                  className="min-h-24"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

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

              </>
            ) : null}
          </div>
        );
      case "quote":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryInfoCard icon={Wrench} label="Service lines" value={`${services.length}`} />
              <SummaryInfoCard icon={Receipt} label="Quote subtotal" value={formatCurrency(serviceTotal)} />
              <SummaryInfoCard icon={FileSignature} label="Estimate" value={estimate?.estimate_number || estimate?.estimate_status || "Not created"} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className={cn("rounded-2xl border border-slate-200 bg-slate-50 shadow-none", isSectionHighlighted("quote-services") && "border-red-300 bg-red-50 ring-2 ring-red-400")}>
                <CardHeader>
                  <CardTitle>Quote services</CardTitle>
                  <CardDescription>Review the live quote here before sending or marking approval.</CardDescription>
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
                            {service.notes ? <div className="text-xs text-slate-500">Note: {service.notes}</div> : null}
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
                <Card className={cn("rounded-2xl border border-slate-200 bg-slate-50 shadow-none", isSectionHighlighted("quote-discount") && "border-red-300 bg-red-50 ring-2 ring-red-400")}>
                  <CardHeader>
                    <CardTitle>Discount</CardTitle>
                    <CardDescription>Add a manual quote discount and document why it was approved.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="quote-discount-amount">Discount amount</Label>
                      <Input
                        id="quote-discount-amount"
                        inputMode="decimal"
                        value={draft.quoteDiscountAmount}
                        onChange={(event) => updateDraft({ quoteDiscountAmount: event.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount reason</Label>
                      <Select
                        value={draft.quoteDiscountReason || "__none__"}
                        onValueChange={(value) =>
                          updateDraft({
                            quoteDiscountReason: value === "__none__" ? "" : value,
                            quoteDiscountOtherReason:
                              value === "other" ? draft.quoteDiscountOtherReason : "",
                          })
                        }
                      >
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Select a discount reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No reason selected</SelectItem>
                          {QUOTE_DISCOUNT_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {draft.quoteDiscountReason === "other" ? (
                      <div className="space-y-2">
                        <Label htmlFor="quote-discount-other-reason">Other reason</Label>
                        <Textarea
                          id="quote-discount-other-reason"
                          value={draft.quoteDiscountOtherReason}
                          onChange={(event) => updateDraft({ quoteDiscountOtherReason: event.target.value })}
                          placeholder="Enter the approved custom reason for this discount."
                        />
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900">{formatCurrency(serviceTotal)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span>Discount</span>
                        <span className="font-medium text-slate-900">-{formatCurrency(quoteDiscountAmountValue)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                        <span className="font-medium text-slate-900">Quote total</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(quoteNetTotal)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200 bg-slate-50 shadow-none">
                  <CardHeader>
                    <CardTitle>Add catalog service</CardTitle>
                    <CardDescription>Add approved or newly discovered work into the quote before sending it.</CardDescription>
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
                      <Label htmlFor="quote-added-reason">Reason for added service</Label>
                      <Textarea
                        id="quote-added-reason"
                        value={draft.addedServiceReason}
                        onChange={(event) => updateDraft({ addedServiceReason: event.target.value })}
                        placeholder="Why is this service being added or adjusted on the quote?"
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
                    <CardDescription>Use this when the quote needs a line item that is not in the catalog yet.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="quote-custom-service-name">Service name</Label>
                      <Input id="quote-custom-service-name" value={customServiceName} onChange={(event) => setCustomServiceName(event.target.value)} placeholder="Example: Cabin air filter replacement" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quote-custom-service-description">Description</Label>
                      <Textarea id="quote-custom-service-description" value={customServiceDescription} onChange={(event) => setCustomServiceDescription(event.target.value)} placeholder="Add parts, labor, or diagnostic context." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quote-custom-service-price">Estimated price</Label>
                      <Input id="quote-custom-service-price" inputMode="decimal" value={customServicePrice} onChange={(event) => setCustomServicePrice(event.target.value)} placeholder="0.00" />
                    </div>
                    <Button type="button" className="min-h-11 w-full" disabled={actionBusy === "add-custom-service"} onClick={() => void handleAddCustomService()}>
                      {actionBusy === "add-custom-service" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add custom service
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
              <div className={cn("space-y-2 rounded-2xl", isSectionHighlighted("quote-signature") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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
            <div className={cn("space-y-3 rounded-2xl", isSectionHighlighted("work-services") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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
            <div className={cn("grid gap-4 rounded-2xl md:grid-cols-2", isSectionHighlighted("payment-details") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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
                <Input id="payment-amount" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={quoteNetTotal ? String(quoteNetTotal.toFixed(2)) : "0.00"} />
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
            <div className={cn("space-y-2 rounded-2xl", isSectionHighlighted("closeout-summary") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
              <Label htmlFor="post-work-summary">Post-work summary</Label>
              <Textarea
                id="post-work-summary"
                value={draft.postWorkSummary}
                onChange={(event) => updateDraft({ postWorkSummary: event.target.value })}
                placeholder="Summarize completed work, final notes, and what the customer should know."
                className="min-h-28"
              />
            </div>
            <div className={cn("grid gap-3 rounded-2xl sm:grid-cols-2", isSectionHighlighted("closeout-receipt") && "border border-red-300 bg-red-50 p-4 ring-2 ring-red-400")}>
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
      {showIncompleteDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Form Not Completed</h2>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Missing items</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {activeStageIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" className="min-h-11" onClick={() => setShowIncompleteDialog(false)}>
                Review highlighted area
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
                <p className="hidden text-sm text-slate-600 md:block">Move through the job the same way the service visit actually happens.</p>
              </div>
              <div className="md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowAllStagesMobile((current) => !current)}
                >
                  {showAllStagesMobile ? "Show current stage only" : "View all stages"}
                  <span className="text-xs text-slate-500">
                    Stage {currentStageIndex + 1} / {STAGES.length}
                  </span>
                </Button>
              </div>
              <div className="space-y-3 md:hidden">
                {(showAllStagesMobile ? STAGES : [activeStage]).map((stage) => (
                  <StageNavButton
                    key={stage.key}
                    stage={stage}
                    index={STAGES.findIndex((entry) => entry.key === stage.key)}
                    issues={stageIssues[stage.key]}
                    isActive={draft.currentStage === stage.key}
                    currentStageIndex={currentStageIndex}
                    onClick={() => goToStage(stage.key)}
                    showDescription={false}
                  />
                ))}
              </div>
              <div className="hidden space-y-3 md:block">
                {STAGES.map((stage) => (
                  <StageNavButton
                    key={stage.key}
                    stage={stage}
                    index={STAGES.findIndex((entry) => entry.key === stage.key)}
                    issues={stageIssues[stage.key]}
                    isActive={draft.currentStage === stage.key}
                    currentStageIndex={currentStageIndex}
                    onClick={() => goToStage(stage.key)}
                    showDescription
                  />
                ))}
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
                    <CardDescription className="mt-1 hidden sm:block">{activeStage.description}</CardDescription>
                  </div>
                  <Badge className="rounded-full bg-slate-100 text-slate-900">
                    {currentStageIndex + 1} / {STAGES.length}
                  </Badge>
                </div>
                {showValidationHighlights && stageAdvanceBlocked ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <div className="font-semibold">Before continuing:</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {activeStageIssues.map((issue) => (
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
                <SummaryInfoCard icon={Receipt} label="Quote total" value={formatCurrency(quoteNetTotal)} />
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

function StageNavButton({
  stage,
  index,
  issues,
  isActive,
  currentStageIndex,
  onClick,
  showDescription,
}: {
  stage: (typeof STAGES)[number];
  index: number;
  issues: string[];
  isActive: boolean;
  currentStageIndex: number;
  onClick: () => void;
  showDescription: boolean;
}) {
  const isComplete = index < currentStageIndex && issues.length === 0;

  return (
    <button
      type="button"
      onClick={onClick}
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
          {showDescription ? (
            <div className={cn("mt-1 text-sm", isActive ? "text-white/80" : "text-slate-600")}>
              {stage.description}
            </div>
          ) : null}
        </div>
        {isComplete ? (
          <Check className="mt-1 h-4 w-4 shrink-0" />
        ) : issues.length > 0 ? (
          <AlertCircle className={cn("mt-1 h-4 w-4 shrink-0", isActive ? "text-amber-200" : "text-amber-600")} />
        ) : null}
      </div>
    </button>
  );
}

function ConditionPillRow({
  value,
  onChange,
}: {
  value: ConditionValue;
  onChange: (value: ConditionValue) => void;
}) {
  const options: Array<{ value: ConditionValue; label: string }> = [
    { value: "", label: "N/A" },
    { value: "ok", label: "OK" },
    { value: "sug", label: "Suggested" },
    { value: "req", label: "Required" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option) => (
        <Button
          key={option.label}
          type="button"
          variant={value === option.value ? "default" : "outline"}
          className={cn(
            "min-h-10",
            value === "" && option.value === "" && "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100",
          )}
          onClick={() => onChange(option.value === "" ? "" : value === option.value ? "" : option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ChecklistRow({
  label,
  value,
  onStatusChange,
  onWhyChange,
}: {
  label: string;
  value: ChecklistItemState;
  onStatusChange: (value: ConditionValue) => void;
  onWhyChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.1fr_320px_1fr]">
      <div className="flex items-center font-medium text-slate-900">{label}</div>
      <ConditionPillRow value={value?.status ?? ""} onChange={onStatusChange} />
      <Input
        value={value?.why ?? ""}
        onChange={(event) => onWhyChange(event.target.value)}
        placeholder="Why this item was N/A, should be watched, or needs service"
      />
    </div>
  );
}
