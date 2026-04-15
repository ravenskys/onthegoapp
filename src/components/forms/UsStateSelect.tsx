"use client";

import {
  DEFAULT_US_STATE_CODE,
  normalizeUsStateCode,
  US_STATE_CODE_SET,
  US_STATES_SORTED_BY_NAME,
} from "@/lib/us-states";

type UsStateSelectProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  /** When no valid code is set, use this (default: Idaho). */
  defaultCode?: string;
};

export function UsStateSelect({
  id,
  value,
  onChange,
  className = "",
  required,
  disabled,
  autoComplete = "address-level1",
  defaultCode = DEFAULT_US_STATE_CODE,
}: UsStateSelectProps) {
  const raw = String(value ?? "").trim().toUpperCase().slice(0, 2);
  const showOrphan = Boolean(raw && !US_STATE_CODE_SET.has(raw));
  const resolved = normalizeUsStateCode(value);
  const selectedValue = showOrphan ? raw : resolved || defaultCode;

  return (
    <select
      id={id}
      value={selectedValue}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
    >
      {showOrphan ? (
        <option value={raw}>
          {raw} (unrecognized — pick a state)
        </option>
      ) : null}
      {US_STATES_SORTED_BY_NAME.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
