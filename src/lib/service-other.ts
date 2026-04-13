/** Shared sentinel for custom "Other" service flows (not a DB `service_catalog.id`). */
export const REPAIR_OTHER_SERVICE_CODE = "repair_other";

export const CUSTOMER_OTHER_SERVICE_ID = "__otg_customer_other__";

/** `Select` value on manager create-job (distinct from any `service_name`). */
export const MANAGER_OTHER_SERVICE_VALUE = "__otg_manager_other__";

/** `Select` value when adding a service from catalog on job detail. */
export const CATALOG_OTHER_SERVICE_ID = "__otg_catalog_other__";

/** Create job: pick to add a vehicle not yet on the customer account. */
export const MANAGER_OTHER_VEHICLE_VALUE = "__otg_vehicle_other__";

/** Job parts: supplier not in the saved suppliers list — type a one-off name. */
export const PART_SUPPLIER_OTHER_VALUE = "__otg_part_supplier_other__";

export function parseOptionalDecimal(value: string): number | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Bookable row shape from `service_catalog` (customer schedule). */
export type CustomerCatalogServiceLike = {
  service_code: string | null;
  service_name: string;
};

/**
 * True when this selection should skip the calendar and use
 * `create_customer_unscheduled_job_request` (review / follow-up first).
 */
export function isCustomerUnscheduledServiceRequest(
  selectedServiceId: string,
  service: CustomerCatalogServiceLike | null | undefined,
): boolean {
  if (selectedServiceId === CUSTOMER_OTHER_SERVICE_ID) return true;
  if (!service) return false;
  const code = (service.service_code || "").trim().toLowerCase();
  if (code === REPAIR_OTHER_SERVICE_CODE) return true;
  const name = (service.service_name || "").trim().toLowerCase();
  if (name.includes("repair") && name.includes("other")) return true;
  if (name.startsWith("other") && name.includes("describe")) return true;
  return false;
}
