import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type CustomerIdRow = {
  id: string;
};

type OwnedJobRow = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  status: string | null;
  intake_state: string | null;
  service_type: string | null;
  service_description: string | null;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_tech_user_id: string | null;
  service_duration_minutes: number | null;
  travel_time_minutes: number | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
};

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
        { error: "You must be signed in to manage appointments." },
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

async function getOwnedJobContext(
  accessToken: string,
  jobId: string,
  supabaseAuth: any,
  supabaseAdmin: any,
) {
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Your session is no longer valid. Please log in again." },
        { status: 401 },
      ),
    };
  }

  const { data: customerRow, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (customerError) {
    return { error: NextResponse.json({ error: customerError.message }, { status: 500 }) };
  }

  const customer = (customerRow as CustomerIdRow | null) ?? null;

  if (!customer?.id) {
    return {
      error: NextResponse.json(
        { error: "Customer account is not linked yet." },
        { status: 403 },
      ),
    };
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select(
      "id, customer_id, vehicle_id, status, intake_state, service_type, service_description, notes, scheduled_start, scheduled_end, assigned_tech_user_id, service_duration_minutes, travel_time_minutes, service_location_name, service_address, service_city, service_state, service_zip",
    )
    .eq("id", jobId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (jobError) {
    return { error: NextResponse.json({ error: jobError.message }, { status: 500 }) };
  }

  const ownedJob = (job as OwnedJobRow | null) ?? null;

  if (!ownedJob) {
    return { error: NextResponse.json({ error: "Appointment not found." }, { status: 404 }) };
  }

  return { customerId: customer.id, job: ownedJob };
}

function isEditableAppointment(scheduledStart: string | null | undefined) {
  if (!scheduledStart) {
    return false;
  }
  return new Date(scheduledStart).getTime() - Date.now() > EDIT_WINDOW_MS;
}

function normalizeText(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const clients = getClients(req);
  if ("error" in clients) {
    return clients.error;
  }

  const { jobId } = await context.params;
  const ownership = await getOwnedJobContext(
    clients.accessToken,
    jobId,
    clients.supabaseAuth,
    clients.supabaseAdmin,
  );

  if ("error" in ownership) {
    return ownership.error;
  }

  const { customerId, job } = ownership;

  if (job.status === "completed" || job.status === "cancelled") {
    return NextResponse.json(
      { error: "This appointment can no longer be changed." },
      { status: 400 },
    );
  }

  if (!isEditableAppointment(job.scheduled_start)) {
    return NextResponse.json(
      { error: "Appointments can only be edited more than 1 day before the scheduled start time." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const vehicleId = String(body.vehicleId ?? "").trim();
  const technicianUserId = String(body.technicianUserId ?? "").trim();
  const serviceType = String(body.serviceType ?? "").trim();
  const serviceDescription = String(body.serviceDescription ?? "").trim();
  const scheduledStart = new Date(String(body.scheduledStart ?? ""));
  const scheduledEnd = new Date(String(body.scheduledEnd ?? ""));
  const serviceDurationMinutes = Math.max(
    15,
    Math.min(Number(body.serviceDurationMinutes ?? 60) || 60, 480),
  );
  const travelTimeMinutes = Math.max(
    0,
    Math.min(Number(body.travelTimeMinutes ?? 0) || 0, 240),
  );

  if (!vehicleId) {
    return NextResponse.json({ error: "Vehicle is required." }, { status: 400 });
  }
  if (!technicianUserId) {
    return NextResponse.json({ error: "Technician selection is required." }, { status: 400 });
  }
  if (!serviceType) {
    return NextResponse.json({ error: "Service type is required." }, { status: 400 });
  }
  if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime())) {
    return NextResponse.json({ error: "A valid appointment time is required." }, { status: 400 });
  }
  if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
    return NextResponse.json(
      { error: "Scheduled end time must be after the start time." },
      { status: 400 },
    );
  }

  const { data: vehicleRow, error: vehicleError } = await clients.supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (vehicleError) {
    return NextResponse.json({ error: vehicleError.message }, { status: 500 });
  }
  if (!vehicleRow?.id) {
    return NextResponse.json(
      { error: "The selected vehicle is not linked to this customer account." },
      { status: 400 },
    );
  }

  const { data: availabilityBlock, error: availabilityError } = await clients.supabaseAdmin
    .from("technician_schedule_blocks")
    .select("id")
    .eq("technician_user_id", technicianUserId)
    .eq("status", "active")
    .eq("block_type", "available")
    .lte("starts_at", scheduledStart.toISOString())
    .gte("ends_at", scheduledEnd.toISOString())
    .limit(1)
    .maybeSingle();

  if (availabilityError) {
    return NextResponse.json({ error: availabilityError.message }, { status: 500 });
  }
  if (!availabilityBlock?.id) {
    return NextResponse.json(
      { error: "That service time is no longer available." },
      { status: 409 },
    );
  }

  const { data: conflictingJob, error: conflictJobError } = await clients.supabaseAdmin
    .from("jobs")
    .select("id, scheduled_start, scheduled_end")
    .eq("assigned_tech_user_id", technicianUserId)
    .neq("id", job.id)
    .not("status", "in", '("cancelled","completed")')
    .lt("scheduled_start", scheduledEnd.toISOString())
    .or(`scheduled_end.gt.${scheduledStart.toISOString()},scheduled_end.is.null`)
    .limit(1)
    .maybeSingle();

  if (conflictJobError) {
    return NextResponse.json({ error: conflictJobError.message }, { status: 500 });
  }
  if (conflictingJob?.id) {
    return NextResponse.json(
      { error: "That service time was just booked. Please choose another time." },
      { status: 409 },
    );
  }

  const { error: updateError } = await clients.supabaseAdmin
    .from("jobs")
    .update({
      vehicle_id: vehicleId,
      assigned_tech_user_id: technicianUserId,
      requested_date: scheduledStart.toISOString().slice(0, 10),
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      service_type: serviceType,
      service_description: normalizeText(serviceDescription),
      notes: normalizeText(body.notes),
      service_duration_minutes: serviceDurationMinutes,
      travel_time_minutes: travelTimeMinutes,
      service_location_name: normalizeText(body.serviceLocationName),
      service_address: normalizeText(body.serviceAddress),
      service_city: normalizeText(body.serviceCity),
      service_state: normalizeText(body.serviceState)?.toUpperCase() ?? null,
      service_zip: normalizeText(body.serviceZip),
    })
    .eq("id", job.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const clients = getClients(req);
  if ("error" in clients) {
    return clients.error;
  }

  const { jobId } = await context.params;
  const ownership = await getOwnedJobContext(
    clients.accessToken,
    jobId,
    clients.supabaseAuth,
    clients.supabaseAdmin,
  );

  if ("error" in ownership) {
    return ownership.error;
  }

  const { job } = ownership;

  if (job.status === "completed" || job.status === "cancelled") {
    return NextResponse.json(
      { error: "This appointment can no longer be cancelled." },
      { status: 400 },
    );
  }

  const nextNotes = [job.notes?.trim(), `Customer cancelled this appointment on ${new Date().toLocaleString()}.`]
    .filter(Boolean)
    .join("\n\n");

  const { error: cancelError } = await clients.supabaseAdmin
    .from("jobs")
    .update({
      status: "cancelled",
      intake_state: null,
      notes: nextNotes || null,
    })
    .eq("id", job.id);

  if (cancelError) {
    return NextResponse.json({ error: cancelError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
