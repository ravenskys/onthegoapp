import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type PortalRole = "customer" | "technician" | "manager" | "admin";

type UserRolesResult = {
  user: User | null;
  roles: PortalRole[];
};

/**
 * Supabase `auth.getUser()` uses the Web Locks API in the browser. Many components
 * calling `getUserRoles()` at once can trigger "Lock broken by another request
 * with the 'steal' option" (AbortError). Share one in-flight request instead.
 */
let inflightUserRoles: Promise<UserRolesResult> | null = null;

async function loadUserRoles(): Promise<UserRolesResult> {
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
}
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

export const getUserRoles = async (): Promise<UserRolesResult> => {
  if (inflightUserRoles) {
    return inflightUserRoles;
  }

  inflightUserRoles = loadUserRoles().finally(() => {
    inflightUserRoles = null;
  });

  return inflightUserRoles;
};

export const getPrimaryPortalRoute = (roles: PortalRole[]) => {
  if (hasPortalAccess(roles, "admin")) return "/admin";
  if (hasPortalAccess(roles, "manager")) return "/manager";
  if (hasPortalAccess(roles, "tech")) return "/tech";
  if (hasPortalAccess(roles, "customer")) return "/customer/dashboard";
  return "/customer/login";
};

/**
 * After login, send users to their highest-priority portal home.
 * Multi-role switching uses the **Portals** menu in the header (not `/portal`).
 */
export const getPostLoginRoute = (roles: PortalRole[]) =>
  getPrimaryPortalRoute(roles);

/** Home URL for each portal area (used by nav / switcher). */
export const PORTAL_DESTINATION_HOME: Record<PortalDestination, string> = {
  customer: "/customer/dashboard",
  tech: "/tech",
  manager: "/manager",
  admin: "/admin",
};

export const PORTAL_DESTINATION_LABEL: Record<PortalDestination, string> = {
  customer: "Customer",
  tech: "Technician",
  manager: "Manager",
  admin: "Admin",
};

export function getPortalDestinationFromPathname(
  pathname: string,
): PortalDestination | null {
  if (pathname.startsWith("/customer")) {
    return "customer";
  }
  if (pathname.startsWith("/tech")) {
    return "tech";
  }
  if (pathname.startsWith("/manager")) {
    return "manager";
  }
  if (pathname.startsWith("/admin")) {
    return "admin";
  }
  return null;
}

export const hasAnyRole = (roles: PortalRole[], allowedRoles: PortalRole[]) =>
  allowedRoles.some((role) => roles.includes(role));
