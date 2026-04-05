"use client";
// @ts-nocheck
import { supabase } from "@/lib/supabase";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Camera, Car, Check, CheckCircle2, ClipboardList, FileText, Upload, Wrench } from "lucide-react";
import {
  formatMileage,
  formatPhoneNumber,
  MAX_MODEL_YEAR,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
import { vehicleCatalog, vehicleMakes } from "@/lib/vehicleCatalog";
import { VehicleCatalogFields } from "@/components/vehicle/VehicleCatalogFields";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { workflowStepLabels, workflowStepOrder } from "@/lib/inspection-workflow";
import { getInspectionRecommendations } from "@/lib/inspection-recommendations";
import { getPostLoginRoute, getUserRoles, hasAnyRole } from "@/lib/portal-auth";
import {
  buildCustomerPayload,
  buildInspectionPayload,
  buildTechInspectionDraft,
  buildVehiclePayload,
  getErrorMessage,
  getVehicleCatalogModes,
  getCustomerProfileValidationError,
  TECH_DRAFT_STORAGE_KEY,
} from "@/lib/tech-inspection";

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
  "Timing Belt",
  "Lift Supports",
  "Spark Plugs",
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
  "Idler / Pitman Arm",
  "Center Link",
  "Link Pins",
  "Struts / Shocks",
  "Control Arms",
  "Hub / Bearings",
  "Strut Mounts",
  "Rack & Pinion Assembly",
  "CV Boots",
  "Tie Rod Ends",
  "Bushings",
  "Ball Joints",
  "Exhaust System",
  "Muffler",
  "Intermediate Pipe",
] as const;

const tires = ["Left Front", "Right Front", "Right Rear", "Left Rear", "Spare"] as const;

const requiredConditionShots = [
  "Front Left Corner",
  "Front Right Corner",
  "Rear Right Corner",
  "Rear Left Corner",
  "Interior",
];

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
      <SelectTrigger className="w-full bg-white">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">        {conditionOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
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

