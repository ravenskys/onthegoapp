/** How a job entered the system (`public.jobs.source`). */
export function formatJobSourceLabel(source: string | null | undefined): string {
  if (source === "customer_portal") return "Customer portal";
  if (source === "manual" || source == null || source === "") return "Shop / manager";
  return source;
}

export function isCustomerPortalJob(source: string | null | undefined): boolean {
  return source === "customer_portal";
}
