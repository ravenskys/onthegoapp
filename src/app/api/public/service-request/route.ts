import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ServiceRequestPayload = {
  fullName?: unknown;
  phoneNumber?: unknown;
  email?: unknown;
  serviceNeeded?: unknown;
  details?: unknown;
};

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const serviceOptions = new Set([
  "Oil Change",
  "Fluid Service",
  "Preventive Maintenance",
  "Inspection",
  "Fleet Service",
  "Other",
]);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ServiceRequestPayload;
    const fullName = normalizeString(body.fullName);
    const phoneNumber = normalizeString(body.phoneNumber);
    const email = normalizeString(body.email).toLowerCase();
    const serviceNeeded = normalizeString(body.serviceNeeded);
    const details = normalizeString(body.details);

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    if (!serviceNeeded || !serviceOptions.has(serviceNeeded)) {
      return NextResponse.json({ error: "Choose a valid service." }, { status: 400 });
    }

    if (!details) {
      return NextResponse.json(
        { error: "Add a few details so the manager can review the request." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server environment variables are missing." },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabaseAdmin.from("service_requests").insert({
      status: "new",
      source: "website_public_form",
      requested_service: serviceNeeded,
      service_details: details,
      contact_name: fullName,
      contact_phone: phoneNumber,
      contact_email: email || null,
      notes: "Submitted from the public contact request form.",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 },
    );
  }
}