function StepCompletionToggle({
  checked,
  onCheckedChange,
  label,
}: StepCompletionToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`w-full rounded-2xl border px-5 py-4 text-left shadow-sm transition-colors ${
        checked
          ? "border-emerald-300 bg-emerald-100"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-slate-900">Step completion</div>
          <div className="mt-1 text-sm text-slate-700">{label}</div>
        </div>

        <div
          className={`flex min-h-12 min-w-12 items-center justify-center rounded-2xl border-2 ${
            checked
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-red-400 bg-white text-red-500"
          }`}
          aria-hidden="true"
        >
          {checked ? (
            <Check className="h-6 w-6" />
          ) : (
            <Checkbox
              checked={false}
              className="pointer-events-none size-6 rounded-md border-2 border-current data-[state=checked]:bg-transparent"
            />
          )}
        </div>
      </div>

      <div className="mt-3 text-sm font-medium text-slate-800">
        {checked ? "Completed. Tap to mark incomplete." : "Tap anywhere in this box to mark complete."}
      </div>
    </button>
  );
}

export default function OnTheGoTechnicianAppPrototype() {
  const [vehicle, setVehicle] = useState<VehicleState>({
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
    state: "",
    transmission: "",
    driveline: "",
    techName: "",
    notes: "",
    obdCode: "",
  });

  const [tireData, setTireData] = useState<TireDataState>(
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
    }, {} as TireDataState)
  );

  const [brakes, setBrakes] = useState<BrakeState>({
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

  const [maintenance, setMaintenance] = useState<ChecklistState<MaintenanceItem>>(
    Object.fromEntries(maintenanceItems.map((item) => [item, { status: "", why: "" }])) as ChecklistState<MaintenanceItem>
  );

  const [undercar, setUndercar] = useState<ChecklistState<UndercarItem>>(
    Object.fromEntries(undercarItems.map((item) => [item, { status: "", why: "" }])) as ChecklistState<UndercarItem>
  );

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [preServicePhotos, setPreServicePhotos] = useState<ConditionPhotoState>(
    Object.fromEntries(requiredConditionShots.map((shot) => [shot, { preview: "", name: "", note: "" }]))
  );
  const [postWorkPhotos, setPostWorkPhotos] = useState<ConditionPhotoState>(
    Object.fromEntries(requiredConditionShots.map((shot) => [shot, { preview: "", name: "", note: "" }]))
  );

  const completion = useMemo(() => {
    let total = 0;
    let completed = 0;

    const requiredFields = [vehicle.firstName, vehicle.lastName, vehicle.year, vehicle.make, vehicle.model, vehicle.mileage, vehicle.techName];
    requiredFields.forEach((field) => {
      total += 1;
      if (String(field).trim()) completed += 1;
    });

    tires.forEach((tire) => {
      total += 1;
      if (tireData[tire].status) completed += 1;
    });

    total += 2;
    if (brakes.status) completed += 1;
    if (vehicle.notes.trim()) completed += 1;

    return Math.round((completed / total) * 100);
  }, [vehicle, tireData, brakes]);

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

  const updateVehicle = (key: VehicleFieldKey, value: string) =>
    setVehicle((prev) => ({ ...prev, [key]: normalizeVehicleFieldValue(key, value) }));

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
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [useCustomMake, setUseCustomMake] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [useCustomEngineSize, setUseCustomEngineSize] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [recordSyncState, setRecordSyncState] = useState("idle");
  const [recordSyncMessage, setRecordSyncMessage] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepsState>(
    Object.fromEntries(workflowStepOrder.map((step) => [step, false]))
  );
  
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

    Object.values(tireData).forEach((t) => {
      if (isRecommendationStatus(t.status)) statuses[t.status] += 1;
    });
    Object.values(maintenance).forEach((m) => {
      if (isRecommendationStatus(m.status)) statuses[m.status] += 1;
    });
    Object.values(undercar).forEach((u) => {
      if (isRecommendationStatus(u.status)) statuses[u.status] += 1;
    });
    if (isRecommendationStatus(brakes.status)) statuses[brakes.status] += 1;
    return statuses;
  }, [tireData, maintenance, undercar, brakes.status]);

  const completedWorkflowCount = useMemo(
    () => Object.values(workflowSteps).filter(Boolean).length,
    [workflowSteps]
  );

  const toggleWorkflowStep = (step: string, value: boolean) => {
    setWorkflowSteps((prev) => ({
      ...prev,
      [step]: value,
    }));
  };

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
        .limit(1);

      if (findCustomerError) throw findCustomerError;
      customerData = existingCustomers && existingCustomers.length > 0 ? existingCustomers[0] : null;
    }

    if (customerData) {
      if (savedCustomerId && customerData.id !== savedCustomerId) {
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
      workflowTotalCount: workflowStepOrder.length,
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

  const handleVehicleProfileBlur = async () => {
    if (
      !workflowSteps.vehicle &&
      !savedCustomerId &&
      !savedVehicleId &&
      !savedInspectionId
    ) {
      return;
    }

    try {
      await syncCustomerProfileAndInspection({
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

  const getStepTriggerClassName = (step: string) => {
    if (workflowSteps[step]) {
      return "h-full w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-center text-sm font-semibold leading-tight text-emerald-800 shadow-sm whitespace-normal break-words data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-700 data-[state=active]:text-white";
    }

    return "h-full w-full rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-sm font-semibold leading-tight text-red-700 shadow-sm whitespace-normal break-words data-[state=active]:border-red-700 data-[state=active]:bg-red-700 data-[state=active]:text-white";
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
      workflowTotalCount: workflowStepOrder.length,
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

   const uploadedPhotoRows = [];

for (const shot of requiredConditionShots) {
  const photo = preServicePhotos[shot];
  if (photo?.file) {
    const filePath = `${inspectionData.id}/pre-service/${shot}-${Date.now()}-${photo.file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(filePath, photo.file);

    if (uploadError) throw uploadError;

    uploadedPhotoRows.push({
      inspection_id: inspectionData.id,
      photo_stage: "pre_service",
      shot_label: shot,
      file_name: photo.file.name,
      file_url: filePath,
      note: photo.note || null,
    });
  }
}

