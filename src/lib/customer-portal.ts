import { supabase } from "@/lib/supabase";
import { getMaintenanceSchedulePreview } from "@/lib/maintenance-suggestions";

export type CustomerPortalRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
  auth_user_id?: string | null;
};

export type CustomerPortalVehicle = {
  id?: string;
  year?: number | null;
  make?: string | null;
  engine_size?: string | null;
  model?: string | null;
  mileage?: number | null;
  vin?: string | null;
  license_plate?: string | null;
};

export type CustomerPortalInspection = {
  id?: string;
  created_at?: string;
  tech_name?: string | null;
  obd_code?: string | null;
  notes?: string | null;
  brakes?: Record<string, unknown> | null;
  tire_data?: Record<string, unknown> | null;
  maintenance?: Record<string, unknown> | null;
  undercar?: Record<string, unknown> | null;
  vehicles?: CustomerPortalVehicle | CustomerPortalVehicle[] | null;
  inspection_summary?: {
    ok?: number;
    suggested?: number;
    required?: number;
    workflow_steps?: Record<string, boolean>;
    workflow_total_count?: number;
    workflow_completed_count?: number;
  } | null;
} | null;

export type CustomerPortalReport = {
  id: string;
  created_at: string;
  pdf_path: string;
  inspections?: CustomerPortalInspection | CustomerPortalInspection[];
};

export type CustomerPortalPhoto = {
  id: string;
  inspection_id: string;
  signedUrl?: string | null;
  file_path?: string | null;
  file_url?: string | null;
  photo_type?: string | null;
};

export type CustomerPortalData = {
  customer: CustomerPortalRecord | null;
  vehicles: CustomerPortalVehicle[];
  latestInspection: CustomerPortalInspection;
  latestInspectionPhotoCount: number;
  reports: CustomerPortalReport[];
  reportGroups: {
    key: string;
    vehicle: CustomerPortalVehicle | null;
    reports: CustomerPortalReport[];
  }[];
  photosByInspection: Record<string, CustomerPortalPhoto[]>;
};

const getEmptyCustomerPortalData = (): CustomerPortalData => ({
  customer: null,
  vehicles: [],
  latestInspection: null,
  latestInspectionPhotoCount: 0,
  reports: [],
  reportGroups: [],
  photosByInspection: {},
});

export const normalizeStoragePath = (
  value: string | null | undefined,
  bucket: string
) => {
  if (!value) return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const publicPrefix = `/storage/v1/object/public/${bucket}/`;
  const signPrefix = `/storage/v1/object/sign/${bucket}/`;

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.pathname.includes(publicPrefix)) {
      return decodeURIComponent(parsedUrl.pathname.split(publicPrefix)[1] || "");
    }

    if (parsedUrl.pathname.includes(signPrefix)) {
      return decodeURIComponent(parsedUrl.pathname.split(signPrefix)[1] || "");
    }
  } catch {
    return trimmedValue;
  }

  return trimmedValue;
};

