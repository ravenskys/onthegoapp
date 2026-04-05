import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required." },
        { status: 400 }
      );
    }

    const allowedRoles = ["customer", "technician", "manager", "admin"];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server environment variables are missing." },
        { status: 500 }
      );
    }

    const authorizationHeader = req.headers.get("authorization");
    const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "You must be signed in to assign roles." },
        { status: 401 }
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
        { status: 401 }
      );
    }

    const { data: adminRoles, error: adminRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .limit(1);

    if (adminRolesError) {
      return NextResponse.json(
        { error: adminRolesError.message },
        { status: 500 }
      );
    }

    if (!adminRoles?.length) {
      return NextResponse.json(
        { error: "Only admins can assign roles." },
        { status: 403 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const perPage = 200;
    let page = 1;
    let matchedUser: { id: string } | null = null;

    while (!matchedUser) {
      const { data: usersData, error: usersError } =
        await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

      if (usersError) {
        return NextResponse.json(
          { error: usersError.message },
          { status: 500 }
        );
      }

      matchedUser =
        usersData.users.find(
          (user) => user.email?.trim().toLowerCase() === normalizedEmail
        ) ?? null;

      if (matchedUser || usersData.users.length < perPage) {
        break;
      }

      page += 1;
    }

    if (!matchedUser) {
      return NextResponse.json(
        { error: "No auth user found for that email." },
        { status: 404 }
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: matchedUser.id,
          role,
        },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      return NextResponse.json(
        { error: roleError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
