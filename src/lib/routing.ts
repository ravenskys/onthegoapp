type TravelTimePayload = {
  serviceAddress?: string;
  serviceCity?: string;
  serviceState?: string;
  serviceZip?: string;
};

type TravelTimeApiResponse = {
  minutes: number | null;
  provider?: string;
  reason?: string;
};

export type DispatchTravelLookup = {
  minutes: number | null;
  provider: string;
  reason: string;
};

export async function getCentralDispatchTravelMinutes(
  payload: TravelTimePayload,
): Promise<DispatchTravelLookup> {
  try {
    const res = await fetch("/api/routing/travel-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { minutes: null, provider: "none", reason: "request_failed" };
    }

    const data = (await res.json()) as TravelTimeApiResponse;
    return {
      minutes: Number.isFinite(data.minutes) ? (data.minutes as number) : null,
      provider: data.provider || "none",
      reason: data.reason || "unknown",
    };
  } catch {
    return { minutes: null, provider: "none", reason: "unexpected_error" };
  }
}
