/**
 * Customer-facing labor sell rate ($/hr). Matches admin service catalog:
 * `default_price = (durationMinutes / 60) * LABOR_SELL_USD_PER_HOUR`
 * @see calculateLaborDefaultsFromDuration in admin settings
 */
export const LABOR_SELL_USD_PER_HOUR = 120;

/**
 * Default internal labor cost rate ($/hr) for estimated shop cost on job lines.
 * Not persisted in business_settings yet; same “hours × rate” shape as sell.
 */
export const LABOR_COST_USD_PER_HOUR = 50;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function laborSellTotalFromHours(hours: number): number | null {
  if (!Number.isFinite(hours) || hours < 0) return null;
  return roundMoney(hours * LABOR_SELL_USD_PER_HOUR);
}

/** Shop labor cost when no per-technician pay is on file. */
export function laborCostTotalFromHours(hours: number): number | null {
  return laborShopCostFromHours(hours, null);
}

/**
 * Shop labor cost = hours × technician hourly pay when known; otherwise
 * hours × {@link LABOR_COST_USD_PER_HOUR}.
 */
export function laborShopCostFromHours(
  hours: number,
  technicianHourlyPay: number | null,
): number | null {
  if (!Number.isFinite(hours) || hours < 0) return null;
  const rate =
    technicianHourlyPay != null && Number.isFinite(technicianHourlyPay) && technicianHourlyPay >= 0
      ? technicianHourlyPay
      : LABOR_COST_USD_PER_HOUR;
  return roundMoney(hours * rate);
}
