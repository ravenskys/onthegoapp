import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PortalRole } from "@/lib/portal-auth";

const ALLOWED_EMPLOYMENT_STATUSES = ["active", "inactive", "on_leave", "terminated"] as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
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
        { error: "You must be signed in to update employees." },
        { status: 401 },
      );
    }

    const { userId } = await context.params;
    const body = await req.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const employmentStatus = String(body.employmentStatus ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!ALLOWED_EMPLOYMENT_STATUSES.includes(employmentStatus as (typeof ALLOWED_EMPLOYMENT_STATUSES)[number])) {
      return NextResponse.json(
        { error: "Choose a valid employment status." },
        { status: 400 },
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
    const requesterIsAdmin = requesterRoles.includes("admin");
    const requesterIsManager = requesterRoles.includes("manager");

    if (!requesterIsAdmin && !requesterIsManager) {
      return NextResponse.json(
        { error: "Only managers and admins can update employees." },
        { status: 403 },
      );
    }

    const { data: targetRoleRows, error: targetRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRolesError) {
      return NextResponse.json({ error: targetRolesError.message }, { status: 500 });
    }

    const targetRoles = (targetRoleRows ?? []).map((row) => row.role as PortalRole);
    const targetIsPrivileged = targetRoles.includes("admin") || targetRoles.includes("manager");

    if (!requesterIsAdmin && targetIsPrivileged) {
      return NextResponse.json(
        { error: "Only admins can edit manager or admin accounts." },
        { status: 403 },
      );
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, employment_status")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      return NextResponse.json({ error: targetProfileError.message }, { status: 500 });
    }

    if (!targetProfile) {
      return NextResponse.json({ error: "Employee profile not found." }, { status: 404 });
    }

    const oldValues = {
      email: targetProfile.email ?? "",
      firstName: targetProfile.first_name ?? "",
      lastName: targetProfile.last_name ?? "",
      employmentStatus: targetProfile.employment_status ?? "active",
      roles: targetRoles,
    };

    const authUpdateResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authUpdateResult.error) {
      return NextResponse.json({ error: authUpdateResult.error.message }, { status: 500 });
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        employment_status: employmentStatus,
      })
      .eq("id", userId);

    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
    }

    const newValues = {
      email,
      firstName,
      lastName,
      employmentStatus: employmentStatus,
      roles: targetRoles,
    };

    const { error: auditInsertError } = await supabaseAdmin.from("employee_account_audit").insert({
      actor_user_id: requestingUser.id,
      actor_email: requestingUser.email?.trim().toLowerCase() ?? null,
      actor_roles: requesterRoles,
      target_user_id: userId,
      target_email: email,
      action_type: "employee_account_updated",
      old_values: oldValues,
      new_values: newValues,
    });

    if (auditInsertError) {
      return NextResponse.json({ error: auditInsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: targetProfile.id,
        email,
        firstName,
        lastName,
        employmentStatus,
        roles: targetRoles,
        canEdit: true,
        adminOnlyTarget: targetIsPrivileged,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 },
    );
  }
}
