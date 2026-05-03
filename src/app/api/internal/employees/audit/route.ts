import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PortalRole } from "@/lib/portal-auth";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server environment variables are missing." },
      { status: 500 },
    );
  }

  const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "You must be signed in to view the employee audit log." },
      { status: 401 },
    );
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
  if (!requesterRoles.includes("admin")) {
    return NextResponse.json(
      { error: "Only admins can view the employee audit log." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("employee_account_audit")
    .select(
      "id, actor_user_id, actor_email, actor_roles, target_user_id, target_email, action_type, old_values, new_values, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}
