import { normalizeYear } from "@/lib/input-formatters";
import { findVehicleCatalogMake, getVehicleCatalogModels } from "@/lib/vehicleCatalog";

/** Weights for ISO 3779 check digit (position 9, index 8). */
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

function vinCharValue(c: string): number {
  const u = c.toUpperCase();
  if (/^\d$/.test(u)) {
    return parseInt(u, 10);
  }
  return LETTER_VALUES[u] ?? 0;
}

/** Returns true if the 9th character matches the ISO 3779 check digit. */
export function validateVinCheckDigit(vin: string): boolean {
  if (vin.length !== 17) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += vinCharValue(vin[i]) * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8].toUpperCase() === expected;
}

/** Basic pattern: 17 chars, no I/O/Q (already stripped in normalizeVin). */
export function isValidVinFormat(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export type VinDecodeApplyResult = {
  year: string;
  make: string;
  model: string;
  engineSize: string;
  useCustomMake: boolean;
  useCustomModel: boolean;
  useCustomEngineSize: boolean;
};

/**
 * Maps NHTSA DecodeVinValues fields onto catalog / custom flags used by VehicleCatalogFields.
 */
export function mapNhtsaDecodeToVehicleFields(
  modelYear: string,
  makeRaw: string,
  modelRaw: string,
): VinDecodeApplyResult {
  const year = normalizeYear(String(modelYear || "").replace(/\D/g, "").slice(0, 4));
  const makeTrim = String(makeRaw || "").trim();
  const modelTrim = String(modelRaw || "").trim();

  const catalogMake = findVehicleCatalogMake(makeTrim);
  const useCustomMake = !catalogMake;
  const make = catalogMake ?? makeTrim;

  if (!catalogMake || !year) {
    return {
      year,
      make,
      model: modelTrim,
      engineSize: "",
      useCustomMake,
      useCustomModel: true,
      useCustomEngineSize: false,
    };
  }

  const models = getVehicleCatalogModels(catalogMake, year);
  const exact = models.find((m) => m.toLowerCase() === modelTrim.toLowerCase());
  if (exact) {
    return {
      year,
      make,
      model: exact,
      engineSize: "",
      useCustomMake: false,
      useCustomModel: false,
      useCustomEngineSize: false,
    };
  }

  const lower = modelTrim.toLowerCase();
  const partial = models.find(
    (m) =>
      lower.includes(m.toLowerCase()) ||
      m.toLowerCase().includes(lower.split(/\s+/)[0] ?? ""),
  );

  if (partial) {
    return {
      year,
      make,
      model: partial,
      engineSize: "",
      useCustomMake: false,
      useCustomModel: false,
      useCustomEngineSize: false,
    };
  }

  return {
    year,
    make,
    model: modelTrim,
    engineSize: "",
    useCustomMake: false,
    useCustomModel: true,
    useCustomEngineSize: false,
  };
}