export const getSingleRelation = <T,>(
  value: T | T[] | null | undefined
): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const buildVehicleLabel = (
  vehicle: CustomerPortalVehicle | null | undefined
) => [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

export const buildVehicleReportKey = (
  vehicle: CustomerPortalVehicle | null | undefined
) => {
  if (!vehicle) {
    return "unknown-vehicle";
  }

  return (
    vehicle.id ||
    vehicle.vin ||
    vehicle.license_plate ||
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join("-").toLowerCase() ||
    "unknown-vehicle"
  );
};

export const groupReportsByVehicle = (reports: CustomerPortalReport[]) => {
  const reportGroups = new Map<
    string,
    {
      key: string;
      vehicle: CustomerPortalVehicle | null;
      reports: CustomerPortalReport[];
    }
  >();

  reports.forEach((report) => {
    const inspection = getSingleRelation(report.inspections);
    const vehicle = getSingleRelation(inspection?.vehicles);
    const key = buildVehicleReportKey(vehicle);

    if (!reportGroups.has(key)) {
      reportGroups.set(key, {
        key,
        vehicle,
        reports: [],
      });
    }

    reportGroups.get(key)?.reports.push(report);
  });

  return Array.from(reportGroups.values()).sort((a, b) => {
    const aDate = a.reports[0]?.created_at ? new Date(a.reports[0].created_at).getTime() : 0;
    const bDate = b.reports[0]?.created_at ? new Date(b.reports[0].created_at).getTime() : 0;
    return bDate - aDate;
  });
};

export const formatVehicleMiles = (mileage: number | null | undefined) =>
  typeof mileage === "number"
    ? `${mileage.toLocaleString("en-US")} miles`
    : "Mileage not available";

export const getCustomerWorkflowSummary = (
  inspection: CustomerPortalInspection,
  workflowLabels: Record<string, string>
) => {
  const workflowSteps = inspection?.inspection_summary?.workflow_steps || {};
  const workflowTotal =
    inspection?.inspection_summary?.workflow_total_count ||
    Object.keys(workflowLabels).length;
  const workflowCompleted =
    inspection?.inspection_summary?.workflow_completed_count ||
    Object.values(workflowSteps).filter(Boolean).length;

  return {
    workflowSteps,
    workflowTotal,
    workflowCompleted,
    dashboardStrength: workflowTotal
      ? Math.round((workflowCompleted / workflowTotal) * 100)
      : 0,
  };
};

export const getCustomerServiceState = (
  inspection: CustomerPortalInspection,
  workflowLabels: Record<string, string>
) => {
  if (!inspection) {
    return {
      label: "Waiting",
      detail: "Waiting on next visit",
      toneClassName: "border-slate-200 bg-slate-100 text-slate-700",
      isWorking: false,
      isCompleted: false,
    };
  }

  const workflowSummary = getCustomerWorkflowSummary(inspection, workflowLabels);
  const inspectionSummary = inspection.inspection_summary || {};
  const hasSavedFieldActivity =
    Number(inspectionSummary.ok || 0) > 0 ||
    Number(inspectionSummary.suggested || 0) > 0 ||
    Number(inspectionSummary.required || 0) > 0 ||
    Boolean(String(inspection.notes || "").trim());

  if (
    workflowSummary.workflowTotal > 0 &&
    workflowSummary.workflowCompleted >= workflowSummary.workflowTotal
  ) {
    return {
      label: "Completed",
      detail: "Inspection workflow completed",
      toneClassName: "border-lime-400/35 bg-lime-400 px-4 py-3 text-black",
      isWorking: false,
      isCompleted: true,
    };
  }

  if (hasSavedFieldActivity) {
    return {
      label: "Working",
      detail: "Technician is actively updating the inspection",
      toneClassName: "border-amber-300/50 bg-amber-300 px-4 py-3 text-black",
      isWorking: true,
      isCompleted: false,
    };
  }

  return {
    label: "In Service",
    detail: "Inspection has started",
    toneClassName: "border-sky-300/45 bg-sky-300 px-4 py-3 text-slate-950",
    isWorking: false,
    isCompleted: false,
  };
};

const hasMeaningfulInspectionContent = (value: unknown): boolean => {
  if (value == null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return !Number.isNaN(value) && value !== 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulInspectionContent(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasMeaningfulInspectionContent(item)
    );
  }

  return false;
};

export const getCustomerWorkflowStepState = (
  inspection: CustomerPortalInspection,
  stepKey: string,
  latestInspectionPhotoCount = 0
) => {
  const workflowSteps = inspection?.inspection_summary?.workflow_steps || {};

  if (workflowSteps?.[stepKey]) {
    return {
      label: "Completed",
      className: "border-lime-400 bg-lime-400 text-slate-950",
    };
  }

  const isWorking = (() => {
    if (!inspection) {
      return false;
    }

    const inspectionVehicle = getSingleRelation(inspection.vehicles);

    switch (stepKey) {
      case "vehicle":
        return (
          hasMeaningfulInspectionContent(inspectionVehicle?.year) ||
          hasMeaningfulInspectionContent(inspectionVehicle?.make) ||
          hasMeaningfulInspectionContent(inspectionVehicle?.model) ||
          hasMeaningfulInspectionContent(inspectionVehicle?.license_plate) ||
          hasMeaningfulInspectionContent(inspectionVehicle?.vin) ||
          hasMeaningfulInspectionContent(inspection.tech_name) ||
          hasMeaningfulInspectionContent(inspection.obd_code)
        );
      case "tires":
        return hasMeaningfulInspectionContent(inspection.tire_data);
      case "brakes":
        return hasMeaningfulInspectionContent(inspection.brakes);
      case "maintenance":
        return (
          hasMeaningfulInspectionContent(inspection.maintenance) ||
          hasMeaningfulInspectionContent(inspection.undercar)
        );
      case "photos":
        return latestInspectionPhotoCount > 0;
      case "customer-report":
        return (
          hasMeaningfulInspectionContent(inspection.notes) ||
          Number(inspection.inspection_summary?.ok || 0) > 0 ||
          Number(inspection.inspection_summary?.suggested || 0) > 0 ||
          Number(inspection.inspection_summary?.required || 0) > 0
        );
      default:
        return false;
    }
  })();

  if (isWorking) {
    return {
      label: "Working",
      className: "border-yellow-300/80 bg-[rgba(255,245,90,0.55)] text-slate-950 shadow-[0_0_18px_rgba(255,242,120,0.16)]",
    };
  }

  return {
    label: "Waiting on this step",
    className: "border-red-400/60 bg-red-400/50 text-slate-900",
  };
};

export const getCustomerRecommendedServices = (
  vehicle: CustomerPortalVehicle | null | undefined
) => {
  const preview = getMaintenanceSchedulePreview({
    year: vehicle?.year ?? null,
    make: vehicle?.make ?? null,
    model: vehicle?.model ?? null,
    mileage: vehicle?.mileage ?? null,
  });

  return preview?.current?.items || [];
};

export const fetchCustomerPortalData = async (
  authUserId: string
): Promise<CustomerPortalData> => {
  const { data: customerRow, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();

  if (customerError || !customerRow) {
    return getEmptyCustomerPortalData();
  }

  const customer = customerRow as CustomerPortalRecord;

  const { data: vehicleRows, error: vehicleError } = await supabase
    .from("vehicles")
    .select(`
      id,
      year,
      make,
      model,
      engine_size,
      mileage,
      vin,
      license_plate
    `)
    .eq("customer_id", customer.id)
    .order("year", { ascending: false });

  if (vehicleError) {
    throw vehicleError;
  }

  const vehicles = (vehicleRows || []) as CustomerPortalVehicle[];

  const { data: inspectionRows, error: inspectionError } = await supabase
    .from("inspections")
    .select(`
      id,
      created_at,
      tech_name,
      obd_code,
      notes,
      brakes,
      tire_data,
      maintenance,
      undercar,
      inspection_summary,
      vehicles (
        id,
        year,
        make,
        model,
        engine_size,
        mileage,
        vin,
        license_plate
      )
    `)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (inspectionError) {
    throw inspectionError;
  }

  const latestInspection =
    (inspectionRows?.[0] as CustomerPortalInspection | undefined) ?? null;

  let latestInspectionPhotoCount = 0;

  if (latestInspection?.id) {
    const { count, error: latestPhotoCountError } = await supabase
      .from("inspection_photos")
      .select("id", { count: "exact", head: true })
      .eq("inspection_id", latestInspection.id);

    if (latestPhotoCountError) {
      throw latestPhotoCountError;
    }

    latestInspectionPhotoCount = count ?? 0;
  }

  const { data: reportRows, error: reportError } = await supabase
    .from("inspection_reports")
    .select(`
      id,
      pdf_path,
      created_at,
      inspections (
        id,
        created_at,
        tech_name,
        obd_code,
        notes,
        brakes,
        tire_data,
        maintenance,
        undercar,
        inspection_summary,
        vehicles (
          id,
          year,
          make,
          model,
          engine_size,
          mileage,
          vin,
          license_plate
        )
      )
    `)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (reportError) {
    throw reportError;
  }

  const reports = (reportRows || []) as CustomerPortalReport[];
  const reportGroups = groupReportsByVehicle(reports);
  const inspectionIds = reports
    .map((report) => getSingleRelation(report.inspections)?.id)
    .filter((id): id is string => Boolean(id));

  if (!inspectionIds.length) {
    return {
      customer,
      vehicles,
      latestInspection,
      latestInspectionPhotoCount,
      reports,
      reportGroups,
      photosByInspection: {},
    };
  }

  const { data: photoRows, error: photoError } = await supabase
    .from("inspection_photos")
    .select("*")
    .in("inspection_id", inspectionIds);

  if (photoError) {
    throw photoError;
  }

  const photosWithUrls = await Promise.all(
    ((photoRows || []) as CustomerPortalPhoto[]).map(async (photo) => {
      const storagePath = normalizeStoragePath(
        photo.file_url,
        "inspection-photos"
      );

      if (!storagePath) {
        return { ...photo, signedUrl: null };
      }

      const { data, error } = await supabase.storage
        .from("inspection-photos")
        .createSignedUrl(storagePath, 60);

      if (error) {
        return { ...photo, signedUrl: null };
      }

      return { ...photo, file_path: storagePath, signedUrl: data.signedUrl };
    })
  );

  const photosByInspection = photosWithUrls.reduce<
    Record<string, CustomerPortalPhoto[]>
  >((acc, photo) => {
    if (!acc[photo.inspection_id]) {
      acc[photo.inspection_id] = [];
    }

    acc[photo.inspection_id].push(photo);
    return acc;
  }, {});

  return {
    customer,
    vehicles,
    latestInspection,
    latestInspectionPhotoCount,
    reports,
    reportGroups,
    photosByInspection,
  };
};