for (const photo of photos) {
  if (photo?.file) {
    const filePath = `${inspectionData.id}/inspection/${Date.now()}-${photo.file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(filePath, photo.file);

    if (uploadError) throw uploadError;

    uploadedPhotoRows.push({
      inspection_id: inspectionData.id,
      photo_stage: "inspection",
      shot_label: null,
      file_name: photo.file.name,
      file_url: filePath,
      note: photo.note || null,
    });
  }
}

for (const shot of requiredConditionShots) {
  const photo = postWorkPhotos[shot];
  if (photo?.file) {
    const filePath = `${inspectionData.id}/post-work/${shot}-${Date.now()}-${photo.file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(filePath, photo.file);

    if (uploadError) throw uploadError;

    uploadedPhotoRows.push({
      inspection_id: inspectionData.id,
      photo_stage: "post_work",
      shot_label: shot,
      file_name: photo.file.name,
      file_url: filePath,
      note: photo.note || null,
    });
  }
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
    const midGray: RgbColor = [100, 116, 139];
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
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...darkText);
      const wrapped = doc.splitTextToSize(text || "-", pageWidth - indent - margin);
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

useEffect(() => {
  const checkAccess = async () => {
    const { user, roles: roleNames } = await getUserRoles();

    if (!user) {
      window.location.href = "/customer/login";
      return;
    }

    if (hasAnyRole(roleNames, ["technician", "manager", "admin"])) {
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

  checkAccess();
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;

  const savedDraft = window.localStorage.getItem(TECH_DRAFT_STORAGE_KEY);
  if (!savedDraft) {
    setDraftLoaded(true);
    return;
  }

  try {
    const draft = JSON.parse(savedDraft);
    const vehicleSnapshot = draft.vehicle || {};
    const vehicleCatalogModes = getVehicleCatalogModes({
      make: vehicleSnapshot.make,
      model: vehicleSnapshot.model,
      engineSize: vehicleSnapshot.engineSize,
      vehicleMakes,
      vehicleCatalog,
    });

    if (draft.vehicle) setVehicle(draft.vehicle);
    if (draft.tireData) setTireData(draft.tireData);
    if (draft.brakes) setBrakes(draft.brakes);
    if (draft.maintenance) setMaintenance(draft.maintenance);
    if (draft.undercar) setUndercar(draft.undercar);
    if (draft.photos) setPhotos(draft.photos);
    if (draft.preServicePhotos) setPreServicePhotos(draft.preServicePhotos);
    if (draft.postWorkPhotos) setPostWorkPhotos(draft.postWorkPhotos);
    if (draft.workflowSteps) setWorkflowSteps(draft.workflowSteps);
    if (draft.savedInspectionId) setSavedInspectionId(draft.savedInspectionId);
    if (draft.savedCustomerId) setSavedCustomerId(draft.savedCustomerId);
    if (draft.savedVehicleId) setSavedVehicleId(draft.savedVehicleId);
    setUseCustomMake(vehicleCatalogModes.useCustomMake);
    setUseCustomModel(vehicleCatalogModes.useCustomModel);
    setUseCustomEngineSize(vehicleCatalogModes.useCustomEngineSize);
  } catch (error) {
    console.error("Failed to load technician draft:", error);
  } finally {
    setDraftLoaded(true);
  }
}, []);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-4 text-slate-900 md:p-8" onBlurCapture={saveDraftToLocal}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                  <BrandLogo priority />
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Technician Inspection App
                  </h1>
                  <p className="mt-1 text-sm text-slate-700">
                    Capture inspection results, upload photos, and prepare a customer-ready service report.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href="/portal"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Portal Home
                    </a>

                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = "/customer/login";
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              <div className="w-full max-w-xs space-y-2 rounded-2xl bg-slate-100 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">Inspection progress</span>
                  <span className="font-semibold">{completion}%</span>
                </div>
                <Progress value={completion} className="h-2" />
                <div className="flex gap-2 pt-1">
                  <Badge variant="secondary" className="rounded-full">OK: {summaryCounts.ok}</Badge>
                  <Badge variant="secondary" className="rounded-full">Suggested: {summaryCounts.sug}</Badge>
                  <Badge variant="secondary" className="rounded-full">Required: {summaryCounts.req}</Badge>
                </div>
                <div className="pt-2 text-sm text-slate-600">
                  Workflow steps complete: <span className="font-semibold text-slate-900">{completedWorkflowCount} / {workflowStepOrder.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vehicle" className="mt-6 space-y-6">
          <TabsList className="grid w-full grid-cols-2 items-stretch gap-3 rounded-2xl border border-slate-200 bg-slate-200 p-2 shadow-sm md:grid-cols-7">
            <TabsTrigger value="vehicle" className={getStepTriggerClassName("vehicle")}>
              Vehicle
            </TabsTrigger>
            <TabsTrigger value="tires" className={getStepTriggerClassName("tires")}>
              Tires
            </TabsTrigger>
            <TabsTrigger value="brakes" className={getStepTriggerClassName("brakes")}>
              Brakes
            </TabsTrigger>
            <TabsTrigger value="maintenance" className={getStepTriggerClassName("maintenance")}>
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="photos" className={getStepTriggerClassName("photos")}>
              Photos
            </TabsTrigger>
            <TabsTrigger value="customer-report" className={getStepTriggerClassName("customer-report")}>
              Customer Report
            </TabsTrigger>
            <TabsTrigger value="review" className={getStepTriggerClassName("review")}>
              Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vehicle">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
              <CardContent className="space-y-6 p-6">
                <SectionHeader icon={Car} title="Customer and vehicle information" subtitle="Start the inspection by capturing the service visit details." />
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
                    ["Mileage", "mileage"],
                    ["VIN", "vin"],
                    ["License Plate", "licensePlate"],
                    ["State", "state"],
                    ["Technician Name", "techName"],
                  ] as const satisfies readonly (readonly [string, VehicleFieldKey])[]).map(([label, key]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {key === "techName" && technicians.length > 0 ? (
                        <Select
                          value={vehicle.techName}
                          onValueChange={(value) => {
                            updateVehicle("techName", value);
                            void handleVehicleProfileBlur();
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                            {technicians.map((tech) => (
                              <SelectItem key={tech.id} value={tech.label}>
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
                              : key === "mileage"
                                ? "numeric"
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
                                : key === "mileage"
                                    ? "125,000"
                                    : key === "vin"
                                      ? "17-character VIN"
                                      : undefined
                          }
                          className="bg-white"
                        />
                      )}
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
                  onYearCommit={() => handleVehicleProfileBlur()}
                  onMakeCommit={() => handleVehicleProfileBlur()}
                  onModelCommit={() => handleVehicleProfileBlur()}
                  onEngineCommit={() => handleVehicleProfileBlur()}
                  onPlateCommit={() => handleVehicleProfileBlur()}
                  onVinCommit={() => handleVehicleProfileBlur()}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Transmission</Label>
                    <Select value={vehicle.transmission} onValueChange={(value) => updateVehicle("transmission", value)}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select transmission" /></SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="cvt">CVT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Drivetrain</Label>
                    <Select value={vehicle.driveline} onValueChange={(value) => updateVehicle("driveline", value)}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select drivetrain" /></SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">                        <SelectItem value="fwd">FWD</SelectItem>
                        <SelectItem value="rwd">RWD</SelectItem>
                        <SelectItem value="awd">AWD</SelectItem>
                        <SelectItem value="4wd">4WD</SelectItem>
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
              </CardContent>
            </Card>
          </TabsContent>

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
            </div>
          </TabsContent>

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
              </CardContent>
            </Card>
          </TabsContent>

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
                    {maintenanceItems.map((item) => (
                      <div key={item} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1.2fr_220px_1fr]">
                        <div className="flex items-center font-medium">{item}</div>
                        <ConditionSelect value={maintenance[item].status} onChange={(value) => updateMaintenance(item, "status", value)} />
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
                    {undercarItems.map((item) => (
                      <div key={item} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1.2fr_220px_1fr]">
                        <div className="flex items-center font-medium">{item}</div>
                        <ConditionSelect value={undercar[item].status} onChange={(value) => updateUndercar(item, "status", value)} />
                        <Input placeholder="Why we recommend service" value={undercar[item].why} onChange={(e) => updateUndercar(item, "why", e.target.value)} className="bg-white" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                  const t: any = tireData[tire];
                  return (
                    <div key={tire} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tire}</span>
                        <span className="text-slate-600">{t.status || "pending"}</span>
                      </div>
                      <div className="mt-1 text-slate-600">
                        PSI {t.psiIn || "-"} → {t.psiOut || "-"} | Tread {t.treadOuter || "-"} / {t.treadInner || "-"}
                      </div>
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
                  <SectionHeader icon={CheckCircle2} title="Next build steps" subtitle="This prototype is the front-end. The next step is wiring it to a real backend." />
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
                    Internal closeout photos: <span className="font-semibold text-slate-900">{postWorkCompletionCount} / {requiredConditionShots.length}</span> captured.
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-100 p-4">1. Add Supabase auth for technician logins.</div>
                    <div className="rounded-2xl bg-slate-100 p-4">2. Save inspections into database tables for customers, vehicles, inspections, and photos.</div>
                    <div className="rounded-2xl bg-slate-100 p-4">3. Add customer report generation with branded PDF output.</div>
                    <div className="rounded-2xl bg-slate-100 p-4">4. Add customer portal for service history and invoices.</div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
  <Button
    className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
    onClick={handleSaveInspection}
  >
    Save Inspection
  </Button>

  <Button
  type="button"
  className="rounded-2xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
  onClick={handleGeneratePdf}
>
  Generate PDF Report
</Button>

  <Button
    type="button"
    className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
    onClick={() => alert("Customer sending is the next feature to wire up.")}
  >
    Send to Customer
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
