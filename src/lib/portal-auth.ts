import { supabase } from "@/lib/supabase";

export type PortalRole = "customer" | "technician" | "manager" | "admin";
export type PortalDestination = "customer" | "tech" | "manager" | "admin";

/**
 * Which roles may use each portal destination (inheritance / hierarchy):
 * - Admin → customer, tech, manager, and admin areas
 * - Manager → customer, tech, and manager (not admin)
 * - Technician → customer and tech
 * - Customer → customer only
 */
const portalAccessMap: Record<PortalDestination, PortalRole[]> = {
  customer: ["customer", "technician", "manager", "admin"],
  tech: ["technician", "manager", "admin"],
  manager: ["manager", "admin"],
  admin: ["admin"],
};

/** Display / sort order: highest privilege first. */
export const PORTAL_ROLE_HIERARCHY: PortalRole[] = [
  "admin",
  "manager",
  "technician",
  "customer",
];

export const getDistinctRoles = (roles: PortalRole[]) =>
  Array.from(new Set(roles));

export const hasPortalAccess = (
  roles: PortalRole[],
  destination: PortalDestination,
) => portalAccessMap[destination].some((role) => roles.includes(role));

export const getAccessiblePortals = (roles: PortalRole[]) =>
  (Object.keys(portalAccessMap) as PortalDestination[]).filter((destination) =>
    hasPortalAccess(roles, destination),
  );

export const hasMultiplePortalAccess = (roles: PortalRole[]) =>
  getAccessiblePortals(roles).length > 1;

export const getUserRoles = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, roles: [] as PortalRole[] };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error || !data) {
    return { user, roles: [] as PortalRole[] };
  }

  return {
    user,
    roles: getDistinctRoles(data.map((row) => row.role as PortalRole)),
  };
};

export const getPrimaryPortalRoute = (roles: PortalRole[]) => {
  if (hasPortalAccess(roles, "admin")) return "/admin";
  if (hasPortalAccess(roles, "manager")) return "/manager";
  if (hasPortalAccess(roles, "tech")) return "/tech";
  if (hasPortalAccess(roles, "customer")) return "/customer/dashboard";
  return "/customer/login";
};

export const getPostLoginRoute = (roles: PortalRole[]) => {
  if (hasMultiplePortalAccess(roles)) {
    return "/portal";
  }

  return getPrimaryPortalRoute(roles);
};

export const hasAnyRole = (roles: PortalRole[], allowedRoles: PortalRole[]) =>
  allowedRoles.some((role) => roles.includes(role));
