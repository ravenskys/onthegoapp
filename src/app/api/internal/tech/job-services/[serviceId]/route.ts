import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PortalRole } from "@/lib/portal-auth";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ serviceId: string }> },
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
        { error: "You must be signed in to remove services." },
        { status: 401 },
      );
    }

    const { serviceId } = await context.params;
    if (!serviceId) {
      return NextResponse.json({ error: "Service id is required." }, { status: 400 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const continueDelete = async () => {
      const { error: deleteError } = await supabaseAdmin
        .from("job_services")
        .delete()
        .eq("id", serviceId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, deletedId: serviceId });
    };

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session is no longer valid. Please log in again." },
        { status: 401 },
      );
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    const roles = (roleRows ?? []).map((row) => row.role as PortalRole);
    const isManagerOrAdmin = roles.includes("manager") || roles.includes("admin");
    const isTechCapable =
      isManagerOrAdmin || roles.includes("technician");

    if (!isTechCapable) {
      return NextResponse.json(
        { error: "Only technician, manager, or admin accounts can remove service lines." },
        { status: 403 },
      );
    }

    const { data: serviceRow, error: serviceError } = await supabaseAdmin
      .from("job_services")
      .select("id, job_id")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      return NextResponse.json({ error: serviceError.message }, { status: 500 });
    }

    if (!serviceRow) {
      return NextResponse.json({ error: "Service line not found." }, { status: 404 });
    }

    if (!isManagerOrAdmin) {
      const { data: jobRow, error: jobError } = await supabaseAdmin
        .from("jobs")
        .select("id, assigned_tech_user_id")
        .eq("id", serviceRow.job_id)
        .maybeSingle();

      if (jobError) {
        return NextResponse.json({ error: jobError.message }, { status: 500 });
      }

      if (!jobRow) {
        return NextResponse.json(
          { error: "You can only remove services from jobs assigned to you." },
          { status: 403 },
        );
      }

      const directlyAssigned = jobRow.assigned_tech_user_id === user.id;
      if (!directlyAssigned) {
        const { data: assignmentRow, error: assignmentError } = await supabaseAdmin
          .from("job_assignments")
          .select("id")
          .eq("job_id", serviceRow.job_id)
          .eq("technician_user_id", user.id)
          .maybeSingle();

        if (assignmentError) {
          return NextResponse.json({ error: assignmentError.message }, { status: 500 });
        }

        if (assignmentRow) {
          return continueDelete();
        }

        return NextResponse.json(
          { error: "You can only remove services from jobs assigned to you." },
          { status: 403 },
        );
      }
    }

    return continueDelete();
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 },
    );
  }
}
