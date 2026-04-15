/** All 50 U.S. state names with USPS two-letter codes. */
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const sortByName = (a: { code: string; name: string }, b: { code: string; name: string }) =>
  a.name.localeCompare(b.name);

/** All 50 states A–Z by full name (Idaho appears in normal alphabetical order). */
export const US_STATES_SORTED_BY_NAME = [...US_STATES].sort(sortByName);

/** Default two-letter code when no state is stored yet (shop home state). */
export const DEFAULT_US_STATE_CODE: string = "ID";

export const US_STATE_CODE_SET = new Set(US_STATES.map((s) => s.code));

/** Returns a valid two-letter code or "". */
export function normalizeUsStateCode(raw: string | null | undefined): string {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  return US_STATE_CODE_SET.has(v) ? v : "";
}

/** Value for controlled selects: valid code, short raw for orphan rows, or shop default when empty. */
export function resolveUsStateForForm(raw: string | null | undefined): string {
  const norm = normalizeUsStateCode(raw);
  if (norm) return norm;
  const t = String(raw ?? "").trim();
  if (t.length >= 1) return t.slice(0, 2).toUpperCase();
  return DEFAULT_US_STATE_CODE;
}
