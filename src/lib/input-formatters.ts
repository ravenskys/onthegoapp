export const MAX_MODEL_YEAR = new Date().getFullYear() + 1;

export const formatPhoneNumber = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const normalizeEmail = (value: string) =>
  String(value || "").trim().toLowerCase();

export const normalizeYear = (value: string, maxYear = MAX_MODEL_YEAR) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";

  const yearNumber = Number(digits);
  if (Number.isNaN(yearNumber)) return "";

  return String(Math.min(yearNumber, maxYear));
};

export const formatMileage = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
};

export const normalizeVin = (value: string) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[IOQ]/g, "")
    .slice(0, 17);

export const normalizeLicensePlate = (value: string) =>
  String(value || "").toUpperCase().replace(/\s+/g, " ").trim();
