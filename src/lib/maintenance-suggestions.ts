type MaintenanceActionGroup =
  | "Inspect"
  | "Replace"
  | "Flush"
  | "Rotate"
  | "Lubricate"
  | "Service";

export type MaintenanceScheduleItem = {
  category: MaintenanceActionGroup;
  service: string;
  note?: string;
};

export type MaintenanceScheduleInterval = {
  mileage: number;
  items: MaintenanceScheduleItem[];
};

export type MaintenanceSchedulePreview = {
  source: "oem" | "rules";
  current: MaintenanceScheduleInterval | null;
  next: MaintenanceScheduleInterval | null;
  vehicleLabel: string;
};

type VehicleScheduleInput = {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  mileage?: string | number | null;
};

type OemScheduleDefinition = {
  label: string;
  intervals: MaintenanceScheduleInterval[];
};

const OEM_MAINTENANCE_SCHEDULES: Record<string, OemScheduleDefinition> = {};

const repeatingMaintenanceRules: Array<{
  everyMiles: number;
  categories: MaintenanceScheduleItem[];
}> = [
  {
    everyMiles: 5000,
    categories: [
      { category: "Replace", service: "Engine oil" },
      { category: "Replace", service: "Engine oil filter" },
      { category: "Rotate", service: "Tires" },
      { category: "Inspect", service: "Brake system" },
      { category: "Inspect", service: "Fluid levels" },
    ],
  },
  {
    everyMiles: 15000,
    categories: [
      { category: "Inspect", service: "Cabin air filter" },
      { category: "Inspect", service: "Engine air filter" },
      { category: "Inspect", service: "Battery and charging system" },
      { category: "Inspect", service: "Steering and suspension components" },
    ],
  },
  {
    everyMiles: 30000,
    categories: [
      { category: "Replace", service: "Cabin air filter" },
      { category: "Replace", service: "Engine air filter" },
      { category: "Flush", service: "Brake fluid", note: "Typical severe-service interval." },
      { category: "Inspect", service: "Cooling system hoses and connections" },
    ],
  },
  {
    everyMiles: 60000,
    categories: [
      { category: "Service", service: "Transmission service" },
      { category: "Inspect", service: "Drive belts" },
      { category: "Inspect", service: "Spark plugs / ignition system" },
    ],
  },
  {
    everyMiles: 100000,
    categories: [
      { category: "Replace", service: "Spark plugs" },
      { category: "Flush", service: "Engine coolant" },
      { category: "Inspect", service: "Water pump and cooling system components" },
    ],
  },
];

const buildVehicleKey = ({ year, make, model }: VehicleScheduleInput) => {
  const normalizedYear = String(year || "").trim();
  const normalizedMake = String(make || "").trim().toLowerCase();
  const normalizedModel = String(model || "").trim().toLowerCase();

  if (!normalizedYear || !normalizedMake || !normalizedModel) {
    return null;
  }

  return `${normalizedYear}:${normalizedMake}:${normalizedModel}`;
};

const dedupeScheduleItems = (items: MaintenanceScheduleItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.service.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildRuleInterval = (mileage: number, vehicleYear?: number | null): MaintenanceScheduleInterval => {
  const intervalItems = repeatingMaintenanceRules
    .filter((rule) => mileage > 0 && mileage % rule.everyMiles === 0)
    .flatMap((rule) => rule.categories);

  if (vehicleYear) {
    const vehicleAge = new Date().getFullYear() - vehicleYear;

    if (vehicleAge >= 6) {
      intervalItems.push(
        { category: "Inspect", service: "Rubber hoses and seals", note: "Age-based recommendation." },
        { category: "Inspect", service: "Suspension bushings", note: "Age-based recommendation." },
      );
    }

    if (vehicleAge >= 10) {
      intervalItems.push(
        { category: "Inspect", service: "Fuel and vapor lines", note: "Age-based recommendation." },
      );
    }
  }

  return {
    mileage,
    items: dedupeScheduleItems(intervalItems),
  };
};

const buildRuleBasedIntervals = (mileage: number, vehicleYear?: number | null) => {
  const roundedDownMileage = Math.max(5000, Math.floor(mileage / 5000) * 5000);
  const nextMileage = roundedDownMileage + 5000;

  return {
    current: buildRuleInterval(roundedDownMileage, vehicleYear),
    next: buildRuleInterval(nextMileage, vehicleYear),
  };
};

export const getMaintenanceSchedulePreview = (
  input: VehicleScheduleInput,
): MaintenanceSchedulePreview | null => {
  const make = String(input.make || "").trim();
  const model = String(input.model || "").trim();
  const mileageValue = Number(String(input.mileage || "").replace(/,/g, "").trim());
  const yearValue = Number(String(input.year || "").trim());

  if (!make || !model || Number.isNaN(mileageValue) || mileageValue <= 0) {
    return null;
  }

  const yearLabel = Number.isNaN(yearValue) ? "" : `${yearValue} `;
  const vehicleLabel = `${yearLabel}${make} ${model}`.trim();
  const vehicleKey = buildVehicleKey(input);
  const oemSchedule = vehicleKey ? OEM_MAINTENANCE_SCHEDULES[vehicleKey] : null;

  if (oemSchedule) {
    const current =
      [...oemSchedule.intervals]
        .filter((interval) => interval.mileage <= mileageValue)
        .sort((a, b) => b.mileage - a.mileage)[0] ?? null;
    const next =
      [...oemSchedule.intervals]
        .filter((interval) => interval.mileage > mileageValue)
        .sort((a, b) => a.mileage - b.mileage)[0] ?? null;

    return {
      source: "oem",
      current,
      next,
      vehicleLabel: oemSchedule.label || vehicleLabel,
    };
  }

  const { current, next } = buildRuleBasedIntervals(
    mileageValue,
    Number.isNaN(yearValue) ? null : yearValue,
  );

  return {
    source: "rules",
    current,
    next,
    vehicleLabel,
  };
};
