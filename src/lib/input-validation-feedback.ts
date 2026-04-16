import { MAX_MODEL_YEAR } from "@/lib/input-formatters";

/**
 * User-facing messages when typed characters do not match what our normalizers keep.
 * Call with the **raw** field value (before normalize/format).
 */

export function getVinInputWarning(input: string): string | null {
  if (!input) {
    return null;
  }
  const bad = new Set<string>();
  for (const ch of input) {
    if (ch === " " || ch === "-" || ch === "\t") {
      continue;
    }
    if (!/[A-Za-z0-9]/.test(ch)) {
      bad.add(ch);
      continue;
    }
    const u = ch.toUpperCase();
    if ("IOQ".includes(u)) {
      bad.add(ch);
    }
  }
  if (bad.size === 0) {
    return null;
  }
  const list = [...bad].map((c) => `'${c}'`).join(", ");
  return `Invalid character(s): ${list}. Use letters A–Z except I, O, and Q, and digits 0–9. Spaces and dashes are ignored.`;
}

export function getYearInputWarning(
  input: string,
  maxYear: number = MAX_MODEL_YEAR,
): string | null {
  if (!input) {
    return null;
  }
  if (/\D/.test(input)) {
    return `Remove non-digit characters. Model year uses digits 0–9 only (maximum ${maxYear}).`;
  }
  const digits = input.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 4) {
    const y = Number(digits);
    if (!Number.isNaN(y) && y > maxYear) {
      return `Year cannot be later than ${maxYear}.`;
    }
  }
  return null;
}

export function getPhoneInputWarning(input: string): string | null {
  if (!input.trim()) {
    return null;
  }
  if (/[A-Za-z]/.test(input)) {
    return "Phone numbers can only include digits (0–9) and common separators; letters are not allowed.";
  }
  return null;
}

export function getPhoneExtensionInputWarning(input: string): string | null {
  if (!input) {
    return null;
  }
  const nonDigits = input.replace(/\d/g, "");
  if (nonDigits.length > 0) {
    const uniq = [...new Set(nonDigits.split(""))].join(", ");
    return `Extension can only contain digits (0–9). Remove: ${uniq}`;
  }
  return null;
}

export function getEmailInputWarning(input: string): string | null {
  if (!input) {
    return null;
  }
  if (/\s/.test(input)) {
    return "Email addresses cannot contain spaces. Remove spaces or use a single address.";
  }
  return null;
}

/** Mileage uses digits; commas/spaces are formatted automatically. */
export function getMileageInputWarning(input: string): string | null {
  if (!input) {
    return null;
  }
  const invalid = input.replace(/[\d,.\s]/g, "");
  if (!invalid.length) {
    return null;
  }
  const uniq = [...new Set(invalid.split(""))].map((c) => `'${c}'`).join(", ");
  return `Mileage uses digits only; commas are added automatically. Invalid: ${uniq}`;
}

/** License plate: printable ASCII only (normalize uppercases & spaces). */
export function getLicensePlateInputWarning(input: string): string | null {
  if (!input) {
    return null;
  }
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code > 126) {
      return "Use standard keyboard characters for the plate (letters, numbers, spaces, and common symbols). Emoji and special Unicode characters are not allowed.";
    }
  }
  return null;
}
