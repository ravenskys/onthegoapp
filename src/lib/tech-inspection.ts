import {
  findVehicleCatalogMake,
  getVehicleCatalogEngines,
  getVehicleCatalogModels,
} from "@/lib/vehicleCatalog";

export const TECH_DRAFT_STORAGE_KEY = "otg-tech-inspection-draft";
export const TECH_SAVED_DRAFTS_STORAGE_KEY = "otg-tech-inspection-saved-drafts";

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

export const getTrimmedValue = (value: unknown) => {
  const trimmed = String(value || "").trim();
  return trimmed || null;
};

export const getNumericValue = (value: unknown) => {
  const digits = String(value || "").replace(/,/g, "").trim();

  if (!digits) {
    return null;
  }

  const numericValue = Number(digits);
  return Number.isNaN(numericValue) ? null : numericValue;
};

export const getCustomerProfileValidationError = (vehicleSnapshot: Record<string, unknown>) => {
  const requiredFields = [
    { label: "first name", value: vehicleSnapshot.firstName },
    { label: "last name", value: vehicleSnapshot.lastName },
    { label: "phone", value: vehicleSnapshot.phone },
    { label: "email", value: vehicleSnapshot.email },
    { label: "year", value: vehicleSnapshot.year },
    { label: "make", value: vehicleSnapshot.make },
    { label: "model", value: vehicleSnapshot.model },
  ];

  const missingFields = requiredFields
    .filter((field) => !String(field.value || "").trim())
    .map((field) => field.label);

  if (missingFields.length === 0) {
    return null;
  }

  return `Please complete the following before marking this step complete: ${missingFields.join(", ")}. Email is required because it links the customer profile and portal history.`;
};

export const buildCustomerPayload = (vehicleSnapshot: Record<string, unknown>) => ({
  first_name: getTrimmedValue(vehicleSnapshot.firstName),
  last_name: getTrimmedValue(vehicleSnapshot.lastName),
  phone: getTrimmedValue(vehicleSnapshot.phone),
  email: String(vehicleSnapshot.email || "").trim().toLowerCase(),
});

export const buildVehiclePayload = (
  vehicleSnapshot: Record<string, unknown>,
  customerId: string
) => ({
  customer_id: customerId,
  year: getNumericValue(vehicleSnapshot.year),
  make: getTrimmedValue(vehicleSnapshot.make),
  model: getTrimmedValue(vehicleSnapshot.model),
  mileage: getNumericValue(vehicleSnapshot.mileage),
  vin: getTrimmedValue(vehicleSnapshot.vin)?.toUpperCase() ?? null,
  engine_size: getTrimmedValue(vehicleSnapshot.engineSize),
  license_plate: getTrimmedValue(vehicleSnapshot.licensePlate)?.toUpperCase() ?? null,
  state: getTrimmedValue(vehicleSnapshot.state)?.toUpperCase() ?? null,
  transmission: getTrimmedValue(vehicleSnapshot.transmission),
  driveline: getTrimmedValue(vehicleSnapshot.driveline),
});

export const buildInspectionPayload = ({
  customerId,
  vehicleId,
  vehicle,
  brakes,
  tireData,
  maintenance,
  undercar,
  summaryCounts,
  workflowState,
  workflowTotalCount,
}: {
  customerId: string;
  vehicleId: string;
  vehicle: Record<string, unknown>;
  brakes: Record<string, unknown>;
  tireData: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  undercar: Record<string, unknown>;
  summaryCounts: { ok: number; sug: number; req: number };
  workflowState: Record<string, boolean>;
  workflowTotalCount: number;
}) => ({
  customer_id: customerId,
  vehicle_id: vehicleId,
  tech_name: vehicle.techName,
  obd_code: vehicle.obdCode,
  notes: vehicle.notes,
  brakes,
  tire_data: tireData,
  maintenance,
  undercar,
  inspection_summary: {
    ok: summaryCounts.ok,
    suggested: summaryCounts.sug,
    required: summaryCounts.req,
    workflow_steps: workflowState,
    workflow_completed_count: Object.values(workflowState).filter(Boolean).length,
    workflow_total_count: workflowTotalCount,
  },
});

export const serializeInspectionPhotos = (photos: Array<Record<string, unknown>>) =>
  photos.map((photo) => ({
    id: photo.id,
    name: photo.name,
    preview: photo.preview,
    note: photo.note,
  }));

export const serializeConditionPhotoMap = (photoMap: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(photoMap).map(([shot, photo]) => [
      shot,
      {
        name: photo.name,
        preview: photo.preview,
        note: photo.note,
      },
    ])
  );

export const buildTechInspectionDraft = ({
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
}: {
  vehicle: Record<string, unknown>;
  tireData: Record<string, unknown>;
  brakes: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  undercar: Record<string, unknown>;
  photos: Array<Record<string, unknown>>;
  preServicePhotos: Record<string, Record<string, unknown>>;
  postWorkPhotos: Record<string, Record<string, unknown>>;
  workflowSteps: Record<string, boolean>;
  savedInspectionId: string | null;
  savedCustomerId: string | null;
  savedVehicleId: string | null;
}) => ({
  vehicle,
  tireData,
  brakes,
  maintenance,
  undercar,
  photos: serializeInspectionPhotos(photos),
  preServicePhotos: serializeConditionPhotoMap(preServicePhotos),
  postWorkPhotos: serializeConditionPhotoMap(postWorkPhotos),
  workflowSteps,
  savedInspectionId,
  savedCustomerId,
  savedVehicleId,
  savedAt: new Date().toISOString(),
});

export const getVehicleCatalogModes = ({
  year,
  make,
  model,
  engineSize,
}: {
  year?: unknown;
  make?: unknown;
  model?: unknown;
  engineSize?: unknown;
}) => {
  const normalizedModel = String(model || "").toLowerCase();
  const normalizedEngineSize = String(engineSize || "").toLowerCase();

  const matchingMake = findVehicleCatalogMake(make);
  const knownModels = matchingMake ? getVehicleCatalogModels(matchingMake, year) : [];
  const matchingModel = knownModels.find(
    (catalogModel) => catalogModel.toLowerCase() === normalizedModel
  );
  const knownEngines =
    matchingMake && matchingModel ? getVehicleCatalogEngines(matchingMake, matchingModel, year) : [];

  return {
    useCustomMake: Boolean(make) && !matchingMake,
    useCustomModel:
      Boolean(model) &&
      (knownModels.length === 0 ||
        !knownModels.some((catalogModel) => catalogModel.toLowerCase() === normalizedModel)),
    useCustomEngineSize:
      Boolean(engineSize) &&
      (knownEngines.length === 0 ||
        !knownEngines.some(
          (catalogEngine) => catalogEngine.toLowerCase() === normalizedEngineSize
        )),
  };
};
