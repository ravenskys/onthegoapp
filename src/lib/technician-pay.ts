import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Latest pay row for a technician on or before `asOfDate` (YYYY-MM-DD).
 * Used to compute shop labor cost for jobs assigned to that technician.
 */
export async function getTechnicianHourlyPayAsOf(
  supabase: SupabaseClient,
  technicianUserId: string,
  asOfDateYmd: string,
): Promise<{ hourly_pay: number; effective_date: string } | null> {
  const { data, error } = await supabase
    .from("technician_pay_rates")
    .select("hourly_pay, effective_date")
    .eq("technician_user_id", technicianUserId)
    .lte("effective_date", asOfDateYmd)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    // PGRST205: table missing until migration is applied — avoid noisy devtools errors.
    if (code !== "PGRST205") {
      console.warn("technician_pay_rates lookup failed:", error);
    }
    return null;
  }

  if (!data || data.hourly_pay == null) return null;

  return {
    hourly_pay: Number(data.hourly_pay),
    effective_date: String(data.effective_date),
  };
}
