import { supabase } from "@/lib/supabase";

export type PortalRole = "customer" | "technician" | "manager" | "admin";

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
    roles: data.map((row) => row.role as PortalRole),
  };
};

export const getPrimaryPortalRoute = (roles: PortalRole[]) => {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("manager")) return "/manager";
  if (roles.includes("technician")) return "/tech";
  if (roles.includes("customer")) return "/customer/dashboard";
  return "/customer/login";
};

export const getPostLoginRoute = (roles: PortalRole[]) => {
  if (roles.length > 1) {
    return "/portal";
  }

  return getPrimaryPortalRoute(roles);
};

export const hasAnyRole = (roles: PortalRole[], allowedRoles: PortalRole[]) =>
  allowedRoles.some((role) => roles.includes(role));
