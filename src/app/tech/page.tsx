"use client";
// @ts-nocheck
import { supabase } from "@/lib/supabase";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  CalendarClock,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  MapPin,
  Upload,
  Wrench,
} from "lucide-react";
import {
  formatMileage,
  formatPhoneNumber,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
import {
  getEmailInputWarning,
  getLicensePlateInputWarning,
  getMileageInputWarning,
  getPhoneInputWarning,
  getVinInputWarning,
  getYearInputWarning,
} from "@/lib/input-validation-feedback";
import { VehicleCatalogFields } from "@/components/vehicle/VehicleCatalogFields";
import { UsStateSelect } from "@/components/forms/UsStateSelect";
import { DEFAULT_US_STATE_CODE, resolveUsStateForForm } from "@/lib/us-states";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { headerActionButtonClassName } from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import {
  abbreviatedWorkflowStepOrder,
  workflowStepLabels,
  workflowStepOrder,
} from "@/lib/inspection-workflow";
import { getInspectionRecommendations } from "@/lib/inspection-recommendations";
import {
  getMaintenanceSchedulePreview,
  type MaintenanceScheduleInterval,
} from "@/lib/maintenance-suggestions";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import {
  buildCustomerPayload,
  buildInspectionPayload,
  buildTechInspectionDraft,
  buildVehiclePayload,
  getErrorMessage,
  getVehicleCatalogModes,
  getCustomerProfileValidationError,
  TECH_DRAFT_STORAGE_KEY,
  TECH_SAVED_DRAFTS_STORAGE_KEY,
} from "@/lib/tech-inspection";
import { deleteJobWithRelatedRecords } from "@/lib/job-deletion";
import {
  createJobCustomerUpdate,
  fetchJobCustomerUpdates,
  type JobCustomerUpdateRow,
  type JobCustomerUpdateType,
} from "@/lib/job-customer-updates";
import { techCustomerUpdateTemplates } from "@/lib/tech-customer-update-templates";

const conditionOptions = [
  { value: "ok", label: "OK" },
  { value: "sug", label: "Suggested" },
  { value: "req", label: "Required" },
];

const tireFlags = ["Edgewear", "Cupping", "Cuts", "Irregularity", "Cracking", "Nails", "Repairable", "Non-Repairable"] as const;

const maintenanceItems = [
  "Wiper Blades",
  "Head Lights",
  "Accessory Lights",
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

const undercarItems = [
  "U-Joint",
  "Struts / Shocks",
  "Strut Mounts",
  "Rack & Pinion Assembly",
  "CV Boots",
  "Tie Rod Ends",
  "Exhaust System",
  "Muffler",
] as const;

const abbreviatedMaintenanceItems = [
  "Wiper Blades",
  "Head Lights",
  "Accessory Lights",
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

const abbreviatedUndercarItems = [
  "Struts / Shocks",
  "CV Boots",
  "Tie Rod Ends",
  "Exhaust System",
] as const;

const tires = ["Left Front", "Right Front", "Right Rear", "Left Rear", "Spare"] as const;
const spareUnavailableFlag = "Missing / Unavailable";

const requiredConditionShots = [
  "Front Left Corner",
  "Front Right Corner",
  "Rear Right Corner",
  "Rear Left Corner",
  "Interior",
];

const createEmptyVehicleState = (techName = "") => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  year: "",
  make: "",
  model: "",
  mileage: "",
  vin: "",
  engineSize: "",
  licensePlate: "",
  state: DEFAULT_US_STATE_CODE,
  transmission: "",
  driveline: "",
  techName,
  notes: "",
  obdCode: "",
});

const createEmptyTireDataState = () =>
  tires.reduce<TireDataState>((acc, tire) => {
    acc[tire] = {
      psiIn: "",
      psiOut: "",
      treadOuter: "",
      treadInner: "",
      status: "",
      flags: [],
      recommendation: "",
    };
    return acc;
  }, {} as TireDataState);

const createEmptyBrakeState = (): BrakeState => ({
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
});

const createEmptyChecklistState = <T extends string>(items: readonly T[]) =>
  Object.fromEntries(items.map((item) => [item, { status: "", why: "" }])) as ChecklistState<T>;

const createEmptyConditionPhotoState = (): ConditionPhotoState =>
  Object.fromEntries(
    requiredConditionShots.map((shot) => [shot, { preview: "", name: "", note: "" }])
  );

const createEmptyWorkflowSteps = (): WorkflowStepsState =>
  Object.fromEntries(workflowStepOrder.map((step) => [step, false]));

const getInspectionModeFromServiceType = (serviceType: string | null | undefined) => {
  const normalizedServiceType = String(serviceType || "").toLowerCase();

  if (
    normalizedServiceType.includes("inspection") ||
    normalizedServiceType.includes("oil change + inspection") ||
    normalizedServiceType.includes("oil change and inspection")
  ) {
    return "full";
  }

  return "abbreviated";
};

const techWorkflowTabLabels: Record<string, string> = {
  vehicle: "Vehicle",
  mileage: "Mileage",
  tires: "Tires",
  brakes: "Brakes",
  maintenance: "Maintenance",
  photos: "Photos",
  "customer-report": "Report",
  review: "Review",
};

const mobilePrimaryButtonClassName =
  "min-h-12 w-full whitespace-normal break-words px-4 py-3 text-center sm:w-auto";

const mobileCardActionButtonClassName =
  "h-auto min-h-14 w-full justify-start whitespace-normal break-words rounded-2xl px-4 py-4 text-left";

type InspectionStatus = "ok" | "sug" | "req" | "" | null | undefined;

type StatusPillProps = {
  value: InspectionStatus;
};

type RecommendationStatus = "ok" | "sug" | "req";

type RgbColor = [number, number, number];

type ConditionSelectProps = {
  value: InspectionStatus;
  onChange: (value: RecommendationStatus) => void;
};

type SectionHeaderProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
};

type StepCompletionToggleProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
};

type TireEntry = {
  psiIn: string;
  psiOut: string;
  treadOuter: string;
  treadInner: string;
  status: InspectionStatus;
  flags: string[];
  recommendation: string;
};

type TirePosition = (typeof tires)[number];

type TireDataState = Record<TirePosition, TireEntry>;

type ChecklistEntry = {
  status: InspectionStatus;
  why: string;
};

type MaintenanceItem = (typeof maintenanceItems)[number];
type UndercarItem = (typeof undercarItems)[number];

type ChecklistState<T extends string> = Record<T, ChecklistEntry>;

type VehicleState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  year: string;
  make: string;
  model: string;
  mileage: string;
  vin: string;
  engineSize: string;
  licensePlate: string;
  state: string;
  transmission: string;
  driveline: string;
  techName: string;
  notes: string;
  obdCode: string;
};

type BrakeState = {
  lfPad: string;
  rfPad: string;
  lrPad: string;
  rrPad: string;
  lfRotor: string;
  rfRotor: string;
  lrRotor: string;
  rrRotor: string;
  brakeNotes: string;
  status: InspectionStatus;
};

type VehicleFieldKey = keyof VehicleState;
type BrakeFieldKey = keyof Omit<BrakeState, "brakeNotes" | "status">;
type TireFieldKey = Exclude<keyof TireEntry, "flags">;
type ChecklistFieldKey = keyof ChecklistEntry;

type TechnicianOption = {
  id: string;
  label: string;
};

type UploadedPhoto = {
  id: string;
  name: string;
  file?: File;
  preview: string;
  note: string;
};

type ConditionPhoto = {
  preview: string;
  name: string;
  note: string;
  file?: File;
};

type ConditionPhotoState = Record<string, ConditionPhoto>;

type WorkflowStepsState = Record<string, boolean>;

type TechnicianJob = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  business_job_number: string | null;
  service_type: string | null;
  service_description: string | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  status: string | null;
  notes: string | null;
  assigned_tech_user_id: string | null;
  intake_state: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  service_checklist_started_at: string | null;
  service_checklist_completed_at: string | null;
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

type JobServiceRow = {
  id: string;
  job_id: string;
  service_name: string;
  service_description: string | null;
  sort_order: number;
  completed_at: string | null;
};

type SavedTechDraft = {
  id: string;
  title: string;
  subtitle: string;
  savedAt: string;
  draft: ReturnType<typeof buildTechInspectionDraft>;
};

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const normalizeDraftPhotos = (photos: unknown): UploadedPhoto[] => {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos.map((photo, index) => {
    const photoRecord = photo as Record<string, unknown>;
    return {
      id: String(photoRecord.id || `draft-photo-${index}`),
      name: String(photoRecord.name || ""),
      preview: String(photoRecord.preview || ""),
      note: String(photoRecord.note || ""),
    };
  });
};

const normalizeConditionPhotoState = (photos: unknown): ConditionPhotoState => {
  const baseState = createEmptyConditionPhotoState();

  if (!photos || typeof photos !== "object") {
    return baseState;
  }

  return Object.entries(photos as Record<string, unknown>).reduce<ConditionPhotoState>(
    (acc, [shot, photo]) => {
      const photoRecord = (photo || {}) as Record<string, unknown>;
      acc[shot] = {
        ...acc[shot],
        name: String(photoRecord.name || ""),
        preview: String(photoRecord.preview || ""),
        note: String(photoRecord.note || ""),
      };
      return acc;
    },
    baseState
  );
};

