import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type QuoteDecisionPayload = {
  lineItemId: string;
  decision: "approved" | "declined";
  note?: string;
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
        { error: "You must be signed in to review a quote." },
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

async function getOwnedEstimateContext(
  accessToken: string,
  estimateId: string,
  supabaseAuth: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Your session is no longer valid. Please log in again." }, { status: 401 }) };
  }

  const { data: customerRow, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (customerError) {
    return { error: NextResponse.json({ error: customerError.message }, { status: 500 }) };
  }

  if (!customerRow?.id) {
    return { error: NextResponse.json({ error: "Customer account is not linked yet." }, { status: 403 }) };
  }

  const { data: estimate, error: estimateError } = await supabaseAdmin
    .from("estimates")
    .select(
      "id, job_id, customer_id, vehicle_id, estimate_status, estimate_number, subtotal, tax_total, total_amount, notes, approved_at, declined_at, customer_signature_name, customer_signed_at, customer_signature_notes, customer_authorized_total",
    )
    .eq("id", estimateId)
    .eq("customer_id", customerRow.id)
    .maybeSingle();

  if (estimateError) {
    return { error: NextResponse.json({ error: estimateError.message }, { status: 500 }) };
  }

  if (!estimate) {
    return { error: NextResponse.json({ error: "Quote not found." }, { status: 404 }) };
  }

  return { user, customerId: customerRow.id, estimate };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ estimateId: string }> },
) {
  const clients = getClients(req);
  if ("error" in clients) {
    return clients.error;
  }

  const { estimateId } = await context.params;
  const ownership = await getOwnedEstimateContext(
    clients.accessToken,
    estimateId,
    clients.supabaseAuth,
    clients.supabaseAdmin,
  );

  if ("error" in ownership) {
    return ownership.error;
  }

  const { customerId, estimate } = ownership;

  const { data: lineItems, error: lineItemsError } = await clients.supabaseAdmin
    .from("estimate_line_items")
    .select("id, line_type, description, quantity, unit_price, taxable, sort_order, notes")
    .eq("estimate_id", estimate.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lineItemsError) {
    return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
  }

  const { data: decisionRows, error: decisionsError } = await clients.supabaseAdmin
    .from("estimate_line_item_customer_decisions")
    .select("estimate_line_item_id, decision, note, decided_at")
    .eq("estimate_id", estimate.id)
    .eq("customer_id", customerId);

  if (decisionsError) {
    return NextResponse.json({ error: decisionsError.message }, { status: 500 });
  }

  const decisionMap = new Map(
    (decisionRows ?? []).map((row) => [row.estimate_line_item_id, row]),
  );

  return NextResponse.json({
    estimate,
    lineItems: (lineItems ?? []).map((item) => ({
      ...item,
      decision: decisionMap.get(item.id)?.decision ?? null,
      customerNote: decisionMap.get(item.id)?.note ?? "",
      decidedAt: decisionMap.get(item.id)?.decided_at ?? null,
    })),
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ estimateId: string }> },
) {
  const clients = getClients(req);
  if ("error" in clients) {
    return clients.error;
  }

  const { estimateId } = await context.params;
  const ownership = await getOwnedEstimateContext(
    clients.accessToken,
    estimateId,
    clients.supabaseAuth,
    clients.supabaseAdmin,
  );

  if ("error" in ownership) {
    return ownership.error;
  }

  const { customerId, estimate, user } = ownership;

  const body = await req.json();
  const signatureName = String(body.signatureName ?? "").trim();
  const signatureNotes = String(body.signatureNotes ?? "").trim();
  const lineDecisions = Array.isArray(body.lineDecisions)
    ? (body.lineDecisions as QuoteDecisionPayload[])
    : [];

  if (!signatureName) {
    return NextResponse.json({ error: "Signature name is required." }, { status: 400 });
  }

  if (lineDecisions.length === 0) {
    return NextResponse.json({ error: "Review each quote line before signing." }, { status: 400 });
  }

  const { data: lineItems, error: lineItemsError } = await clients.supabaseAdmin
    .from("estimate_line_items")
    .select("id, quantity, unit_price")
    .eq("estimate_id", estimate.id);

  if (lineItemsError) {
    return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
  }

  const lineItemIds = (lineItems ?? []).map((item) => item.id);
  const requestIds = [...new Set(lineDecisions.map((item) => item.lineItemId))];

  if (
    lineItemIds.length === 0 ||
    requestIds.length !== lineItemIds.length ||
    lineItemIds.some((id) => !requestIds.includes(id))
  ) {
    return NextResponse.json(
      { error: "Every quote line must be approved or declined before signing." },
      { status: 400 },
    );
  }

  const invalidDecision = lineDecisions.find(
    (item) => item.decision !== "approved" && item.decision !== "declined",
  );
  if (invalidDecision) {
    return NextResponse.json({ error: "Each line must be marked approved or declined." }, { status: 400 });
  }

  const approvedIds = new Set(
    lineDecisions.filter((item) => item.decision === "approved").map((item) => item.lineItemId),
  );

  const authorizedTotal = Number(
    (lineItems ?? [])
      .reduce((sum, item) => {
        if (!approvedIds.has(item.id)) {
          return sum;
        }
        return sum + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
      }, 0)
      .toFixed(2),
  );

  const signedAt = new Date().toISOString();
  const upsertPayload = lineDecisions.map((item) => ({
    estimate_id: estimate.id,
    estimate_line_item_id: item.lineItemId,
    customer_id: customerId,
    decision: item.decision,
    note: String(item.note ?? "").trim() || null,
    decided_at: signedAt,
  }));

  const { error: upsertError } = await clients.supabaseAdmin
    .from("estimate_line_item_customer_decisions")
    .upsert(upsertPayload, { onConflict: "estimate_line_item_id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const approvedCount = approvedIds.size;
  const estimateStatus = approvedCount > 0 ? "approved" : "declined";

  const { error: estimateUpdateError } = await clients.supabaseAdmin
    .from("estimates")
    .update({
      estimate_status: estimateStatus,
      approved_at: approvedCount > 0 ? signedAt : null,
      declined_at: approvedCount === 0 ? signedAt : null,
      customer_signature_name: signatureName,
      customer_signed_at: signedAt,
      customer_signature_notes: signatureNotes || null,
      customer_signed_by_auth_user_id: user.id,
      customer_authorized_total: authorizedTotal,
    })
    .eq("id", estimate.id);

  if (estimateUpdateError) {
    return NextResponse.json({ error: estimateUpdateError.message }, { status: 500 });
  }

  if (estimate.job_id && approvedCount > 0) {
    const { error: jobUpdateError } = await clients.supabaseAdmin
      .from("jobs")
      .update({
        intake_state: "in_service",
        status: "in_progress",
      })
      .eq("id", estimate.job_id);

    if (jobUpdateError) {
      return NextResponse.json({ error: jobUpdateError.message }, { status: 500 });
    }
  }

  if (estimate.job_id) {
    const { error: updateInsertError } = await clients.supabaseAdmin
      .from("job_customer_updates")
      .insert({
        job_id: estimate.job_id,
        update_type: "customer_approval",
        title: approvedCount > 0 ? "Customer signed quote approval" : "Customer declined quoted work",
        message:
          approvedCount > 0
            ? `Customer signed the quote and authorized ${approvedCount} line item${approvedCount === 1 ? "" : "s"} for $${authorizedTotal.toFixed(2)}.`
            : "Customer reviewed the quote and declined all quoted work.",
        visibility: "internal",
      });

    if (updateInsertError) {
      return NextResponse.json({ error: updateInsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    estimateStatus,
    authorizedTotal,
    approvedCount,
    signedAt,
  });
}
