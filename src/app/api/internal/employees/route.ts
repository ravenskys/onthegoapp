import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PortalRole } from "@/lib/portal-auth";

type EmployeeProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  employment_status: string | null;
};

type UserRoleRow = {
  user_id: string;
  role: PortalRole;
};

const INTERNAL_ROLES: PortalRole[] = ["technician", "manager", "admin"];

function getClients(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Server environment variables are missing." },
        { status: 500 },
      ),
    };
  }

  const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: "You must be signed in to view employees." },
        { status: 401 },
      ),
    };
  }

  return {
    accessToken,
    supabaseAuth: createClient(supabaseUrl, supabaseAnonKey),
    supabaseAdmin: createClient(supabaseUrl, serviceRoleKey),
  };
}

export async function GET(req: Request) {
  const clients = getClients(req);
  if ("error" in clients) {
    return clients.error;
  }

  const { accessToken, supabaseAdmin, supabaseAuth } = clients;

  const {
    data: { user: requestingUser },
    error: requestingUserError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (requestingUserError || !requestingUser) {
    return NextResponse.json(
      { error: "Your session is no longer valid. Please log in again." },
      { status: 401 },
    );
  }

  const { data: requesterRoleRows, error: requesterRolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", requestingUser.id);

  if (requesterRolesError) {
    return NextResponse.json({ error: requesterRolesError.message }, { status: 500 });
  }

  const requesterRoles = (requesterRoleRows ?? []).map((row) => row.role as PortalRole);
  const requesterIsAdmin = requesterRoles.includes("admin");
  const requesterCanManageEmployees = requesterIsAdmin || requesterRoles.includes("manager");

  if (!requesterCanManageEmployees) {
    return NextResponse.json(
      { error: "Only managers and admins can view employees." },
      { status: 403 },
    );
  }

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", INTERNAL_ROLES);

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  const roleMap = new Map<string, PortalRole[]>();
  for (const row of (roleRows ?? []) as UserRoleRow[]) {
    const current = roleMap.get(row.user_id) ?? [];
    if (!current.includes(row.role)) {
      current.push(row.role);
      roleMap.set(row.user_id, current);
    }
  }

  const employeeIds = [...roleMap.keys()];
  if (employeeIds.length === 0) {
    return NextResponse.json({
      requesterIsAdmin,
      employees: [],
    });
  }

  const { data: profileRows, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, first_name, last_name, employment_status")
    .in("id", employeeIds)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const employees = ((profileRows ?? []) as EmployeeProfileRow[])
    .map((profile) => {
      const roles = (roleMap.get(profile.id) ?? []).sort();
      const targetIsPrivileged = roles.includes("admin") || roles.includes("manager");

      return {
        id: profile.id,
        email: profile.email ?? "",
        firstName: profile.first_name ?? "",
        lastName: profile.last_name ?? "",
        employmentStatus: profile.employment_status ?? "active",
        roles,
        canEdit: requesterIsAdmin || !targetIsPrivileged,
        adminOnlyTarget: targetIsPrivileged,
      };
    })
    .sort((a, b) => {
      const aPrivileged = a.roles.includes("admin") || a.roles.includes("manager");
      const bPrivileged = b.roles.includes("admin") || b.roles.includes("manager");
      if (aPrivileged !== bPrivileged) return aPrivileged ? -1 : 1;
      return `${a.lastName} ${a.firstName} ${a.email}`.localeCompare(
        `${b.lastName} ${b.firstName} ${b.email}`,
      );
    });

  return NextResponse.json({
    requesterIsAdmin,
    employees,
  });
}