function StatusPill({ value }: StatusPillProps) {
  const map = {
    ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
    sug: "bg-amber-100 text-amber-700 border-amber-200",
    req: "bg-red-100 text-red-700 border-red-200",
    empty: "bg-slate-100 text-slate-500 border-slate-200",
  };

  const text = value ? value.toUpperCase() : "PENDING";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${map[value || "empty"]}`}>
      {text}
    </span>
  );
}

function ConditionSelect({ value, onChange }: ConditionSelectProps) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-12 w-full px-4 text-base">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        {conditionOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="min-h-12 px-4 py-3 text-base">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-slate-200 p-2">
        <Icon className="h-5 w-5 text-slate-800" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm text-slate-700">{subtitle}</p>
      </div>
    </div>
  );
}

function formatMileageIntervalLabel(mileage: number) {
  if (mileage <= 0) {
    return "Baseline check";
  }

  return `${new Intl.NumberFormat("en-US").format(mileage)} miles`;
}

function groupScheduleItems(interval: MaintenanceScheduleInterval | null) {
  if (!interval) {
    return [];
  }

  const grouped = interval.items.reduce<Record<string, typeof interval.items>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return Object.entries(grouped);
}

function QuickConditionButtons({
  value,
  onChange,
}: {
  value: InspectionStatus;
  onChange: (value: RecommendationStatus) => void;
}) {
  const options: {
    value: Exclude<InspectionStatus, "" | null | undefined>;
    label: string;
    selectedClassName: string;
    unselectedClassName: string;
  }[] = [
    {
      value: "ok",
      label: "OK",
      selectedClassName: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
      unselectedClassName: "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300",
    },
    {
      value: "sug",
      label: "Suggested",
      selectedClassName: "border-amber-500 bg-amber-500 text-white shadow-sm",
      unselectedClassName: "border-amber-200 bg-white text-amber-700 hover:border-amber-300",
    },
    {
      value: "req",
      label: "Required",
      selectedClassName: "border-red-600 bg-red-600 text-white shadow-sm",
      unselectedClassName: "border-red-200 bg-white text-red-700 hover:border-red-300",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              selected
                ? option.selectedClassName
                : option.unselectedClassName
            }`}
            aria-pressed={selected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StepCompletionToggle({
  checked,
  onCheckedChange,
  label,
}: StepCompletionToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`w-full rounded-2xl border px-4 py-4 text-left text-black shadow-sm transition-colors sm:px-5 ${
        checked
          ? "border-emerald-500 bg-emerald-100"
          : "border-red-300 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="text-base font-bold text-black">Step completion</div>
          <div className="mt-1 text-sm font-medium text-black">{label}</div>
        </div>

        <div
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border-2 sm:min-h-12 sm:min-w-12 ${
            checked
              ? "border-emerald-700 bg-emerald-200 text-black"
              : "border-red-500 bg-white text-black"
          }`}
          aria-hidden="true"
        >
          {checked ? (
            <Check className="h-6 w-6" />
          ) : (
            <span
              className="block size-6 rounded-md border-2 border-current"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="mt-3 text-sm font-semibold text-black">
        {checked ? "Completed. Tap to mark incomplete." : "Tap anywhere in this box to mark complete."}
      </div>
    </button>
  );
}

type TechnicianWorkspacePageProps = {
  initialJobId?: string | null;
  initialDraftId?: string | null;
  queueHref?: string;
};

export function TechnicianWorkspacePage({
  initialJobId = null,
  initialDraftId = null,
  queueHref = "/tech/jobs",
}: TechnicianWorkspacePageProps) {
  const initializedSelectionRef = useRef<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(initialDraftId);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [vehicle, setVehicle] = useState<VehicleState>(createEmptyVehicleState());

  const [tireData, setTireData] = useState<TireDataState>(createEmptyTireDataState);

  const [brakes, setBrakes] = useState<BrakeState>(createEmptyBrakeState);

  const [maintenance, setMaintenance] = useState<ChecklistState<MaintenanceItem>>(
    createEmptyChecklistState(maintenanceItems)
  );

  const [undercar, setUndercar] = useState<ChecklistState<UndercarItem>>(
    createEmptyChecklistState(undercarItems)
  );

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [preServicePhotos, setPreServicePhotos] = useState<ConditionPhotoState>(createEmptyConditionPhotoState);
  const [postWorkPhotos, setPostWorkPhotos] = useState<ConditionPhotoState>(createEmptyConditionPhotoState);

  const [vehicleFieldFormatWarnings, setVehicleFieldFormatWarnings] = useState<
    Partial<Record<VehicleFieldKey, string | null>>
  >({});

  const normalizeVehicleFieldValue = (key: VehicleFieldKey, value: string) => {
    switch (key) {
      case "phone":
        return formatPhoneNumber(value);
      case "email":
        return normalizeEmail(value);
      case "year":
        return normalizeYear(value);
      case "mileage":
        return formatMileage(value);
      case "vin":
        return normalizeVin(value);
      case "licensePlate":
        return normalizeLicensePlate(value);
      default:
        return value;
    }
  };

  const formatWarningForVehicleField = (key: VehicleFieldKey, raw: string): string | null => {
    switch (key) {
      case "phone":
        return getPhoneInputWarning(raw);
      case "email":
        return getEmailInputWarning(raw);
      case "year":
        return getYearInputWarning(raw);
      case "mileage":
        return getMileageInputWarning(raw);
      case "vin":
        return getVinInputWarning(raw);
      case "licensePlate":
        return getLicensePlateInputWarning(raw);
      default:
        return null;
    }
  };

  const updateVehicle = (key: VehicleFieldKey, value: string) => {
    setVehicleFieldFormatWarnings((prev) => ({
      ...prev,
      [key]: formatWarningForVehicleField(key, value),
    }));
    setVehicle((prev) => ({ ...prev, [key]: normalizeVehicleFieldValue(key, value) }));
  };

  const updateTire = (tire: TirePosition, key: TireFieldKey, value: string) => {
    setTireData((prev) => ({
      ...prev,
      [tire]: {
        ...prev[tire],
        [key]: value,
      },
    }));
  };

  const toggleTireFlag = (tire: TirePosition, flag: string) => {
    setTireData((prev) => {
      const exists = prev[tire].flags.includes(flag);
      return {
        ...prev,
        [tire]: {
          ...prev[tire],
          flags: exists ? prev[tire].flags.filter((f) => f !== flag) : [...prev[tire].flags, flag],
        },
      };
    });
  };

  const updateMaintenance = (item: MaintenanceItem, key: ChecklistFieldKey, value: string) => {
    setMaintenance((prev) => ({ ...prev, [item]: { ...prev[item], [key]: value } }));
  };

  const updateUndercar = (item: UndercarItem, key: ChecklistFieldKey, value: string) => {
    setUndercar((prev) => ({ ...prev, [item]: { ...prev[item], [key]: value } }));
  };

  const [savedInspectionId, setSavedInspectionId] = useState<string | null>(null);
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null);
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("vehicle");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [useCustomMake, setUseCustomMake] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [useCustomEngineSize, setUseCustomEngineSize] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [jobUpdateSaving, setJobUpdateSaving] = useState(false);
  const [activeJobStatus, setActiveJobStatus] = useState("new_request");
  const [activeJobIntakeState, setActiveJobIntakeState] = useState<string | null>(null);
  const [activeJobNotes, setActiveJobNotes] = useState("");
  const [activeJobServiceType, setActiveJobServiceType] = useState<string | null>(null);
  const [activeJobServiceDescription, setActiveJobServiceDescription] = useState("");
  const [activeJobServiceAddress, setActiveJobServiceAddress] = useState("");
  const [activeJobScheduledStart, setActiveJobScheduledStart] = useState<string | null>(null);
  const [activeJobScheduledEnd, setActiveJobScheduledEnd] = useState<string | null>(null);
  const [activeJobServiceChecklistStartedAt, setActiveJobServiceChecklistStartedAt] = useState<string | null>(null);
  const [activeJobServiceChecklistCompletedAt, setActiveJobServiceChecklistCompletedAt] = useState<string | null>(null);
  const [jobServices, setJobServices] = useState<JobServiceRow[]>([]);
  const [jobCustomerUpdates, setJobCustomerUpdates] = useState<JobCustomerUpdateRow[]>([]);
  const [jobUpdatesLoading, setJobUpdatesLoading] = useState(false);
  const [sendingCustomerUpdate, setSendingCustomerUpdate] = useState(false);
  const [jobServiceSavingId, setJobServiceSavingId] = useState<string | null>(null);
  const [jobFlowActionPending, setJobFlowActionPending] = useState<string | null>(null);
  const [sectionSavingStep, setSectionSavingStep] = useState<string | null>(null);
  const [customerUpdateType, setCustomerUpdateType] = useState<JobCustomerUpdateType>("status");
  const [customerUpdateTitle, setCustomerUpdateTitle] = useState("");
  const [customerUpdateMessage, setCustomerUpdateMessage] = useState("");
  const [customerUpdateVisibility, setCustomerUpdateVisibility] = useState<"internal" | "customer">("customer");
  const [recordSyncState, setRecordSyncState] = useState("idle");
  const [recordSyncMessage, setRecordSyncMessage] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepsState>(createEmptyWorkflowSteps);

  const inspectionMode = useMemo(
    () => getInspectionModeFromServiceType(activeJobServiceType),
    [activeJobServiceType]
  );

  const activeWorkflowStepOrder = useMemo(
    () => (inspectionMode === "full" ? workflowStepOrder : abbreviatedWorkflowStepOrder),
    [inspectionMode]
  );

  const activeMaintenanceItems = useMemo(
    () => (inspectionMode === "full" ? maintenanceItems : abbreviatedMaintenanceItems),
    [inspectionMode]
  );

  const activeUndercarItems = useMemo(
    () => (inspectionMode === "full" ? undercarItems : abbreviatedUndercarItems),
    [inspectionMode]
  );

  const completion = useMemo(() => {
    let total = 0;
    let completed = 0;

    const requiredFields = [vehicle.firstName, vehicle.lastName, vehicle.year, vehicle.make, vehicle.model, vehicle.techName];
    requiredFields.forEach((field) => {
      total += 1;
      if (String(field).trim()) completed += 1;
    });

    total += 1;
    if (String(vehicle.mileage).trim()) completed += 1;

    if (inspectionMode === "full") {
      tires.forEach((tire) => {
        total += 1;
        if (tireData[tire].status) completed += 1;
      });

      total += 1;
      if (brakes.status) completed += 1;
    }

    total += 1;
    if (vehicle.notes.trim()) completed += 1;

    return Math.round((completed / total) * 100);
  }, [vehicle, tireData, brakes, inspectionMode]);
  
  const onPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((file) => ({
  id: `${file.name}-${file.size}-${Date.now()}`,
  name: file.name,
  file,
  preview: URL.createObjectURL(file),
  note: "",
}));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const updatePhotoNote = (id: string, note: string) => {
    setPhotos((prev) => prev.map((photo) => (photo.id === id ? { ...photo, note } : photo)));
  };

  const onConditionPhotoUpload = (
    stage: "pre" | "post",
    shot: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setter = stage === "pre" ? setPreServicePhotos : setPostWorkPhotos;

    setter((prev) => ({
      ...prev,
      [shot]: {
  ...prev[shot],
  name: file.name,
  file,
  preview: URL.createObjectURL(file),
},
    }));
  };

  const updateConditionPhotoNote = (
    stage: "pre" | "post",
    shot: string,
    note: string
  ) => {
    const setter = stage === "pre" ? setPreServicePhotos : setPostWorkPhotos;

    setter((prev) => ({
      ...prev,
      [shot]: {
        ...prev[shot],
        note,
      },
    }));
  };

  const preServiceCompletionCount = useMemo(
    () => Object.values(preServicePhotos).filter((photo) => photo.preview).length,
    [preServicePhotos]
  );

  const postWorkCompletionCount = useMemo(
    () => Object.values(postWorkPhotos).filter((photo) => photo.preview).length,
    [postWorkPhotos]
  );

  const summaryCounts = useMemo(() => {
    const statuses: Record<RecommendationStatus, number> = { ok: 0, sug: 0, req: 0 };
    const isRecommendationStatus = (value: InspectionStatus): value is RecommendationStatus =>
      value === "ok" || value === "sug" || value === "req";

    if (inspectionMode === "full") {
      Object.values(tireData).forEach((t) => {
        if (isRecommendationStatus(t.status)) statuses[t.status] += 1;
      });
      if (isRecommendationStatus(brakes.status)) statuses[brakes.status] += 1;
    }
    activeMaintenanceItems.forEach((item) => {
      if (isRecommendationStatus(maintenance[item].status)) statuses[maintenance[item].status] += 1;
    });
    activeUndercarItems.forEach((item) => {
      if (isRecommendationStatus(undercar[item].status)) statuses[undercar[item].status] += 1;
    });
    return statuses;
  }, [tireData, maintenance, undercar, brakes.status, inspectionMode, activeMaintenanceItems, activeUndercarItems]);

  const completedWorkflowCount = useMemo(
    () => activeWorkflowStepOrder.filter((step) => workflowSteps[step]).length,
    [activeWorkflowStepOrder, workflowSteps]
  );

  const maintenanceSchedulePreview = useMemo(
    () =>
      getMaintenanceSchedulePreview({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        mileage: vehicle.mileage,
      }),
    [vehicle.year, vehicle.make, vehicle.model, vehicle.mileage]
  );

  const activeJobAddressLabel = useMemo(
    () => activeJobServiceAddress.trim(),
    [activeJobServiceAddress]
  );

  const activeJobAppointmentLabel = useMemo(() => {
    if (!activeJobScheduledStart) return "";

    try {
      const start = new Date(activeJobScheduledStart).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      if (!activeJobScheduledEnd) {
        return start;
      }

      const end = new Date(activeJobScheduledEnd).toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });

      return `${start} - ${end}`;
    } catch {
      return activeJobScheduledStart;
    }
  }, [activeJobScheduledEnd, activeJobScheduledStart]);

  const activeJobStatusLabel = useMemo(
    () => (activeJobStatus || "new_request").replaceAll("_", " "),
    [activeJobStatus]
  );

  const activeJobIntakeStateLabel = useMemo(
    () => (activeJobIntakeState || "claimed").replaceAll("_", " "),
    [activeJobIntakeState]
  );

  const completedPlannedWorkCount = useMemo(
    () => jobServices.filter((service) => Boolean(service.completed_at)).length,
    [jobServices]
  );

  const allPlannedWorkDone = useMemo(
    () => jobServices.length > 0 && completedPlannedWorkCount === jobServices.length,
    [completedPlannedWorkCount, jobServices.length]
  );

  const activeJobGoogleMapsUrl = useMemo(() => {
    const q = activeJobAddressLabel.trim();
    if (!q) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [activeJobAddressLabel]);

  const activeJobAppleMapsUrl = useMemo(() => {
    const d = activeJobAddressLabel.trim();
    if (!d) return "";
    return `https://maps.apple.com/?daddr=${encodeURIComponent(d)}&dirflg=d`;
  }, [activeJobAddressLabel]);

  useEffect(() => {
    if (!activeJobId) {
      setJobCustomerUpdates([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setJobUpdatesLoading(true);
      try {
        const updates = await fetchJobCustomerUpdates(activeJobId);
        if (!cancelled) {
          setJobCustomerUpdates(updates);
        }
      } catch {
        if (!cancelled) {
          setJobCustomerUpdates([]);
        }
      } finally {
        if (!cancelled) {
          setJobUpdatesLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeJobId]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeJobId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("composeUpdate") !== "1") return;
    const fallback = techCustomerUpdateTemplates.find((item) => item.id === "status");
    setCustomerUpdateType("status");
    setCustomerUpdateTitle(fallback?.title || "Service status update");
    setCustomerUpdateMessage(fallback?.message || "");
  }, [activeJobId]);

  const getMissingRequiredReasonMessage = useCallback(() => {
    const missingMaintenanceReason = activeMaintenanceItems.find(
      (item) =>
        maintenance[item].status === "req" &&
        !String(maintenance[item].why || "").trim()
    );

    if (missingMaintenanceReason) {
      return `Add a reason for required maintenance item: ${missingMaintenanceReason}.`;
    }

    const missingUndercarReason = activeUndercarItems.find(
      (item) =>
        undercar[item].status === "req" &&
        !String(undercar[item].why || "").trim()
    );

    if (missingUndercarReason) {
      return `Add a reason for required undercar item: ${missingUndercarReason}.`;
    }

    return null;
  }, [maintenance, undercar, activeMaintenanceItems, activeUndercarItems]);

  const setActiveJobStageState = useCallback(
    async ({
      intakeState,
      status,
      extraPatch,
      successMessage,
    }: {
      intakeState?: string | null;
      status?: string | null;
      extraPatch?: Record<string, unknown>;
      successMessage?: string;
    }) => {
      if (!activeJobId) {
        throw new Error("Load a job before updating its workflow.");
      }

      if (intakeState) {
        const { error: rpcError } = await supabase.rpc("update_job_intake_state", {
          p_job_id: activeJobId,
          p_intake_state: intakeState,
          p_status: status ?? null,
        });

        if (rpcError) {
          const { error: directError } = await supabase
            .from("jobs")
            .update({
              intake_state: intakeState,
              ...(status ? { status } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", activeJobId);

          if (directError) {
            throw directError;
          }
        }

        setActiveJobIntakeState(intakeState);
      }

      if (status) {
        setActiveJobStatus(status);
      }

      if (extraPatch && Object.keys(extraPatch).length > 0) {
        const { error: patchError } = await supabase
          .from("jobs")
          .update({
            ...extraPatch,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeJobId);

        if (patchError) {
          throw patchError;
        }

        if ("service_checklist_started_at" in extraPatch) {
          setActiveJobServiceChecklistStartedAt(
            (extraPatch.service_checklist_started_at as string | null) ?? null
          );
        }

        if ("service_checklist_completed_at" in extraPatch) {
          setActiveJobServiceChecklistCompletedAt(
            (extraPatch.service_checklist_completed_at as string | null) ?? null
          );
        }
      }

      if (successMessage) {
        setRecordSyncState("saved");
        setRecordSyncMessage(successMessage);
      }
    },
    [activeJobId]
  );

  const saveJobTimelineUpdate = useCallback(
    async ({
      updateType,
      title,
      message,
      visibility = "customer",
    }: {
      updateType: JobCustomerUpdateType;
      title: string;
      message: string;
      visibility?: "customer" | "internal";
    }) => {
      if (!activeJobId) {
        throw new Error("Load a job before sending an update.");
      }

      await createJobCustomerUpdate({
        job_id: activeJobId,
        update_type: updateType,
        status_snapshot: activeJobStatus || null,
        title,
        message,
        visibility,
      });

      const updates = await fetchJobCustomerUpdates(activeJobId);
      setJobCustomerUpdates(updates);
    },
    [activeJobId, activeJobStatus]
  );

  const toggleWorkflowStep = (step: string, value: boolean) => {
    setWorkflowSteps((prev) => ({
      ...prev,
      [step]: value,
    }));
  };

  const getSavedDraftsFromStorage = useCallback((): SavedTechDraft[] => {
    if (typeof window === "undefined") return [];

    try {
      const storedDrafts = window.localStorage.getItem(TECH_SAVED_DRAFTS_STORAGE_KEY);
      return storedDrafts ? JSON.parse(storedDrafts) : [];
    } catch (error) {
      console.error("Failed to load saved technician drafts:", error);
      return [];
    }
  }, []);

  const applyDraftState = useCallback((draft: ReturnType<typeof buildTechInspectionDraft>) => {
    const vehicleSnapshot = draft.vehicle || {};
    const vehicleCatalogModes = getVehicleCatalogModes({
      year: vehicleSnapshot.year,
      make: vehicleSnapshot.make,
      model: vehicleSnapshot.model,
      engineSize: vehicleSnapshot.engineSize,
    });

    setVehicle({
      ...createEmptyVehicleState(String(vehicleSnapshot.techName || "")),
      ...vehicleSnapshot,
      state: resolveUsStateForForm(String(vehicleSnapshot.state ?? "")),
    });
    setTireData({
      ...createEmptyTireDataState(),
      ...(draft.tireData || {}),
    });
    setBrakes({
      ...createEmptyBrakeState(),
      ...(draft.brakes || {}),
    });
    setMaintenance({
      ...createEmptyChecklistState(maintenanceItems),
      ...(draft.maintenance || {}),
    });
    setUndercar({
      ...createEmptyChecklistState(undercarItems),
      ...(draft.undercar || {}),
    });
    setPhotos(normalizeDraftPhotos(draft.photos));
    setPreServicePhotos(normalizeConditionPhotoState(draft.preServicePhotos));
    setPostWorkPhotos(normalizeConditionPhotoState(draft.postWorkPhotos));
    setWorkflowSteps({
      ...createEmptyWorkflowSteps(),
      ...(draft.workflowSteps || {}),
    });
    setSavedInspectionId(draft.savedInspectionId || null);
    setSavedCustomerId(draft.savedCustomerId || null);
    setSavedVehicleId(draft.savedVehicleId || null);
    setUseCustomMake(vehicleCatalogModes.useCustomMake);
    setUseCustomModel(vehicleCatalogModes.useCustomModel);
    setUseCustomEngineSize(vehicleCatalogModes.useCustomEngineSize);
  }, []);

  const handleLoadJob = useCallback(async (job: TechnicianJob) => {
    try {
      const [customerResult, vehicleResult, inspectionResult, jobServicesResult] = await Promise.all([
        job.customer_id
          ? supabase
              .from("customers")
              .select("*")
              .eq("id", job.customer_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        job.vehicle_id
          ? supabase
              .from("vehicles")
              .select("*")
              .eq("id", job.vehicle_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        job.customer_id && job.vehicle_id
          ? supabase
              .from("inspections")
              .select("*")
              .eq("customer_id", job.customer_id)
              .eq("vehicle_id", job.vehicle_id)
              .order("created_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("job_services")
          .select("id, job_id, service_name, service_description, sort_order, completed_at")
          .eq("job_id", job.id)
          .order("sort_order", { ascending: true }),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (vehicleResult.error) throw vehicleResult.error;
      if (inspectionResult.error) throw inspectionResult.error;
      if (jobServicesResult.error) throw jobServicesResult.error;

      const customerData = customerResult.data;
      const vehicleData = vehicleResult.data;
      const inspectionData = inspectionResult.data?.[0] ?? null;
      const nextTechName =
        inspectionData?.tech_name ||
        technicians.find((tech) => tech.id === currentUserId)?.label ||
        "";

      setVehicle({
        ...createEmptyVehicleState(nextTechName),
        firstName: customerData?.first_name ?? "",
        lastName: customerData?.last_name ?? "",
        phone: customerData?.phone ?? "",
        email: customerData?.email ?? "",
        year: vehicleData?.year ? String(vehicleData.year) : "",
        make: vehicleData?.make ?? "",
        model: vehicleData?.model ?? "",
        mileage: vehicleData?.mileage ? formatMileage(vehicleData.mileage) : "",
        vin: vehicleData?.vin ?? "",
        engineSize: vehicleData?.engine_size ?? "",
        licensePlate: vehicleData?.license_plate ?? "",
        state: resolveUsStateForForm(vehicleData?.state),
        transmission: vehicleData?.transmission ?? "",
        driveline: vehicleData?.driveline ?? "",
        notes: inspectionData?.notes ?? "",
        obdCode: inspectionData?.obd_code ?? "",
      });
      setTireData({
        ...createEmptyTireDataState(),
        ...(inspectionData?.tire_data || {}),
      });
      setBrakes({
        ...createEmptyBrakeState(),
        ...(inspectionData?.brakes || {}),
      });
      setMaintenance({
        ...createEmptyChecklistState(maintenanceItems),
        ...(inspectionData?.maintenance || {}),
      });
      setUndercar({
        ...createEmptyChecklistState(undercarItems),
        ...(inspectionData?.undercar || {}),
      });
      setPhotos([]);
      setPreServicePhotos(createEmptyConditionPhotoState());
      setPostWorkPhotos(createEmptyConditionPhotoState());
      setWorkflowSteps({
        ...createEmptyWorkflowSteps(),
        ...(inspectionData?.inspection_summary?.workflow_steps || {}),
      });
      setSavedInspectionId(inspectionData?.id ?? null);
      setSavedCustomerId(customerData?.id ?? null);
      setSavedVehicleId(vehicleData?.id ?? null);
      setActiveJobId(job.id);
      setActiveJobStatus(job.status || "new_request");
      setActiveJobIntakeState(job.intake_state || "claimed");
      setActiveJobNotes(job.notes || "");
      setActiveJobServiceType(job.service_type || null);
      setActiveJobServiceDescription(job.service_description || "");
      setActiveJobServiceAddress(
        [job.service_location_name, job.service_address, job.service_city, job.service_state, job.service_zip]
          .filter(Boolean)
          .join(", ")
      );
      setActiveJobScheduledStart(job.scheduled_start || null);
      setActiveJobScheduledEnd(job.scheduled_end || null);
      setActiveJobServiceChecklistStartedAt(job.service_checklist_started_at || null);
      setActiveJobServiceChecklistCompletedAt(job.service_checklist_completed_at || null);
      setJobServices((jobServicesResult.data || []) as JobServiceRow[]);
      setActiveTab("vehicle");

      const vehicleCatalogModes = getVehicleCatalogModes({
        year: vehicleData?.year,
        make: vehicleData?.make,
        model: vehicleData?.model,
        engineSize: vehicleData?.engine_size,
      });
      setUseCustomMake(vehicleCatalogModes.useCustomMake);
      setUseCustomModel(vehicleCatalogModes.useCustomModel);
      setUseCustomEngineSize(vehicleCatalogModes.useCustomEngineSize);

      setRecordSyncState("saved");
      setRecordSyncMessage(
        `Loaded job ${job.business_job_number || job.id.slice(0, 8)} for ${
          [customerData?.first_name, customerData?.last_name].filter(Boolean).join(" ") || "customer"
        }.`
      );
    } catch (error) {
      console.error("Failed to load technician job:", error);
      alert(getErrorMessage(error, "Failed to load that job."));
    }
  }, [currentUserId, technicians]);

  const loadJobById = useCallback(async (jobId: string) => {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        customer_id,
        vehicle_id,
        business_job_number,
        service_type,
        service_description,
        service_location_name,
        service_address,
        service_city,
        service_state,
        service_zip,
        status,
        notes,
        assigned_tech_user_id,
        intake_state,
        scheduled_start,
        scheduled_end,
        service_checklist_started_at,
        service_checklist_completed_at,
        created_at,
        requested_date,
        customer:customers(first_name, last_name, email, phone),
        vehicle:vehicles(year, make, model, license_plate, vin)
      `)
      .eq("id", jobId)
      .single();

    if (error) throw error;
    await handleLoadJob({
      ...data,
      customer: getSingleRelation(data.customer),
      vehicle: getSingleRelation(data.vehicle),
    });
  }, [handleLoadJob]);

  const hasMeaningfulDraftContent = useCallback(() => {
    const hasVehicleDetails = Object.entries(vehicle).some(([key, value]) => {
      if (key === "techName") return false;
      return String(value || "").trim().length > 0;
    });

    const hasTireDetails = Object.values(tireData).some(
      (entry) =>
        entry.status ||
        entry.psiIn ||
        entry.psiOut ||
        entry.treadOuter ||
        entry.treadInner ||
        entry.flags.length ||
        entry.recommendation
    );

    const hasBrakeDetails = Object.entries(brakes).some(
      ([key, value]) => key !== "status" ? String(value || "").trim().length > 0 : Boolean(value)
    );

    const hasChecklistDetails =
      [...Object.values(maintenance), ...Object.values(undercar)].some(
        (entry) => entry.status || String(entry.why || "").trim()
      );

    const hasPhotoDetails =
      photos.length > 0 ||
      Object.values(preServicePhotos).some((photo) => photo.preview || photo.name || photo.note) ||
      Object.values(postWorkPhotos).some((photo) => photo.preview || photo.name || photo.note);

    return (
      hasVehicleDetails ||
      hasTireDetails ||
      hasBrakeDetails ||
      hasChecklistDetails ||
      hasPhotoDetails ||
      savedInspectionId ||
      savedCustomerId ||
      savedVehicleId
    );
  }, [
    vehicle,
    tireData,
    brakes,
    maintenance,
    undercar,
    photos,
    preServicePhotos,
    postWorkPhotos,
    savedInspectionId,
    savedCustomerId,
    savedVehicleId,
  ]);

  const resetInspectionForm = useCallback((techName = vehicle.techName) => {
    setVehicle(createEmptyVehicleState(techName));
    setTireData(createEmptyTireDataState());
    setBrakes(createEmptyBrakeState());
    setMaintenance(createEmptyChecklistState(maintenanceItems));
    setUndercar(createEmptyChecklistState(undercarItems));
    setPhotos([]);
    setPreServicePhotos(createEmptyConditionPhotoState());
    setPostWorkPhotos(createEmptyConditionPhotoState());
    setWorkflowSteps(createEmptyWorkflowSteps());
    setSavedInspectionId(null);
    setSavedCustomerId(null);
    setSavedVehicleId(null);
    setActiveJobId(null);
    setActiveTab("vehicle");
    setActiveJobStatus("new_request");
    setActiveJobIntakeState(null);
    setActiveJobNotes("");
    setActiveJobServiceType(null);
    setActiveJobServiceDescription("");
    setActiveJobServiceAddress("");
    setActiveJobScheduledStart(null);
    setActiveJobScheduledEnd(null);
    setActiveJobServiceChecklistStartedAt(null);
    setActiveJobServiceChecklistCompletedAt(null);
    setJobServices([]);
    setJobCustomerUpdates([]);
    setCustomerUpdateType("status");
    setCustomerUpdateTitle("");
    setCustomerUpdateMessage("");
    setCustomerUpdateVisibility("customer");
    setRecordSyncState("idle");
    setRecordSyncMessage("");
    setUseCustomMake(false);
    setUseCustomModel(false);
    setUseCustomEngineSize(false);
  }, [vehicle.techName]);

  const archiveCurrentDraft = useCallback(() => {
    if (typeof window === "undefined" || !hasMeaningfulDraftContent()) {
      return false;
    }

    const draft = buildTechInspectionDraft({
      vehicle,
      tireData,
      brakes,
      maintenance,
      undercar,
      photos,
      preServicePhotos,
      postWorkPhotos,
      workflowSteps,
      savedInspectionId,
      savedCustomerId,
      savedVehicleId,
    });

    const title =
      [vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") ||
      [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
      "Untitled draft";

    const subtitle = [
      vehicle.email,
      vehicle.licensePlate,
    ]
      .filter(Boolean)
      .join(" • ");

    const nextDraft: SavedTechDraft = {
      id: `${Date.now()}`,
      title,
      subtitle: subtitle || "Technician inspection draft",
      savedAt: draft.savedAt,
      draft,
    };

    try {
      const existingDrafts = window.localStorage.getItem(TECH_SAVED_DRAFTS_STORAGE_KEY);
      const parsedDrafts: SavedTechDraft[] = existingDrafts ? JSON.parse(existingDrafts) : [];
      const nextDrafts = [nextDraft, ...parsedDrafts].slice(0, 20);
      window.localStorage.setItem(TECH_SAVED_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts));
      return true;
    } catch (error) {
      console.error("Failed to archive technician draft:", error);
      return false;
    }
  }, [
    hasMeaningfulDraftContent,
    vehicle,
    tireData,
    brakes,
    maintenance,
    undercar,
    photos,
    preServicePhotos,
    postWorkPhotos,
    workflowSteps,
    savedInspectionId,
    savedCustomerId,
    savedVehicleId,
  ]);

  const handleStartNewCustomer = () => {
    const draftArchived = archiveCurrentDraft();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TECH_DRAFT_STORAGE_KEY);
    }

    resetInspectionForm(vehicle.techName);
    setRecordSyncState("saved");
    setRecordSyncMessage(
      draftArchived
        ? "Draft saved. The form is ready for a new customer."
        : "Started a new customer record."
    );
  };

  const handleSaveActiveJob = async () => {
    if (!activeJobId) {
      alert("Load a job before updating it.");
      return;
    }

    setJobUpdateSaving(true);

    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          status: activeJobStatus,
          intake_state: activeJobIntakeState,
          notes: activeJobNotes.trim() || null,
          assigned_tech_user_id: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeJobId);

      if (error) throw error;

      setRecordSyncState("saved");
      setRecordSyncMessage("Job details updated.");
    } catch (error) {
      console.error("Failed to update technician job:", error);
      alert(getErrorMessage(error, "Failed to update the job."));
    } finally {
      setJobUpdateSaving(false);
    }
  };

  const handleUseCustomerUpdateTemplate = (updateType: JobCustomerUpdateType) => {
    setCustomerUpdateType(updateType);
    const match = techCustomerUpdateTemplates.find((item) => item.id === updateType);
    if (!match) return;
    setCustomerUpdateTitle(match.title);
    setCustomerUpdateMessage(match.message);
  };

  const handleSendCustomerUpdate = async () => {
    if (!activeJobId) {
      alert("Load a job before sending an update.");
      return;
    }
    const title = customerUpdateTitle.trim();
    const message = customerUpdateMessage.trim();
    if (!title || !message) {
      alert("Add both a title and message before sending.");
      return;
    }

    setSendingCustomerUpdate(true);
    try {
      await createJobCustomerUpdate({
        job_id: activeJobId,
        update_type: customerUpdateType,
        status_snapshot: activeJobStatus || null,
        title,
        message,
        visibility: customerUpdateVisibility,
      });
      const updates = await fetchJobCustomerUpdates(activeJobId);
      setJobCustomerUpdates(updates);
      setRecordSyncState("saved");
      setRecordSyncMessage(
        customerUpdateVisibility === "customer"
          ? "Customer update sent and saved to the job timeline."
          : "Internal update saved to the job timeline.",
      );
      setCustomerUpdateTitle("");
      setCustomerUpdateMessage("");
    } catch (error) {
      alert(getErrorMessage(error, "Failed to send customer update."));
    } finally {
      setSendingCustomerUpdate(false);
    }
  };

  const handleDeleteActiveJob = async () => {
    if (!activeJobId) {
      alert("Load a job before deleting it.");
      return;
    }

    if (activeJobStatus === "completed") {
      alert("Completed jobs cannot be deleted from the technician portal.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this incomplete job? This deletion will be logged in the admin deleted job history."
    );

    if (!confirmed) {
      return;
    }

    setJobUpdateSaving(true);

    try {
      await deleteJobWithRelatedRecords(activeJobId);
      resetInspectionForm(vehicle.techName);
      setSelectedJobId(null);

      if (typeof window !== "undefined") {
        window.location.href = queueHref;
      }

      setRecordSyncState("saved");
      setRecordSyncMessage("Job deleted. The form is ready for a new customer.");
    } catch (error) {
      console.error("Failed to delete active job:", error);
      alert(getErrorMessage(error, "Failed to delete the job."));
    } finally {
      setJobUpdateSaving(false);
    }
  };

  const togglePlannedWorkItem = async (service: JobServiceRow, next: boolean) => {
    if (!currentUserId) {
      alert("You must be signed in to update planned work.");
      return;
    }

    setJobServiceSavingId(service.id);

    try {
      const completedAt = next ? new Date().toISOString() : null;
      const { error } = await supabase
        .from("job_services")
        .update({
          completed_at: completedAt,
          completed_by_user_id: next ? currentUserId : null,
        })
        .eq("id", service.id);

      if (error) throw error;

      setJobServices((prev) =>
        prev.map((row) =>
          row.id === service.id
            ? {
                ...row,
                completed_at: completedAt,
              }
            : row
        )
      );
    } catch (error) {
      alert(getErrorMessage(error, "Failed to update planned work."));
    } finally {
      setJobServiceSavingId(null);
    }
  };

  const runGuidedFlowAction = useCallback(
    async (
      actionKey: string,
      work: () => Promise<void>
    ) => {
      setJobFlowActionPending(actionKey);
      try {
        await work();
      } catch (error) {
        console.error(`Guided job action failed (${actionKey}):`, error);
        alert(getErrorMessage(error, "Failed to update the job flow."));
      } finally {
        setJobFlowActionPending(null);
      }
    },
    []
  );

  const handleMarkArrived = useCallback(() => {
    void runGuidedFlowAction("arrival", async () => {
      await setActiveJobStageState({
        intakeState: "on_site",
        status: "in_progress",
        successMessage: "Arrival recorded. The customer can now see that the technician is on site.",
      });
      await saveJobTimelineUpdate({
        updateType: "arrival",
        title: "Technician is on site",
        message:
          "Your technician has arrived on site and is beginning the service visit.",
      });
    });
  }, [runGuidedFlowAction, saveJobTimelineUpdate, setActiveJobStageState]);

  const handleBeginInspectionFlow = useCallback(() => {
    void runGuidedFlowAction("inspection", async () => {
      const startedAt = activeJobServiceChecklistStartedAt || new Date().toISOString();
      await setActiveJobStageState({
        intakeState: "in_service",
        status: "in_progress",
        extraPatch: {
          service_checklist_started_at: startedAt,
        },
        successMessage: "Service is now in progress.",
      });
      setActiveTab("vehicle");
    });
  }, [activeJobServiceChecklistStartedAt, runGuidedFlowAction, setActiveJobStageState]);

  const handleMarkWaitingOnParts = useCallback(() => {
    void runGuidedFlowAction("waiting-parts", async () => {
      await setActiveJobStageState({
        intakeState: "waiting_parts",
        status: "in_progress",
        successMessage: "Job moved to waiting on parts.",
      });
      await saveJobTimelineUpdate({
        updateType: "parts_delay",
        title: "Waiting on parts",
        message:
          "We are waiting on parts for your vehicle and will resume work as soon as they arrive.",
      });
    });
  }, [runGuidedFlowAction, saveJobTimelineUpdate, setActiveJobStageState]);

  const handleRequestAddedWorkApproval = useCallback(() => {
    void runGuidedFlowAction("approval", async () => {
      await setActiveJobStageState({
        intakeState: "awaiting_customer_approval",
        status: "in_progress",
        successMessage: "Added work approval request sent. The job is paused until the customer responds.",
      });
      await saveJobTimelineUpdate({
        updateType: "customer_approval",
        title: "Additional work needs approval",
        message:
          "We found additional work that needs your approval before service can continue. Please review the recommendation in your customer portal.",
      });
      setActiveTab("customer-report");
    });
  }, [runGuidedFlowAction, saveJobTimelineUpdate, setActiveJobStageState]);

  const handleResumeApprovedWork = useCallback(() => {
    void runGuidedFlowAction("resume", async () => {
      await setActiveJobStageState({
        intakeState: "in_service",
        status: "in_progress",
        successMessage: "Job resumed after customer approval.",
      });
      setActiveTab("maintenance");
    });
  }, [runGuidedFlowAction, setActiveJobStageState]);

  const handleCompletePlannedWorkSection = useCallback(() => {
    void runGuidedFlowAction("planned-work", async () => {
      if (jobServices.length > 0 && !allPlannedWorkDone) {
        const ok = window.confirm(
          "Some planned work items are still open. Mark this section complete anyway?"
        );
        if (!ok) return;
      }

      const completedAt = new Date().toISOString();
      await setActiveJobStageState({
        extraPatch: {
          service_checklist_completed_at: completedAt,
        },
        successMessage: "Planned work checklist completed.",
      });
      setActiveTab("maintenance");
    });
  }, [allPlannedWorkDone, jobServices.length, runGuidedFlowAction, setActiveJobStageState]);

  const ensureCustomerProfile = async (vehicleSnapshot = vehicle) => {
    const validationError = getCustomerProfileValidationError(vehicleSnapshot);
    if (validationError) {
      throw new Error(validationError);
    }

    const normalizedEmail = String(vehicleSnapshot.email || "").trim().toLowerCase();
    const customerPayload = buildCustomerPayload(vehicleSnapshot);
    let customerData;
    let vehicleData;

    if (savedCustomerId) {
      const { data: existingSavedCustomer, error: savedCustomerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", savedCustomerId)
        .maybeSingle();

      if (savedCustomerError) throw savedCustomerError;
      customerData = existingSavedCustomer;
    }

    if (!customerData) {
      const { data: existingCustomers, error: findCustomerError } = await supabase
        .from("customers")
        .select("*")
        .eq("email", normalizedEmail)
        .limit(2);

      if (findCustomerError) throw findCustomerError;
      if ((existingCustomers?.length || 0) > 1) {
        throw new Error(
          "Multiple customer profiles use this email. Please open the customer record from the manager customer list or use a unique email before saving."
        );
      }

      customerData = existingCustomers && existingCustomers.length > 0 ? existingCustomers[0] : null;
    }

    if (customerData) {
      if (savedCustomerId && customerData.id !== savedCustomerId) {
        throw new Error("This email is already linked to a different customer profile.");
      }

      const { data: emailConflicts, error: emailConflictError } = await supabase
        .from("customers")
        .select("id")
        .eq("email", normalizedEmail)
        .neq("id", customerData.id)
        .limit(1);

      if (emailConflictError) throw emailConflictError;
      if ((emailConflicts?.length || 0) > 0) {
        throw new Error("This email is already linked to a different customer profile.");
      }

      const { error: updateCustomerError } = await supabase
        .from("customers")
        .update(customerPayload)
        .eq("id", customerData.id);

      if (updateCustomerError) throw updateCustomerError;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([customerPayload])
        .select()
        .single();

      if (customerError) throw customerError;
      customerData = newCustomer;
    }

    const vehiclePayload = buildVehiclePayload(vehicleSnapshot, customerData.id);
    let vehicleMatchId = savedVehicleId;

    if (!vehicleMatchId && vehiclePayload.vin) {
      const { data: existingVehicleByVin, error: existingVehicleByVinError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("customer_id", customerData.id)
        .eq("vin", vehiclePayload.vin)
        .limit(1);

      if (existingVehicleByVinError) throw existingVehicleByVinError;
      vehicleMatchId = existingVehicleByVin?.[0]?.id ?? null;
    }

    if (!vehicleMatchId && vehiclePayload.license_plate) {
      const { data: existingVehicleByPlate, error: existingVehicleByPlateError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("customer_id", customerData.id)
        .eq("license_plate", vehiclePayload.license_plate)
        .limit(1);

      if (existingVehicleByPlateError) throw existingVehicleByPlateError;
      vehicleMatchId = existingVehicleByPlate?.[0]?.id ?? null;
    }

    if (vehicleMatchId) {
      const { data: updatedVehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .update(vehiclePayload)
        .eq("id", vehicleMatchId)
        .select()
        .single();

      if (vehicleError) throw vehicleError;
      vehicleData = updatedVehicleData;
    } else {
      const { data: newVehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .insert([vehiclePayload])
        .select()
        .single();

      if (vehicleError) throw vehicleError;
      vehicleData = newVehicleData;
    }

    setSavedCustomerId(customerData.id);
    setSavedVehicleId(vehicleData.id);

    return { customerData, vehicleData };
  };

  const upsertInspectionDraft = async (
    customerId: string,
    vehicleId: string,
    workflowState: WorkflowStepsState = workflowSteps
  ) => {
    const inspectionPayload = buildInspectionPayload({
      customerId,
      vehicleId,
      vehicle,
      brakes,
      tireData,
      maintenance,
      undercar,
      summaryCounts,
      workflowState,
      workflowTotalCount: activeWorkflowStepOrder.length,
    });

    const { data: inspectionData, error: inspectionError } = savedInspectionId
      ? await supabase
          .from("inspections")
          .update(inspectionPayload)
          .eq("id", savedInspectionId)
          .select()
          .single()
      : await supabase
          .from("inspections")
          .insert([inspectionPayload])
          .select()
          .single();

    if (inspectionError) throw inspectionError;

    setSavedInspectionId(inspectionData.id);
    return inspectionData;
  };

  const syncCustomerProfileAndInspection = async ({
    vehicleSnapshot = vehicle,
    workflowState = workflowSteps,
    successMessage = "Customer profile saved.",
  } = {}) => {
    setRecordSyncState("saving");
    setRecordSyncMessage("Saving customer and vehicle profile...");

    try {
      const { customerData, vehicleData } = await ensureCustomerProfile(vehicleSnapshot);
      const inspectionData = await upsertInspectionDraft(
        customerData.id,
        vehicleData.id,
        workflowState
      );

      setRecordSyncState("saved");
      setRecordSyncMessage(successMessage);

      return { customerData, vehicleData, inspectionData };
    } catch (error) {
      setRecordSyncState("error");
      setRecordSyncMessage(getErrorMessage(error, "Failed to save customer profile."));
      throw error;
    }
  };

  const syncInspectionProgress = async (
    workflowState: WorkflowStepsState = workflowSteps,
    successMessage = "Inspection progress saved."
  ) => {
    setRecordSyncState("saving");
    setRecordSyncMessage("Saving inspection progress...");

    try {
      let customerId = savedCustomerId;
      let vehicleId = savedVehicleId;

      if (!customerId || !vehicleId) {
        const { customerData, vehicleData } = await ensureCustomerProfile();
        customerId = customerData.id;
        vehicleId = vehicleData.id;
      }

      if (!customerId || !vehicleId) {
        throw new Error("Customer and vehicle must be saved before inspection progress can be recorded.");
      }

      const inspectionData = await upsertInspectionDraft(customerId, vehicleId, workflowState);

      setRecordSyncState("saved");
      setRecordSyncMessage(successMessage);

      return inspectionData;
    } catch (error) {
      setRecordSyncState("error");
      setRecordSyncMessage(getErrorMessage(error, "Failed to save inspection progress."));
      throw error;
    }
  };

  const handleVehicleProfileBlur = async (
    vehicleOverrides: Partial<VehicleState> = {}
  ) => {
    if (
      !workflowSteps.vehicle &&
      !savedCustomerId &&
      !savedVehicleId &&
      !savedInspectionId
    ) {
      return;
    }

    const vehicleSnapshot = {
      ...vehicle,
      ...vehicleOverrides,
    };

    if (getCustomerProfileValidationError(vehicleSnapshot)) {
      return;
    }

    try {
      await syncCustomerProfileAndInspection({
        vehicleSnapshot,
        successMessage: "Customer profile updated.",
      });
    } catch (error) {
      console.error("Failed to sync customer profile after vehicle edit:", error);
    }
  };

  const handleWorkflowStepCompletionChange = async (
    step: string,
    value: boolean
  ) => {
    if (value) {
      const missingRequiredReasonMessage = getMissingRequiredReasonMessage();
      if (missingRequiredReasonMessage) {
        alert(missingRequiredReasonMessage);
        return;
      }
    }

    const nextWorkflowSteps = {
      ...workflowSteps,
      [step]: value,
    };

    if (step === "vehicle" && value) {
      try {
        await syncCustomerProfileAndInspection({
          workflowState: nextWorkflowSteps,
          successMessage:
            "Customer profile created and inspection progress is now linked to the customer portal.",
        });
        toggleWorkflowStep("vehicle", true);
      } catch (error) {
        console.error("Failed to save customer profile from vehicle step:", error);
        alert(getErrorMessage(error, "Failed to save customer profile."));
      }

      return;
    }

    toggleWorkflowStep(step, value);

    if (
      !savedCustomerId &&
      !savedVehicleId &&
      !savedInspectionId &&
      !workflowSteps.vehicle
    ) {
      return;
    }

    try {
      await syncInspectionProgress(
        nextWorkflowSteps,
        `${workflowStepLabels[step]} saved.`
      );
    } catch (error) {
      console.error(`Failed to save ${step} workflow progress:`, error);
      alert(getErrorMessage(error, "Failed to save inspection progress."));
    }
  };

  const handleSaveSection = async (step: string) => {
    setSectionSavingStep(step);

    try {
      if (step === "vehicle") {
        await syncCustomerProfileAndInspection({
          workflowState: workflowSteps,
          successMessage: "Customer and vehicle information saved.",
        });
        return;
      }

      await syncInspectionProgress(workflowSteps, `${workflowStepLabels[step]} saved.`);
    } catch (error) {
      console.error(`Failed to save ${step} section:`, error);
      alert(getErrorMessage(error, "Failed to save this section."));
    } finally {
      setSectionSavingStep(null);
    }
  };

  const hasFilledInspectionContent = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return !Number.isNaN(value) && value !== 0;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.some(hasFilledInspectionContent);
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).some(
        hasFilledInspectionContent
      );
    }
    return false;
  };

  const getWorkflowStepStatus = (step: string) => {
    if (workflowSteps[step]) {
      return "Complete";
    }

    const isWorking = (() => {
      switch (step) {
        case "vehicle":
          return [
            vehicle.firstName,
            vehicle.lastName,
            vehicle.phone,
            vehicle.email,
            vehicle.year,
            vehicle.make,
            vehicle.model,
            vehicle.vin,
            vehicle.licensePlate,
            vehicle.techName,
          ].some(hasFilledInspectionContent);
        case "mileage":
          return (
            hasFilledInspectionContent(vehicle.mileage) ||
            hasFilledInspectionContent(vehicle.obdCode) ||
            Boolean(maintenanceSchedulePreview)
          );
        case "tires":
          return hasFilledInspectionContent(tireData);
        case "brakes":
          return hasFilledInspectionContent(brakes);
        case "maintenance":
          return (
            hasFilledInspectionContent(maintenance) ||
            hasFilledInspectionContent(undercar)
          );
        case "photos":
          return (
            photos.some((photo) => Boolean(photo.file || photo.preview)) ||
            Object.values(preServicePhotos).some(hasFilledInspectionContent) ||
            Object.values(postWorkPhotos).some(hasFilledInspectionContent)
          );
        case "customer-report":
          return (
            hasFilledInspectionContent(vehicle.notes) ||
            summaryCounts.ok > 0 ||
            summaryCounts.sug > 0 ||
            summaryCounts.req > 0
          );
        case "review":
          return completedWorkflowCount > 0;
        default:
          return false;
      }
    })();

    return isWorking ? "Working" : "Waiting";
  };

  const getStepTriggerClassName = (step: string) => {
    const status = getWorkflowStepStatus(step);
    const baseClassName =
      "group flex h-full min-h-[3.75rem] min-w-[5.25rem] flex-1 flex-col gap-0.5 rounded-xl border px-2 py-1.5 text-center font-semibold leading-tight text-black shadow-sm transition-all duration-200 whitespace-normal break-words sm:min-h-[4.25rem] sm:min-w-[6rem] sm:gap-1 sm:px-3 sm:py-2 lg:min-w-0 data-[state=active]:-translate-y-0.5 data-[state=active]:border-2 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-offset-1 data-[state=active]:ring-offset-slate-200 sm:data-[state=active]:ring-offset-2";

    if (status === "Complete") {
      return `${baseClassName} border-emerald-400 bg-emerald-100 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-200 data-[state=active]:ring-emerald-300`;
    }

    if (status === "Working") {
      return `${baseClassName} border-amber-400 bg-amber-100 data-[state=active]:border-amber-600 data-[state=active]:bg-amber-200 data-[state=active]:ring-amber-200`;
    }

    return `${baseClassName} border-red-300 bg-red-50 data-[state=active]:border-red-700 data-[state=active]:bg-red-100 data-[state=active]:ring-red-200`;
  };

  const saveDraftToLocal = useCallback(() => {
    if (typeof window === "undefined") return;

    const draft = buildTechInspectionDraft({
      vehicle,
      tireData,
      brakes,
      maintenance,
      undercar,
      photos,
      preServicePhotos,
      postWorkPhotos,
      workflowSteps,
      savedInspectionId,
      savedCustomerId,
      savedVehicleId,
    });

    window.localStorage.setItem(TECH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    vehicle,
    tireData,
    brakes,
    maintenance,
    undercar,
    photos,
    preServicePhotos,
    postWorkPhotos,
    workflowSteps,
    savedInspectionId,
    savedCustomerId,
    savedVehicleId,
  ]);

  const handleSaveInspection = async () => {
  const missingRequiredReasonMessage = getMissingRequiredReasonMessage();
  if (missingRequiredReasonMessage) {
    alert(missingRequiredReasonMessage);
    return;
  }

  try {
    const { customerData, vehicleData } = await ensureCustomerProfile();

    const inspectionPayload = buildInspectionPayload({
      customerId: customerData.id,
      vehicleId: vehicleData.id,
      vehicle,
      brakes,
      tireData,
      maintenance,
      undercar,
      summaryCounts,
      workflowState: workflowSteps,
      workflowTotalCount: activeWorkflowStepOrder.length,
    });

    const { data: inspectionData, error: inspectionError } = savedInspectionId
      ? await supabase
          .from("inspections")
          .update(inspectionPayload)
          .eq("id", savedInspectionId)
          .select()
          .single()
      : await supabase
          .from("inspections")
          .insert([inspectionPayload])
          .select()
          .single();

    if (inspectionError) throw inspectionError;

   type UploadedPhotoRow = {
     inspection_id: string;
     photo_stage: string;
     shot_label: string | null;
     file_name: string;
     file_url: string;
     note: string | null;
   };

   const uploadedPhotoRows: UploadedPhotoRow[] = [];
   const { data: existingPhotoRows, error: existingPhotoError } = await supabase
     .from("inspection_photos")
     .select("photo_stage, shot_label, file_name, note")
     .eq("inspection_id", inspectionData.id);

   if (existingPhotoError) throw existingPhotoError;

   const buildPhotoDedupeKey = (
     photoRow: Pick<UploadedPhotoRow, "photo_stage" | "shot_label" | "file_name" | "note">
   ) =>
     [
       photoRow.photo_stage || "",
       photoRow.shot_label || "",
       photoRow.file_name || "",
       photoRow.note || "",
     ].join("::");

   const existingPhotoKeys = new Set(
     (existingPhotoRows || []).map((photoRow) => buildPhotoDedupeKey(photoRow))
   );

   const uploadPhotoIfNew = async ({
     photo,
     stage,
     shotLabel,
     folder,
   }: {
     photo: { file?: File; note?: string | null } | null | undefined;
     stage: string;
     shotLabel: string | null;
     folder: string;
   }) => {
     if (!photo?.file) return;

     const photoRow = {
       inspection_id: inspectionData.id,
       photo_stage: stage,
       shot_label: shotLabel,
       file_name: photo.file.name,
       file_url: "",
       note: photo.note || null,
     };
     const photoKey = buildPhotoDedupeKey(photoRow);

     if (existingPhotoKeys.has(photoKey)) {
       return;
     }

     const filePath = `${inspectionData.id}/${folder}/${shotLabel ? `${shotLabel}-` : ""}${Date.now()}-${photo.file.name}`;

     const { error: uploadError } = await supabase.storage
       .from("inspection-photos")
       .upload(filePath, photo.file);

     if (uploadError) throw uploadError;

     uploadedPhotoRows.push({
       ...photoRow,
       file_url: filePath,
     });
   };

for (const shot of requiredConditionShots) {
  await uploadPhotoIfNew({
    photo: preServicePhotos[shot],
    stage: "pre_service",
    shotLabel: shot,
    folder: "pre-service",
  });
}

for (const photo of photos) {
  await uploadPhotoIfNew({
    photo,
    stage: "inspection",
    shotLabel: null,
    folder: "inspection",
  });
}

for (const shot of requiredConditionShots) {
  await uploadPhotoIfNew({
    photo: postWorkPhotos[shot],
    stage: "post_work",
    shotLabel: shot,
    folder: "post-work",
  });
}

if (uploadedPhotoRows.length > 0) {
  const { error: photoError } = await supabase
    .from("inspection_photos")
    .insert(uploadedPhotoRows);

  if (photoError) throw photoError;
}

    alert("Inspection saved successfully.");
    console.log("Saved inspection:", inspectionData.id);
    setSavedInspectionId(inspectionData.id);
    setSavedCustomerId(customerData.id);
    setSavedVehicleId(vehicleData.id);
    saveDraftToLocal();
  } catch (error) {
  console.error("Save failed full error:", JSON.stringify(error, null, 2));
  console.error("Save failed raw error:", error);
  alert(`Save failed: ${getErrorMessage(error, "Unknown error")}`);
}
};

const handleGeneratePdf = async () => {
  try {
    if (!savedInspectionId || !savedCustomerId) {
      alert("Please save the inspection before generating the PDF report.");
      return;
    }

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = 20;

    const primary: RgbColor = [15, 23, 42];
    const lightGray: RgbColor = [241, 245, 249];
    const darkText: RgbColor = [30, 41, 59];
    const green: RgbColor = [22, 163, 74];
    const amber: RgbColor = [217, 119, 6];
    const red: RgbColor = [220, 38, 38];

    const addPageIfNeeded = (neededHeight = 12) => {
      if (y + neededHeight > pageHeight - 18) {
        doc.addPage();
        y = 20;
      }
    };

    const addSectionTitle = (title: string) => {
      addPageIfNeeded(16);
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...darkText);
      doc.text(title, margin + 4, y + 6.8);
      y += 16;
    };

    const addParagraph = (text: string, indent = margin) => {
      const normalizedText = text
        .replaceAll("â€”", "-")
        .replaceAll("â€¢", "-")
        .replaceAll("â†’", "->");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...darkText);
      const wrapped = doc.splitTextToSize(normalizedText || "-", pageWidth - indent - margin);
      wrapped.forEach((line: string) => {
        addPageIfNeeded(6);
        doc.text(line, indent, y);
        y += 5.5;
      });
    };

    const drawSummaryBox = (
      x: number,
      title: string,
      value: string | number,
      fill: RgbColor,
      textColor: RgbColor
    ) => {
      doc.setFillColor(...fill);
      doc.roundedRect(x, y, 55, 24, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...textColor);
      doc.text(title, x + 4, y + 7);
      doc.setFontSize(18);
      doc.text(String(value), x + 4, y + 18);
    };

    const isFilledPdfValue = (value: unknown) =>
      typeof value === "string"
        ? value.trim().length > 0
        : hasFilledInspectionContent(value);

    const addLabeledParagraphIfFilled = (
      label: string,
      value: unknown,
      formatter?: (value: string) => string,
    ) => {
      const rawValue = String(value ?? "").trim();
      if (!rawValue) return;
      addParagraph(`${label}: ${formatter ? formatter(rawValue) : rawValue}`);
    };

    const recommendedItems = getInspectionRecommendations({
      maintenance,
      undercar,
      brakes,
      tireData,
      tires,
    });

    doc.setFillColor(...primary);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("OnTheGo Maintenance", margin + 5, y + 10);

    doc.setFontSize(14);
    doc.text("Vehicle Inspection Report", margin + 5, y + 19);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Prepared: ${new Date().toLocaleDateString()}`, pageWidth - 55, y + 10);
    doc.text(`Tech: ${vehicle.techName || "-"}`, pageWidth - 55, y + 19);

    y += 36;

    {
      const isFilledPdfValue = (value: unknown) =>
        typeof value === "string"
          ? value.trim().length > 0
          : hasFilledInspectionContent(value);

      const addLabeledParagraphIfFilled = (
        label: string,
        value: unknown,
        formatter?: (value: string) => string,
      ) => {
        const rawValue = String(value ?? "").trim();
        if (!rawValue) return;
        addParagraph(`${label}: ${formatter ? formatter(rawValue) : rawValue}`);
      };

      const customerName = [vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ").trim();
      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
      const plateLabel = [String(vehicle.licensePlate || "").trim(), String(vehicle.state || "").trim()]
        .filter(Boolean)
        .join(" ");

      if (
        [
          customerName,
          vehicle.phone,
          vehicle.email,
          vehicleLabel,
          vehicle.mileage,
          vehicle.vin,
          plateLabel,
          vehicle.techName,
          vehicle.obdCode,
        ].some(isFilledPdfValue)
      ) {
        addSectionTitle("Customer and Vehicle Information");
        addLabeledParagraphIfFilled("Customer", customerName);
        addLabeledParagraphIfFilled("Phone", vehicle.phone);
        addLabeledParagraphIfFilled("Email", vehicle.email);
        addLabeledParagraphIfFilled("Vehicle", vehicleLabel);
        addLabeledParagraphIfFilled("Mileage", vehicle.mileage);
        addLabeledParagraphIfFilled("VIN", vehicle.vin);
        addLabeledParagraphIfFilled("Plate", plateLabel);
        addLabeledParagraphIfFilled("Technician", vehicle.techName);
        addLabeledParagraphIfFilled("OBD Code", vehicle.obdCode);
        y += 3;
      }

      addSectionTitle("Inspection Summary");
      drawSummaryBox(margin, "OK", summaryCounts.ok, [220, 252, 231], green);
      drawSummaryBox(margin + 59, "Suggested", summaryCounts.sug, [254, 243, 199], amber);
      drawSummaryBox(margin + 118, "Required", summaryCounts.req, [254, 226, 226], red);
      y += 32;

      if (recommendedItems.length) {
        addSectionTitle("Recommended Services");
        recommendedItems.forEach((item) => addParagraph(`- ${item}`));
        y += 3;
      }

      if (hasFilledInspectionContent(brakes)) {
        addSectionTitle("Brake Findings");
        addLabeledParagraphIfFilled("Status", brakes.status);
        addLabeledParagraphIfFilled("LF Pad", brakes.lfPad);
        addLabeledParagraphIfFilled("RF Pad", brakes.rfPad);
        addLabeledParagraphIfFilled("LR Pad/Shoe", brakes.lrPad);
        addLabeledParagraphIfFilled("RR Pad/Shoe", brakes.rrPad);
        addLabeledParagraphIfFilled("LF Rotor/Drum", brakes.lfRotor);
        addLabeledParagraphIfFilled("RF Rotor/Drum", brakes.rfRotor);
        addLabeledParagraphIfFilled("LR Rotor/Drum", brakes.lrRotor);
        addLabeledParagraphIfFilled("RR Rotor/Drum", brakes.rrRotor);
        addLabeledParagraphIfFilled("Notes", brakes.brakeNotes);
        y += 3;
      }

      const filledTireEntries = tires.filter((tire) => {
        const tireEntry = tireData[tire];
        const visibleFlags = tireEntry.flags.filter((flag) => flag !== spareUnavailableFlag);
        return (
          tireEntry.flags.includes(spareUnavailableFlag) ||
          isFilledPdfValue(tireEntry.psiIn) ||
          isFilledPdfValue(tireEntry.psiOut) ||
          isFilledPdfValue(tireEntry.treadOuter) ||
          isFilledPdfValue(tireEntry.treadInner) ||
          isFilledPdfValue(tireEntry.status) ||
          visibleFlags.length > 0 ||
          isFilledPdfValue(tireEntry.recommendation)
        );
      });

      if (filledTireEntries.length) {
        addSectionTitle("Tire Findings");
        filledTireEntries.forEach((tire) => {
          const tireEntry = tireData[tire];
          const visibleFlags = tireEntry.flags.filter((flag) => flag !== spareUnavailableFlag);
          const tireParts = [];

          if (tireEntry.flags.includes(spareUnavailableFlag)) {
            tireParts.push(spareUnavailableFlag);
          } else {
            if (tireEntry.status) tireParts.push(`Status ${tireEntry.status}`);
            if (tireEntry.psiIn || tireEntry.psiOut) {
              tireParts.push(`PSI ${tireEntry.psiIn || "?"} -> ${tireEntry.psiOut || "?"}`);
            }
            if (tireEntry.treadOuter || tireEntry.treadInner) {
              tireParts.push(`Tread ${tireEntry.treadOuter || "?"} / ${tireEntry.treadInner || "?"}`);
            }
          }

          addParagraph(`${tire}: ${tireParts.join(" | ")}`);

          if (visibleFlags.length) {
            addParagraph(`Flags: ${visibleFlags.join(", ")}`, margin + 4);
          }

          if (tireEntry.recommendation) {
            addParagraph(`Recommendation: ${tireEntry.recommendation}`, margin + 4);
          }
        });
        y += 3;
      }

      if (String(vehicle.notes || "").trim()) {
        addSectionTitle("Technician Notes");
        addParagraph(vehicle.notes);
      }

      const safeCustomer = ([vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "customer").replace(/[^a-z0-9]/gi, "_");
      const safeVehicle = [vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join("_")
        .replace(/[^a-z0-9]/gi, "_");

      const fileName = `${safeCustomer}_${safeVehicle || "vehicle"}_inspection_report.pdf`;
      const pdfBlob = doc.output("blob");
      const pdfPath = `${savedCustomerId}/${savedInspectionId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inspection-reports")
        .upload(pdfPath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: reportInsertError } = await supabase
        .from("inspection_reports")
        .upsert(
          [
            {
              inspection_id: savedInspectionId,
              customer_id: savedCustomerId,
              pdf_path: pdfPath,
            },
          ],
          { onConflict: "inspection_id" }
        );

      if (reportInsertError) throw reportInsertError;

      doc.save(fileName);
      alert("PDF generated, uploaded, and linked successfully.");
      return;
    }

    addSectionTitle("Customer and Vehicle Information");
    addParagraph(`Customer: ${[vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "—"}`);
    addParagraph(`Phone: ${vehicle.phone || "-"}`);
    addParagraph(`Email: ${vehicle.email || "-"}`);
    addParagraph(`Vehicle: ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "-"}`);
    addParagraph(`Mileage: ${vehicle.mileage || "-"}`);
    addParagraph(`VIN: ${vehicle.vin || "-"}`);
    y += 3;

    addSectionTitle("Inspection Summary");
    drawSummaryBox(margin, "OK", summaryCounts.ok, [220, 252, 231], green);
    drawSummaryBox(margin + 59, "Suggested", summaryCounts.sug, [254, 243, 199], amber);
    drawSummaryBox(margin + 118, "Required", summaryCounts.req, [254, 226, 226], red);
    y += 32;

    addSectionTitle("Recommended Services");
    if (recommendedItems.length) {
      recommendedItems.forEach((item) => addParagraph(`• ${item}`));
    } else {
      addParagraph("No immediate service recommendations were recorded.");
    }
    y += 3;

    addSectionTitle("Brake Findings");
    addParagraph(`Status: ${brakes.status || "-"}`);
    addParagraph(`LF Pad: ${brakes.lfPad || "-"} | RF Pad: ${brakes.rfPad || "-"}`);
    addParagraph(`LR Pad/Shoe: ${brakes.lrPad || "-"} | RR Pad/Shoe: ${brakes.rrPad || "-"}`);
    addParagraph(`LF Rotor/Drum: ${brakes.lfRotor || "-"} | RF Rotor/Drum: ${brakes.rfRotor || "-"}`);
    addParagraph(`LR Rotor/Drum: ${brakes.lrRotor || "-"} | RR Rotor/Drum: ${brakes.rrRotor || "-"}`);
    addParagraph(`Notes: ${brakes.brakeNotes || "No brake notes recorded."}`);
    y += 3;

    addSectionTitle("Tire Findings");
    tires.forEach((tire) => {
      const tireEntry = tireData[tire];
      const isSpareUnavailable = tireEntry.flags.includes(spareUnavailableFlag);
      const tireSummary = isSpareUnavailable
        ? `${tire}: ${spareUnavailableFlag}`
        : `${tire}: PSI ${tireEntry.psiIn || "-"} -> ${tireEntry.psiOut || "-"} | Tread ${tireEntry.treadOuter || "-"} / ${tireEntry.treadInner || "-"} | Status ${tireEntry.status || "pending"}`;
      addParagraph(tireSummary);

      const visibleFlags = isSpareUnavailable
        ? tireEntry.flags.filter((flag) => flag !== spareUnavailableFlag)
        : tireEntry.flags;

      if (visibleFlags.length) {
        addParagraph(`Flags: ${visibleFlags.join(", ")}`, margin + 4);
      }

      if (tireEntry.recommendation) {
        addParagraph(`Recommendation: ${tireEntry.recommendation}`, margin + 4);
      }
    });
    y += 3;

    addSectionTitle("Technician Notes");
    addParagraph(vehicle.notes || "No technician notes were entered.");

    const safeCustomer = ([vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "customer").replace(/[^a-z0-9]/gi, "_");
    const safeVehicle = [vehicle.year, vehicle.make, vehicle.model]
      .filter(Boolean)
      .join("_")
      .replace(/[^a-z0-9]/gi, "_");

    const fileName = `${safeCustomer}_${safeVehicle || "vehicle"}_inspection_report.pdf`;
    const pdfBlob = doc.output("blob");
    const pdfPath = `${savedCustomerId}/${savedInspectionId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-reports")
      .upload(pdfPath, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { error: reportInsertError } = await supabase
      .from("inspection_reports")
      .upsert(
        [
          {
            inspection_id: savedInspectionId,
            customer_id: savedCustomerId,
            pdf_path: pdfPath,
          },
        ],
        { onConflict: "inspection_id" }
      );

    if (reportInsertError) throw reportInsertError;

    doc.save(fileName);
    alert("PDF generated, uploaded, and linked successfully.");
  } catch (error) {
    console.error("PDF generation failed:", error);
    alert(getErrorMessage(error, "There was a problem generating the PDF."));
  }
};

const handleCompleteGuidedJob = () => {
  void runGuidedFlowAction("complete-job", async () => {
    await handleSaveInspection();
    await setActiveJobStageState({
      intakeState: "completed",
      status: "completed",
      extraPatch: {
        notes: activeJobNotes.trim() || null,
        assigned_tech_user_id: currentUserId,
        service_checklist_completed_at:
          activeJobServiceChecklistCompletedAt || new Date().toISOString(),
      },
      successMessage: "Job marked complete.",
    });
    await saveJobTimelineUpdate({
      updateType: "service_complete",
      title: "Service complete",
      message:
        "Your service is complete. Review the inspection summary and follow-up notes in your customer portal.",
    });
  });
};

useEffect(() => {
  const checkAccess = async () => {
    const { user, roles: roleNames } = await getUserRoles();

    if (!user) {
      const next =
        typeof window === "undefined" ? "/tech" : `${window.location.pathname}${window.location.search}`;
      window.location.href = `/customer/login?next=${encodeURIComponent(next)}`;
      return;
    }

    if (hasPortalAccess(roleNames, "tech")) {
      setCurrentUserId(user.id);

      try {
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "technician");

        if (rolesError) throw rolesError;

        const technicianIds = (rolesData ?? []).map((row) => row.user_id);

        if (technicianIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email")
            .in("id", technicianIds);

          if (profileError) throw profileError;

          const technicianOptions = (profileData ?? [])
            .map((profile) => ({
              id: profile.id,
              label:
                `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                profile.email ||
                "Unnamed technician",
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

          setTechnicians(technicianOptions);

          const currentTech = technicianOptions.find((tech) => tech.id === user.id);
          if (currentTech) {
            setVehicle((prev) =>
              prev.techName ? prev : { ...prev, techName: currentTech.label }
            );
          }
        }
      } catch (error) {
        console.error("Failed to load technicians:", error);
      }

      setIsAuthorized(true);
      setAuthLoading(false);
      return;
    }

    window.location.href = getPostLoginRoute(roleNames);
  };

  void checkAccess();
}, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (initialDraftId || initialJobId) {
      setSelectedDraftId(initialDraftId);
      setSelectedJobId(initialJobId);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setSelectedDraftId(params.get("draftId"));
    setSelectedJobId(params.get("jobId"));
  }, [initialDraftId, initialJobId]);

useEffect(() => {
  if (typeof window === "undefined") return;

  const draftId = selectedDraftId;
  const jobId = selectedJobId;
  const selectionKey = draftId ? `draft:${draftId}` : jobId ? `job:${jobId}` : "landing";

  if (initializedSelectionRef.current === selectionKey) {
    return;
  }

  if (draftId) {
    try {
      const parsedDrafts = getSavedDraftsFromStorage() || [];
      const selectedDraft = parsedDrafts.find((draft) => draft.id === draftId);

      if (selectedDraft) {
        initializedSelectionRef.current = selectionKey;
        applyDraftState(selectedDraft.draft);
        setActiveJobId(null);
        setActiveJobStatus("new_request");
        setActiveJobIntakeState(null);
        setActiveJobNotes("");
        setActiveJobServiceDescription("");
        setActiveJobServiceAddress("");
        setActiveJobScheduledStart(null);
        setActiveJobScheduledEnd(null);
        setActiveJobServiceChecklistStartedAt(null);
        setActiveJobServiceChecklistCompletedAt(null);
        setJobServices([]);
        setDraftLoaded(true);
        return;
      }
    } catch (error) {
      console.error("Failed to load selected technician draft:", error);
    }
  }

  if (jobId) {
    if (!currentUserId) {
      return;
    }

    initializedSelectionRef.current = selectionKey;
    void loadJobById(jobId)
      .catch((error) => {
        console.error("Failed to load selected technician job:", error);
      })
      .finally(() => {
        setDraftLoaded(true);
      });
    return;
  }

  initializedSelectionRef.current = selectionKey;
  window.location.href = queueHref;
}, [applyDraftState, currentUserId, getSavedDraftsFromStorage, loadJobById, queueHref, selectedDraftId, selectedJobId]);

useEffect(() => {
  if (!draftLoaded) return;
  saveDraftToLocal();
}, [draftLoaded, saveDraftToLocal]);

const recommendedItems = getInspectionRecommendations({
  maintenance,
  undercar,
  brakes,
  tireData,
  tires,
});

const nextGuidedAction = (() => {
  if (!activeJobId) return null;
  if (activeJobStatus === "completed") {
    return {
      label: "Job completed",
      helper: "This service visit has already been closed out.",
      onClick: null as null | (() => void),
    };
  }

  if (!activeJobIntakeState || activeJobIntakeState === "claimed" || activeJobIntakeState === "queued") {
    return {
      label: "Start arrival",
      helper: "Mark the mechanic on site and notify the customer.",
      onClick: handleMarkArrived,
    };
  }

  if (activeJobIntakeState === "waiting_parts") {
    return {
      label: "Resume after parts arrive",
      helper: "Return the job to in-service once the needed parts are available.",
      onClick: handleResumeApprovedWork,
    };
  }

  if (activeJobIntakeState === "awaiting_customer_approval") {
    return {
      label: "Resume approved work",
      helper: "Use this after the customer approves the added work.",
      onClick: handleResumeApprovedWork,
    };
  }

  if (!workflowSteps.vehicle || !workflowSteps.mileage) {
    return {
      label: "Begin inspection",
      helper: "Finish the check-in details before moving into findings.",
      onClick: handleBeginInspectionFlow,
    };
  }

  if (jobServices.length > 0 && !activeJobServiceChecklistCompletedAt) {
    return {
      label: "Continue planned work",
      helper: "Check off the planned services and complete the work checklist section.",
      onClick: () => setActiveTab("maintenance"),
    };
  }

  if (!workflowSteps.review) {
    return {
      label: "Finish service",
      helper: "Wrap the inspection, photos, and customer report.",
      onClick: () => setActiveTab("review"),
    };
  }

  return {
    label: "Complete service",
    helper: "Send the final update and close the job.",
    onClick: handleCompleteGuidedJob,
  };
})();

if (authLoading) {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-md">
        <p className="text-slate-700">Loading...</p>
      </div>
    </div>
  );
}

if (!isAuthorized) {
  return null;
}


  return (
    <div className="otg-portal-dark min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-4 text-slate-900 md:p-8" onBlurCapture={saveDraftToLocal}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="flex flex-col gap-6 p-4 sm:p-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                  <BrandLogo priority />
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {activeJobId ? "Mobile Mechanic Guided Job Flow" : "Technician Inspection App"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-700">
                    {activeJobId
                      ? "Stay in one mobile workspace from arrival through inspection, approvals, and customer closeout."
                      : "Capture inspection results, upload photos, and prepare a customer-ready service report."}
                  </p>
                </div>
              <div className="w-full max-w-2xl space-y-4">
                <div className="flex justify-end">
                  <PortalTopNav section="tech" />
                </div>
                <div className="ml-auto w-full max-w-xs space-y-2 rounded-2xl bg-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">Inspection progress</span>
                    <span className="font-semibold">{completion}%</span>
                  </div>
                  <Progress value={completion} className="h-2" />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">OK: {summaryCounts.ok}</Badge>
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">Suggested: {summaryCounts.sug}</Badge>
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">Required: {summaryCounts.req}</Badge>
                  </div>
                  <div className="pt-2 text-sm text-slate-600">
                    Workflow steps complete: <span className="font-semibold text-slate-900">{completedWorkflowCount} / {activeWorkflowStepOrder.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeJobId && (
          <>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">Job {activeJobStatusLabel}</Badge>
                    <Badge variant="outline" className="rounded-full whitespace-normal text-center">{activeJobIntakeStateLabel}</Badge>
                    <Badge variant="outline" className="rounded-full whitespace-normal text-center">
                      {inspectionMode === "full" ? "Full inspection" : "Abbreviated inspection"}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                      Guided workspace for {vehicle.firstName || "customer"} {vehicle.lastName || ""}
                    </h2>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"} {" - "} Job #{activeJobId.slice(0, 8)}
                    </p>
                    {activeJobServiceDescription ? (
                      <p className="mt-2 break-words text-sm text-slate-600">{activeJobServiceDescription}</p>
                    ) : null}
                  </div>
                </div>
                <div className="w-full max-w-sm rounded-3xl border border-lime-300/70 bg-lime-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next action</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {nextGuidedAction?.label || "Load a job"}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {nextGuidedAction?.helper || "Choose a job from the queue to start."}
                  </p>
                  {nextGuidedAction?.onClick ? (
                    <Button
                      type="button"
                      className="mt-4 min-h-12 w-full whitespace-normal break-words rounded-2xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800"
                      disabled={jobFlowActionPending !== null}
                      onClick={nextGuidedAction.onClick}
                    >
                      {jobFlowActionPending ? "Working..." : nextGuidedAction.label}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-lime-600" />
                    Appointment
                  </div>
                  <div className="mt-2 break-words text-slate-600">
                    {activeJobAppointmentLabel || "No appointment window on file."}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-lime-600" />
                    Service location
                  </div>
                  <div className="mt-2 break-words text-slate-600">
                    {activeJobAddressLabel || "No service address on this job."}
                  </div>
                  {activeJobAddressLabel ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        className={mobilePrimaryButtonClassName}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(activeJobGoogleMapsUrl, "_blank", "noopener,noreferrer")}
                      >
                        Open map
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-semibold text-slate-900">Inspection progress</div>
                  <div className="mt-2 flex items-center justify-between text-slate-600">
                    <span>{completedWorkflowCount} of {activeWorkflowStepOrder.length} steps complete</span>
                    <span className="font-semibold text-slate-900">{completion}%</span>
                  </div>
                  <Progress value={completion} className="mt-3 h-2" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-semibold text-slate-900">Planned work</div>
                  <div className="mt-2 text-slate-600">
                    {jobServices.length > 0
                      ? `${completedPlannedWorkCount} of ${jobServices.length} line items completed`
                      : "No planned line items on this job."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">OK: {summaryCounts.ok}</Badge>
                    <Badge variant="secondary" className="rounded-full whitespace-normal text-center">Req: {summaryCounts.req}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleMarkArrived} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="block font-semibold">1. Arrive on site</span>
                    <span className="mt-1 block text-sm text-slate-600">Mark the mechanic on site and send the arrival update.</span>
                  </span>
                </Button>
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleBeginInspectionFlow} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="block font-semibold">2. Begin check-in</span>
                    <span className="mt-1 block text-sm text-slate-600">Move the job into service and jump into the inspection steps below.</span>
                  </span>
                </Button>
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleRequestAddedWorkApproval} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="block font-semibold">3. Pause for approval</span>
                    <span className="mt-1 block text-sm text-slate-600">Send the added-work approval request and pause the job in-flow.</span>
                  </span>
                </Button>
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleResumeApprovedWork} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="block font-semibold">4. Resume work</span>
                    <span className="mt-1 block text-sm text-slate-600">Continue service after approval or once the job is ready again.</span>
                  </span>
                </Button>
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleMarkWaitingOnParts} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="block font-semibold">5. Waiting on parts</span>
                    <span className="mt-1 block text-sm text-slate-600">Block the job clearly and notify the customer about the delay.</span>
                  </span>
                </Button>
                <Button type="button" variant="outline" disabled={jobFlowActionPending !== null || activeJobStatus === "completed"} onClick={handleCompleteGuidedJob} className={mobileCardActionButtonClassName}>
                  <span>
                    <span className="flex items-center gap-2 font-semibold">
                      <ArrowRight className="h-4 w-4 text-lime-600" />
                      6. Customer closeout
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">Save the inspection, send the final update, and mark the job completed.</span>
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="space-y-5 p-6">
              <SectionHeader icon={ClipboardCheck} title="Planned Work Checklist" subtitle="Track promised service items before final closeout." />
              {jobServices.length > 0 ? (
                <div className="space-y-3">
                  {jobServices.map((service) => (
                    <div key={service.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <Checkbox
                        id={`job-service-${service.id}`}
                        checked={Boolean(service.completed_at)}
                        disabled={jobServiceSavingId === service.id}
                        onCheckedChange={(checked) => void togglePlannedWorkItem(service, checked === true)}
                      />
                      <label htmlFor={`job-service-${service.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <div className="font-semibold text-slate-900">{service.service_name}</div>
                        {service.service_description ? (
                          <div className="mt-1 break-words text-sm text-slate-600">{service.service_description}</div>
                        ) : null}
                      </label>
                      <Badge variant={service.completed_at ? "secondary" : "outline"} className="rounded-full whitespace-normal text-center">
                        {service.completed_at ? "Done" : "Open"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No planned job service line items were found. The inspection workflow below is still available.
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button className={mobilePrimaryButtonClassName} type="button" onClick={handleCompletePlannedWorkSection} disabled={jobFlowActionPending !== null}>
                  {activeJobServiceChecklistCompletedAt ? "Planned work completed" : "Complete planned work section"}
                </Button>
                <Button className={mobilePrimaryButtonClassName} type="button" variant="outline" onClick={() => setActiveTab("maintenance")}>
                  Continue to findings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="space-y-2 md:w-56">
                  <Label>Active Job Status</Label>
                  <Select value={activeJobStatus} onValueChange={setActiveJobStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="new_request">New Request</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-2">
                  <Label>Inspection Mode</Label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {inspectionMode === "full" ? "Full Inspection" : "Abbreviated Inspection"}
                    </span>
                    <span className="ml-2 break-words">
                      {inspectionMode === "full"
                        ? "This job includes the full tire, brake, maintenance, photo, and report workflow."
                        : "This job uses a quicker maintenance-style inspection for services like oil changes, tune-ups, and repair work."}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <Label>Service Location</Label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {activeJobAddressLabel || "No service address on this job."}
                  </div>
                  {activeJobAddressLabel ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        className={mobilePrimaryButtonClassName}
                        type="button"
                        variant="outline"
                        onClick={() => window.open(activeJobGoogleMapsUrl, "_blank", "noopener,noreferrer")}
                      >
                        Open in Google Maps
                      </Button>
                      <Button
                        className={mobilePrimaryButtonClassName}
                        type="button"
                        variant="outline"
                        onClick={() => window.open(activeJobAppleMapsUrl, "_blank", "noopener,noreferrer")}
                      >
                        Open in Apple Maps
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex-1 space-y-2">
                  <Label>Job Notes</Label>
                  <Textarea
                    value={activeJobNotes}
                    onChange={(e) => setActiveJobNotes(e.target.value)}
                    className="bg-white"
                    placeholder="Add technician job notes"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {activeJobStatus !== "completed" && (
                    <Button
                      className={mobilePrimaryButtonClassName}
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteActiveJob}
                      disabled={jobUpdateSaving}
                    >
                      Delete Job
                    </Button>
                  )}

                  <Button
                    className={mobilePrimaryButtonClassName}
                    type="button"
                    onClick={handleSaveActiveJob}
                    disabled={jobUpdateSaving}
                  >
                    {jobUpdateSaving ? "Saving Job..." : "Save Job"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Label className="text-sm font-semibold">Customer Update Composer</Label>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {techCustomerUpdateTemplates.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant={customerUpdateType === template.id ? "default" : "outline"}
                        size="sm"
                        className="min-h-11 w-full whitespace-normal break-words px-3 py-2 text-center sm:w-auto"
                        onClick={() => handleUseCustomerUpdateTemplate(template.id)}
                      >
                        {template.id.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={customerUpdateTitle}
                      onChange={(e) => setCustomerUpdateTitle(e.target.value)}
                      placeholder="Update title"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      value={customerUpdateMessage}
                      onChange={(e) => setCustomerUpdateMessage(e.target.value)}
                      placeholder="What should the customer know?"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select
                      value={customerUpdateVisibility}
                      onValueChange={(value) => setCustomerUpdateVisibility(value as "internal" | "customer")}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer-visible</SelectItem>
                        <SelectItem value="internal">Internal only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className={mobilePrimaryButtonClassName} type="button" onClick={() => void handleSendCustomerUpdate()} disabled={sendingCustomerUpdate}>
                    {sendingCustomerUpdate ? "Sending Update..." : "Save Update"}
                  </Button>
                </div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Label className="text-sm font-semibold">Recent Job Updates</Label>
                  {jobUpdatesLoading ? (
                    <p className="text-sm text-slate-600">Loading updates...</p>
                  ) : jobCustomerUpdates.length === 0 ? (
                    <p className="text-sm text-slate-600">No updates saved yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {jobCustomerUpdates.slice(0, 6).map((update) => (
                        <div key={update.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="break-words font-semibold text-slate-900">{update.title}</p>
                            <Badge variant="outline" className="whitespace-normal text-center">{update.visibility}</Badge>
                          </div>
                          <p className="mt-1 break-words text-slate-700">{update.message}</p>
                          <p className="mt-1 break-words text-xs text-slate-500">
                            {new Date(update.created_at).toLocaleString()} • {(update.update_type || "general").replaceAll("_", " ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-6">
          <TabsList className="flex h-auto w-full flex-nowrap items-stretch justify-start gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-200 p-1.5 shadow-sm sm:gap-2 sm:p-2 lg:gap-3">
            {activeWorkflowStepOrder.map((step) => (
              <TabsTrigger
                key={step}
                value={step}
                className={getStepTriggerClassName(step)}
                aria-label={workflowStepLabels[step]}
                title={workflowStepLabels[step]}
              >
                <span className="block text-[11px] font-extrabold text-black sm:text-[13px] group-data-[state=active]:text-[12px] sm:group-data-[state=active]:text-sm">
                  {techWorkflowTabLabels[step] ?? workflowStepLabels[step]}
                </span>
                <span className="block text-[8px] font-bold uppercase tracking-[0.1em] text-black/80 sm:text-[10px] sm:tracking-[0.12em]">
                  {getWorkflowStepStatus(step)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="vehicle">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="space-y-6 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <SectionHeader icon={Car} title="Customer and vehicle information" subtitle="Start the inspection by capturing the service visit details." />
                </div>
                <StepCompletionToggle
                  checked={workflowSteps.vehicle}
                  onCheckedChange={(value) =>
                    handleWorkflowStepCompletionChange("vehicle", value)
                  }
                  label="Mark customer and vehicle information as complete."
                />
                {recordSyncMessage && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      recordSyncState === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : recordSyncState === "saved"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {recordSyncMessage}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    ["First Name", "firstName"],
                    ["Last Name", "lastName"],
                    ["Phone", "phone"],
                    ["Email", "email"],
                    ["VIN", "vin"],
                    ["License Plate", "licensePlate"],
                    ["State", "state"],
                    ["Technician Name", "techName"],
                  ] as const satisfies readonly (readonly [string, VehicleFieldKey])[]).map(([label, key]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {key === "state" ? (
                        <UsStateSelect
                          value={vehicle.state}
                          onChange={(code) => {
                            updateVehicle("state", code);
                            void handleVehicleProfileBlur();
                          }}
                          className="flex h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-base"
                        />
                      ) : key === "techName" && technicians.length > 0 ? (
                        <Select
                          value={vehicle.techName}
                          onValueChange={(value) => {
                            updateVehicle("techName", value);
                            void handleVehicleProfileBlur();
                          }}
                        >
                          <SelectTrigger className="h-12 px-4 text-base">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            {technicians.map((tech) => (
                              <SelectItem key={tech.id} value={tech.label} className="min-h-12 px-4 py-3 text-base">
                                {tech.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={vehicle[key]}
                          onChange={(e) => updateVehicle(key, e.target.value)}
                          onBlur={(e) => {
                            updateVehicle(key, e.target.value);
                            handleVehicleProfileBlur();
                          }}
                          inputMode={
                            key === "phone"
                              ? "tel"
                              : "text"
                          }
                          autoCapitalize={key === "vin" ? "characters" : "none"}
                          maxLength={
                            key === "phone"
                              ? 14
                              : key === "vin"
                                  ? 17
                                  : undefined
                          }
                          placeholder={
                            key === "phone"
                              ? "(555) 555-5555"
                              : key === "email"
                                ? "customer@example.com"
                                : key === "vin"
                                  ? "17-character VIN"
                                  : undefined
                          }
                          className="bg-white"
                        />
                      )}
                      {vehicleFieldFormatWarnings[key] ? (
                        <p className="text-xs text-amber-800">{vehicleFieldFormatWarnings[key]}</p>
                      ) : null}
                      {key === "email" && (
                        <p className="text-xs text-slate-500">
                          Required. Email is the main key we use to create and reconnect customer records.
                        </p>
                      )}
                      {key === "licensePlate" && (
                        <p className="text-xs text-slate-500">
                          Custom and specialty plates are okay. We only normalize spacing and capitalization.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <VehicleCatalogFields
                  year={vehicle.year}
                  make={vehicle.make}
                  model={vehicle.model}
                  engineSize={vehicle.engineSize}
                  licensePlate={vehicle.licensePlate}
                  vin={vehicle.vin}
                  useCustomMake={useCustomMake}
                  useCustomModel={useCustomModel}
                  useCustomEngineSize={useCustomEngineSize}
                  normalizeYear={normalizeYear}
                  normalizeVin={normalizeVin}
                  normalizeLicensePlate={normalizeLicensePlate}
                  setYear={(value) => updateVehicle("year", value)}
                  setMake={(value) => updateVehicle("make", value)}
                  setModel={(value) => updateVehicle("model", value)}
                  setEngineSize={(value) => updateVehicle("engineSize", value)}
                  setLicensePlate={(value) => updateVehicle("licensePlate", value)}
                  setVin={(value) => updateVehicle("vin", value)}
                  setUseCustomMake={setUseCustomMake}
                  setUseCustomModel={setUseCustomModel}
                  setUseCustomEngineSize={setUseCustomEngineSize}
                  makeListId="vehicle-makes"
                  modelListId="vehicle-models"
                  engineListId="vehicle-engine-sizes"
                  className="grid gap-4 md:grid-cols-3"
                  onYearCommit={(value) => handleVehicleProfileBlur({ year: value })}
                  onMakeCommit={(value) => handleVehicleProfileBlur({ make: value })}
                  onModelCommit={(value) => handleVehicleProfileBlur({ model: value })}
                  onEngineCommit={(value) => handleVehicleProfileBlur({ engineSize: value })}
                  onPlateCommit={(value) => handleVehicleProfileBlur({ licensePlate: value })}
                  onVinCommit={(value) => handleVehicleProfileBlur({ vin: value })}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Transmission</Label>
                    <Select value={vehicle.transmission} onValueChange={(value) => updateVehicle("transmission", value)}>
                      <SelectTrigger className="h-12 px-4 text-base"><SelectValue placeholder="Select transmission" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatic" className="min-h-12 px-4 py-3 text-base">Automatic</SelectItem>
                        <SelectItem value="manual" className="min-h-12 px-4 py-3 text-base">Manual</SelectItem>
                        <SelectItem value="cvt" className="min-h-12 px-4 py-3 text-base">CVT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Drivetrain</Label>
                    <Select value={vehicle.driveline} onValueChange={(value) => updateVehicle("driveline", value)}>
                      <SelectTrigger className="h-12 px-4 text-base"><SelectValue placeholder="Select drivetrain" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fwd" className="min-h-12 px-4 py-3 text-base">FWD</SelectItem>
                        <SelectItem value="rwd" className="min-h-12 px-4 py-3 text-base">RWD</SelectItem>
                        <SelectItem value="awd" className="min-h-12 px-4 py-3 text-base">AWD</SelectItem>
                        <SelectItem value="4wd" className="min-h-12 px-4 py-3 text-base">4WD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>OBD Code</Label>
                    <Input placeholder="Example: P0420" value={vehicle.obdCode} onChange={(e) => updateVehicle("obdCode", e.target.value)} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>General Notes</Label>
                    <Textarea placeholder="Customer concerns, visible damage, or special observations" value={vehicle.notes} onChange={(e) => updateVehicle("notes", e.target.value)} className="bg-white" />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleStartNewCustomer}
                    className={headerActionButtonClassName}
                  >
                    Save Draft
                  </button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveSection("vehicle")}
                    disabled={sectionSavingStep === "vehicle"}
                  >
                    {sectionSavingStep === "vehicle" ? "Saving Section..." : "Save Vehicle Section"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mileage">
            <div className="space-y-6">
              <StepCompletionToggle
                checked={workflowSteps.mileage}
                onCheckedChange={(value) =>
                  handleWorkflowStepCompletionChange("mileage", value)
                }
                label="Mark mileage and service interval review as complete."
              />

              {recordSyncMessage && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    recordSyncState === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : recordSyncState === "saved"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {recordSyncMessage}
                </div>
              )}

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader
                    icon={Car}
                    title="Mileage and service interval"
                    subtitle="Capture the current odometer reading and review what is due now versus what comes next."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Current Mileage</Label>
                      <Input
                        value={vehicle.mileage}
                        onChange={(e) => updateVehicle("mileage", e.target.value)}
                        onBlur={(e) => {
                          updateVehicle("mileage", e.target.value);
                          void handleVehicleProfileBlur();
                        }}
                        inputMode="numeric"
                        placeholder="125,000"
                        className="bg-white"
                      />
                      {vehicleFieldFormatWarnings.mileage ? (
                        <p className="text-xs text-amber-800">{vehicleFieldFormatWarnings.mileage}</p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Enter the odometer reading so the maintenance schedule can calculate the current service interval.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">Current vehicle</div>
                      <div className="mt-2 text-sm text-slate-700">
                        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle details not finished yet."}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Once mileage is entered, the suggested maintenance cards below update automatically for the current interval.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader
                    icon={ClipboardList}
                    title="Suggested maintenance"
                    subtitle="Filtered to the current vehicle and mileage. Showing what is due now and what is coming next."
                  />

                  {!maintenanceSchedulePreview ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                      Enter vehicle information to see baseline suggested maintenance. Add mileage to calculate the current and next service intervals.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Badge variant="secondary" className="rounded-full">
                          {maintenanceSchedulePreview.source === "oem" ? "OEM schedule" : "Rules-based schedule"}
                        </Badge>
                        <span className="text-slate-600">
                          {maintenanceSchedulePreview.vehicleLabel}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-600">
                          Mileage: {vehicle.mileage || "-"}
                        </span>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        {([
                          ["Suggested Now", maintenanceSchedulePreview.current, "Due based on current mileage."],
                          ["Next Interval", maintenanceSchedulePreview.next, "Next scheduled service interval after current mileage."],
                        ] as const).map(([title, interval, subtitle]) => {
                          const groupedItems = groupScheduleItems(interval);

                          return (
                            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-lg font-semibold text-slate-900">{title}</div>
                                  <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
                                </div>
                                <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                                  {interval ? formatMileageIntervalLabel(interval.mileage) : "Unavailable"}
                                </Badge>
                              </div>

                              {groupedItems.length > 0 ? (
                                <div className="mt-5 space-y-4">
                                  {groupedItems.map(([category, items]) => (
                                    <div key={category} className="space-y-2 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        {category}
                                      </div>
                                      <div className="space-y-2">
                                        {items.map((item) => (
                                          <div key={`${category}-${item.service}`} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
                                            <div className="font-medium text-slate-900">{item.service}</div>
                                            {item.note ? (
                                              <div className="mt-1 text-slate-600">{item.note}</div>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-5 rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                                  No scheduled services found for this interval.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveSection("mileage")}
                  disabled={sectionSavingStep === "mileage"}
                >
                  {sectionSavingStep === "mileage" ? "Saving Section..." : "Save Mileage Section"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {inspectionMode === "full" ? (
          <TabsContent value="tires">
            <div className="space-y-6">
              <SectionHeader icon={ClipboardList} title="Tire inspection" subtitle="Record PSI, tread data, condition, and wear indicators for each tire." />
              <StepCompletionToggle
                checked={workflowSteps.tires}
                onCheckedChange={(value) =>
                  handleWorkflowStepCompletionChange("tires", value)
                }
                label="Mark tire inspection as complete."
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {tires.map((tire) => (
                  <Card key={tire} className="rounded-3xl border border-slate-200 bg-white shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">{tire}</CardTitle>
                      <StatusPill value={tireData[tire].status} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {tire === "Spare" && (
                        <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                          <Checkbox
                            checked={tireData[tire].flags.includes(spareUnavailableFlag)}
                            onCheckedChange={() => toggleTireFlag(tire, spareUnavailableFlag)}
                          />
                          <span>Missing / Unavailable</span>
                        </label>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2"><Label>PSI In</Label><Input value={tireData[tire].psiIn} onChange={(e) => updateTire(tire, "psiIn", e.target.value)} className="bg-white" /></div>
                        <div className="space-y-2"><Label>PSI Out</Label><Input value={tireData[tire].psiOut} onChange={(e) => updateTire(tire, "psiOut", e.target.value)} className="bg-white" /></div>
                        <div className="space-y-2"><Label>Tread Outer (32nds)</Label><Input value={tireData[tire].treadOuter} onChange={(e) => updateTire(tire, "treadOuter", e.target.value)} className="bg-white" /></div>
                        <div className="space-y-2"><Label>Tread Inner (32nds)</Label><Input value={tireData[tire].treadInner} onChange={(e) => updateTire(tire, "treadInner", e.target.value)} className="bg-white" /></div>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <ConditionSelect value={tireData[tire].status} onChange={(value) => updateTire(tire, "status", value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Tire flags</Label>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {tireFlags.map((flag) => {
                            const checked = tireData[tire].flags.includes(flag);
                            return (
                              <label key={flag} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm">
                                <Checkbox checked={checked} onCheckedChange={() => toggleTireFlag(tire, flag)} />
                                <span>{flag}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Recommendation</Label>
                        <Textarea placeholder="Rotation, balance, alignment, replacement, or note" value={tireData[tire].recommendation} onChange={(e) => updateTire(tire, "recommendation", e.target.value)} className="bg-white" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveSection("tires")}
                  disabled={sectionSavingStep === "tires"}
                >
                  {sectionSavingStep === "tires" ? "Saving Section..." : "Save Tire Section"}
                </Button>
              </div>
            </div>
          </TabsContent>
          ) : null}

          {inspectionMode === "full" ? (
          <TabsContent value="brakes">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="space-y-6 p-6">
                <SectionHeader icon={Wrench} title="Brake inspection" subtitle="Capture measured pad and rotor values plus the overall brake recommendation." />
                <StepCompletionToggle
                  checked={workflowSteps.brakes}
                  onCheckedChange={(value) =>
                    handleWorkflowStepCompletionChange("brakes", value)
                  }
                  label="Mark brake inspection as complete."
                />
                <div className="grid gap-4 md:grid-cols-4">
                  {([
                    ["LF Pad (mm)", "lfPad"],
                    ["RF Pad (mm)", "rfPad"],
                    ["LR Pad/Shoe (mm)", "lrPad"],
                    ["RR Pad/Shoe (mm)", "rrPad"],
                    ["LF Rotor/Drum", "lfRotor"],
                    ["RF Rotor/Drum", "rfRotor"],
                    ["LR Rotor/Drum", "lrRotor"],
                    ["RR Rotor/Drum", "rrRotor"],
                  ] as const satisfies readonly (readonly [string, BrakeFieldKey])[]).map(([label, key]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input value={brakes[key]} onChange={(e) => setBrakes((prev) => ({ ...prev, [key]: e.target.value }))} className="bg-white" />
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label>Brake Status</Label>
                    <ConditionSelect value={brakes.status} onChange={(value) => setBrakes((prev) => ({ ...prev, status: value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Brake Notes</Label>
                    <Textarea placeholder="Example: Front pads at 3mm, rotors near discard spec" value={brakes.brakeNotes} onChange={(e) => setBrakes((prev) => ({ ...prev, brakeNotes: e.target.value }))} className="bg-white" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleSaveSection("brakes")}
                    disabled={sectionSavingStep === "brakes"}
                  >
                    {sectionSavingStep === "brakes" ? "Saving Section..." : "Save Brake Section"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          ) : null}

          <TabsContent value="maintenance">
            <div className="space-y-6">
              <StepCompletionToggle
                checked={workflowSteps.maintenance}
                onCheckedChange={(value) =>
                  handleWorkflowStepCompletionChange("maintenance", value)
                }
                label="Mark maintenance and undercar inspection as complete."
              />

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={ClipboardList} title="Maintenance inspection" subtitle="Record service recommendations and why each item needs attention." />
                  <div className="grid gap-4">
                    {activeMaintenanceItems.map((item) => (
                      <div key={item} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1.2fr_320px_1fr]">
                        <div className="flex items-center font-medium">{item}</div>
                        <QuickConditionButtons value={maintenance[item].status} onChange={(value) => updateMaintenance(item, "status", value)} />
                        <Input placeholder="Why we recommend service" value={maintenance[item].why} onChange={(e) => updateMaintenance(item, "why", e.target.value)} className="bg-white" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={ClipboardList} title="Steering, suspension, and undercar inspection" subtitle="Use this section for undercarriage and steering components from the inspection sheet." />
                  <div className="grid gap-4">
                    {activeUndercarItems.map((item) => (
                      <div key={item} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1.2fr_320px_1fr]">
                        <div className="flex items-center font-medium">{item}</div>
                        <QuickConditionButtons value={undercar[item].status} onChange={(value) => updateUndercar(item, "status", value)} />
                        <Input placeholder="Why we recommend service" value={undercar[item].why} onChange={(e) => updateUndercar(item, "why", e.target.value)} className="bg-white" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveSection("maintenance")}
                  disabled={sectionSavingStep === "maintenance"}
                >
                  {sectionSavingStep === "maintenance" ? "Saving Section..." : "Save Maintenance Section"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="photos">
            <div className="space-y-6">
              <StepCompletionToggle
                checked={workflowSteps.photos}
                onCheckedChange={(value) =>
                  handleWorkflowStepCompletionChange("photos", value)
                }
                label="Mark photo collection as complete."
              />
              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={Camera} title="Pre-service condition photos" subtitle="Capture the same required baseline photo set before work begins: all four corners and the interior." />
                  <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-sm">
                    <span className="text-slate-700">Required pre-service photos completed</span>
                    <span className="font-semibold">{preServiceCompletionCount} / {requiredConditionShots.length}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {requiredConditionShots.map((shot) => (
                      <Card key={`pre-${shot}`} className="rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base">{shot}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white p-6 text-center">
    {preServicePhotos[shot].preview ? (
      <img src={preServicePhotos[shot].preview} alt={shot} className="h-44 w-full rounded-2xl object-cover" />
    ) : (
      <>
        <Upload className="mb-3 h-8 w-8" />
        <div className="font-medium">Add {shot} photo</div>
        <div className="text-sm text-slate-600">Capture on-site or upload an existing photo.</div>
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
        onChange={(e) => onConditionPhotoUpload("pre", shot, e)}
      />
    </label>

    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
      Upload Existing
      <input
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => onConditionPhotoUpload("pre", shot, e)}
      />
    </label>
  </div>
</div>
                          <div className="space-y-2">
                            <Label>Pre-service note</Label>
                            <Textarea placeholder="Optional condition note before service" value={preServicePhotos[shot].note} onChange={(e) => updateConditionPhotoNote("pre", shot, e.target.value)} className="bg-white" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={Camera} title="Inspection photo capture" subtitle="Attach vehicle photos to support recommendations sent to the customer." />
                  <div className="space-y-4 rounded-3xl border border-dashed bg-white p-8 text-center">
  <div>
    <Upload className="mx-auto mb-3 h-8 w-8" />
    <div className="font-medium">Inspection photos</div>
    <div className="text-sm text-slate-600">Take photos of worn tires, brakes, leaks, lights, and other findings.</div>
  </div>

  <div className="grid gap-3 md:grid-cols-2">
    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
      Take Photo
      <input
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        capture="environment"
        onChange={onPhotoUpload}
      />
    </label>

    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
      Upload Existing
      <input
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        onChange={onPhotoUpload}
      />
    </label>
  </div>
</div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {photos.map((photo) => (
                      <Card key={photo.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                        <img src={photo.preview} alt={photo.name} className="h-52 w-full object-cover" />
                        <CardContent className="space-y-3 p-4">
                          <div className="truncate text-sm font-medium">{photo.name}</div>
                          <Textarea placeholder="Photo note for customer report" value={photo.note} onChange={(e) => updatePhotoNote(photo.id, e.target.value)} className="bg-white" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={Camera} title="Post-work internal photo documentation" subtitle="Internal use only. Capture a standard closeout set after service is complete: all four corners and the interior." />
                  <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-sm">
                    <span className="text-slate-700">Required closeout photos completed</span>
                    <span className="font-semibold">{postWorkCompletionCount} / {requiredConditionShots.length}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {requiredConditionShots.map((shot) => (
                      <Card key={`post-${shot}`} className="rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base">{shot}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white p-6 text-center">
    {postWorkPhotos[shot].preview ? (
      <img src={postWorkPhotos[shot].preview} alt={shot} className="h-44 w-full rounded-2xl object-cover" />
    ) : (
      <>
        <Upload className="mb-3 h-8 w-8" />
        <div className="font-medium">Add {shot} photo</div>
        <div className="text-sm text-slate-600">Capture on-site or upload an existing photo.</div>
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
        onChange={(e) => onConditionPhotoUpload("post", shot, e)}
      />
    </label>

    <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm">
      Upload Existing
      <input
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => onConditionPhotoUpload("post", shot, e)}
      />
    </label>
  </div>
</div>
                          <div className="space-y-2">
                            <Label>Internal note</Label>
                            <Textarea placeholder="Optional closeout note for internal records" value={postWorkPhotos[shot].note} onChange={(e) => updateConditionPhotoNote("post", shot, e.target.value)} className="bg-white" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveSection("photos")}
                  disabled={sectionSavingStep === "photos"}
                >
                  {sectionSavingStep === "photos" ? "Saving Section..." : "Save Photo Section"}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="customer-report">
  <div className="mx-auto max-w-5xl space-y-6">
    <StepCompletionToggle
      checked={workflowSteps["customer-report"]}
      onCheckedChange={(value) =>
        handleWorkflowStepCompletionChange("customer-report", value)
      }
      label="Mark the customer report as complete and ready."
    />
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
      <div className="bg-slate-900 px-8 py-8 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <BrandLogo surface="dark" />
            <h2 className="mt-2 text-3xl font-bold">Vehicle Inspection Report</h2>
            <p className="mt-2 text-sm text-slate-300">
              Prepared for {[vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "Customer"} on {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <div><span className="text-slate-300">Technician:</span> {vehicle.techName || "-"}</div>
            <div><span className="text-slate-300">OBD Code:</span> {vehicle.obdCode || "-"}</div>
          </div>
        </div>
      </div>

      <CardContent className="space-y-8 p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Customer</div>
            <div className="space-y-2 text-sm text-slate-800">
              <div><span className="font-medium">Name:</span> {[vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "-"}</div>
              <div><span className="font-medium">Phone:</span> {vehicle.phone || "-"}</div>
              <div><span className="font-medium">Email:</span> {vehicle.email || "-"}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Vehicle</div>
            <div className="space-y-2 text-sm text-slate-800">
              <div><span className="font-medium">Vehicle:</span> {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "-"}</div>
              <div><span className="font-medium">Mileage:</span> {vehicle.mileage || "-"}</div>
              <div><span className="font-medium">VIN:</span> {vehicle.vin || "-"}</div>
              <div><span className="font-medium">Plate:</span> {vehicle.licensePlate || "-"} {vehicle.state || ""}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 text-lg font-semibold text-slate-900">Inspection Summary</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm font-medium text-emerald-700">OK</div>
              <div className="mt-2 text-3xl font-bold text-emerald-800">{summaryCounts.ok}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-medium text-amber-700">Suggested Soon</div>
              <div className="mt-2 text-3xl font-bold text-amber-800">{summaryCounts.sug}</div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="text-sm font-medium text-red-700">Required Now</div>
              <div className="mt-2 text-3xl font-bold text-red-800">{summaryCounts.req}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-lg font-semibold text-slate-900">Recommended Services</div>
              {recommendedItems.length ? (
                <div className="space-y-3">
                  {recommendedItems.map((item, index) => (
                    <div key={index} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  No immediate recommendations were recorded.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-lg font-semibold text-slate-900">Brake Findings</div>
              <div className="grid gap-3 text-sm text-slate-800 md:grid-cols-2">
                <div>LF Pad: {brakes.lfPad || "-"}</div>
                <div>RF Pad: {brakes.rfPad || "-"}</div>
                <div>LR Pad/Shoe: {brakes.lrPad || "-"}</div>
                <div>RR Pad/Shoe: {brakes.rrPad || "-"}</div>
                <div>LF Rotor/Drum: {brakes.lfRotor || "-"}</div>
                <div>RF Rotor/Drum: {brakes.rfRotor || "-"}</div>
                <div>LR Rotor/Drum: {brakes.lrRotor || "-"}</div>
                <div>RR Rotor/Drum: {brakes.rrRotor || "-"}</div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-medium">Notes:</span> {brakes.brakeNotes || "No brake notes recorded."}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-lg font-semibold text-slate-900">Technician Notes</div>
              <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                {vehicle.notes || "No technician notes were entered."}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-lg font-semibold text-slate-900">Tire Status</div>
              <div className="space-y-3">
                {tires.map((tire) => {
                  const t = tireData[tire];
                  const isSpareUnavailable = t.flags?.includes(spareUnavailableFlag);
                  const visibleFlags = isSpareUnavailable
                    ? (t.flags || []).filter((flag: string) => flag !== spareUnavailableFlag)
                    : t.flags || [];
                  return (
                    <div key={tire} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tire}</span>
                        <span className="text-slate-600">{isSpareUnavailable ? spareUnavailableFlag : t.status || "pending"}</span>
                      </div>
                      {isSpareUnavailable ? (
                        <div className="mt-1 text-red-600">
                          Spare tire marked as missing or unavailable.
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-600">
                          PSI {t.psiIn || "-"} {"->"} {t.psiOut || "-"} | Tread {t.treadOuter || "-"} / {t.treadInner || "-"}
                        </div>
                      )}
                      {visibleFlags.length > 0 && (
                        <div className="mt-1 text-slate-600">
                          Flags: {visibleFlags.join(", ")}
                        </div>
                      )}
                      {t.recommendation ? (
                        <div className="mt-1 text-slate-600">
                          Recommendation: {t.recommendation}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-lg font-semibold text-slate-900">Photo Documentation</div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
                  Pre-service photos completed: {preServiceCompletionCount} / {requiredConditionShots.length}
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
                  Inspection photos added: {photos.length}
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
                  Post-work photos completed: {postWorkCompletionCount} / {requiredConditionShots.length}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
              <div className="text-lg font-semibold">Next Steps</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Review the recommended items above and contact On The Go Maintenance with any questions or to schedule follow-up service.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <div className="flex justify-end">
      <Button
        type="button"
        onClick={() => void handleSaveSection("customer-report")}
        disabled={sectionSavingStep === "customer-report"}
      >
        {sectionSavingStep === "customer-report" ? "Saving Section..." : "Save Report Section"}
      </Button>
    </div>
  </div>
</TabsContent>
          <TabsContent value="review">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-6 p-6">
                  <SectionHeader icon={FileText} title="Inspection summary" subtitle="This is the customer-facing summary that can become a PDF or shareable report." />
                  <StepCompletionToggle
                    checked={workflowSteps.review}
                    onCheckedChange={(value) =>
                      handleWorkflowStepCompletionChange("review", value)
                    }
                    label="Mark the final review as complete."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <div className="text-sm text-slate-700">Customer</div>
                      <div className="mt-1 font-semibold">{[vehicle.firstName, vehicle.lastName].filter(Boolean).join(" ") || "No customer entered"}</div>
                      <div className="text-sm text-slate-700">{vehicle.phone || "No phone"}</div>
                      <div className="text-sm text-slate-700">{vehicle.email || "No email"}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <div className="text-sm text-slate-700">Vehicle</div>
                      <div className="mt-1 font-semibold">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No vehicle entered"}</div>
                      <div className="text-sm text-slate-700">Mileage: {vehicle.mileage || "--"}</div>
                      <div className="text-sm text-slate-700">VIN: {vehicle.vin || "--"}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border bg-emerald-50 p-4">
                      <div className="text-sm text-emerald-700">OK items</div>
                      <div className="text-3xl font-bold text-emerald-800">{summaryCounts.ok}</div>
                    </div>
                    <div className="rounded-2xl border bg-amber-50 p-4">
                      <div className="text-sm text-amber-700">Suggested soon</div>
                      <div className="text-3xl font-bold text-amber-800">{summaryCounts.sug}</div>
                    </div>
                    <div className="rounded-2xl border bg-red-50 p-4">
                      <div className="text-sm text-red-700">Required now</div>
                      <div className="text-3xl font-bold text-red-800">{summaryCounts.req}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold">Technician notes</div>
                    <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">{vehicle.notes || "No notes entered yet."}</div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold">Pre-service photos</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {requiredConditionShots.map((shot) => (
                        <div key={`review-pre-${shot}`} className="rounded-2xl border bg-white p-3 text-sm">
                          <div className="font-medium">{shot}</div>
                          <div className="text-slate-700">{preServicePhotos[shot].name || "No photo uploaded"}</div>
                          <div className="text-slate-500">{preServicePhotos[shot].note || "No note added"}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold">Service and inspection photos</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {photos.length ? (
                        photos.map((photo) => (
                          <div key={photo.id} className="rounded-2xl border bg-white p-3 text-sm">
                            <div className="font-medium">{photo.name}</div>
                            <div className="text-slate-500">{photo.note || "No note added"}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">No photos uploaded yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold">Post-work internal photos</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {requiredConditionShots.map((shot) => (
                        <div key={`review-post-${shot}`} className="rounded-2xl border bg-white p-3 text-sm">
                          <div className="font-medium">{shot}</div>
                          <div className="text-slate-700">{postWorkPhotos[shot].name || "No photo uploaded"}</div>
                          <div className="text-slate-500">{postWorkPhotos[shot].note || "No note added"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardContent className="space-y-4 p-6">
                  <SectionHeader
                    icon={CheckCircle2}
                    title="Inspection closeout"
                    subtitle="Save the inspection, confirm the customer-facing report, and generate the final PDF when ready."
                  />
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
                    Internal closeout photos: <span className="font-semibold text-slate-900">{postWorkCompletionCount} / {requiredConditionShots.length}</span> captured.
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-100 p-4">
                      1. Save the inspection so the customer portal has the latest progress and notes.
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      2. Review the customer summary, required items, and suggested maintenance.
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      3. Generate the PDF report for the customer record when the inspection is ready.
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                    <Button
                      className="min-h-12 w-full whitespace-normal break-words rounded-2xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 sm:w-auto"
                      onClick={handleSaveInspection}
                    >
                      Save Inspection
                    </Button>

                    <Button
                      type="button"
                      className="min-h-12 w-full whitespace-normal break-words rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 hover:bg-slate-100 sm:w-auto"
                      onClick={handleGeneratePdf}
                    >
                      Generate PDF Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function OnTheGoTechnicianAppPrototype() {
  return <TechnicianWorkspacePage />;
}
