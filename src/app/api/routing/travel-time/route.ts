import { NextResponse } from "next/server";

type TravelTimeRequestBody = {
  serviceAddress?: string;
  serviceCity?: string;
  serviceState?: string;
  serviceZip?: string;
};

const clampMinutes = (value: number, min = 5, max = 180) =>
  Math.max(min, Math.min(max, value));

const normalizeText = (value?: string) => String(value || "").trim();

const buildDestinationQuery = (body: TravelTimeRequestBody) =>
  [
    normalizeText(body.serviceAddress),
    normalizeText(body.serviceCity),
    normalizeText(body.serviceState),
    normalizeText(body.serviceZip),
  ]
    .filter(Boolean)
    .join(", ");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TravelTimeRequestBody;
    const destinationQuery = buildDestinationQuery(body);

    if (!destinationQuery) {
      return NextResponse.json({
        minutes: null,
        provider: "none",
        reason: "destination_missing",
      });
    }

    const provider = (process.env.ROUTING_PROVIDER || "mapbox").toLowerCase();
    if (provider !== "mapbox") {
      return NextResponse.json({
        minutes: null,
        provider,
        reason: "provider_disabled",
      });
    }

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    const originLat = Number(process.env.DISPATCH_ORIGIN_LAT || "");
    const originLng = Number(process.env.DISPATCH_ORIGIN_LNG || "");

    if (!token || !Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      return NextResponse.json({
        minutes: null,
        provider: "mapbox",
        reason: "provider_config_missing",
      });
    }

    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destinationQuery)}.json?limit=1&types=address,postcode,place&access_token=${encodeURIComponent(token)}`;
    const geocodeRes = await fetch(geocodeUrl, { cache: "no-store" });
    if (!geocodeRes.ok) {
      return NextResponse.json({
        minutes: null,
        provider: "mapbox",
        reason: "geocode_failed",
      });
    }

    const geocodeJson = (await geocodeRes.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const destination = geocodeJson.features?.[0]?.center;
    if (!destination || destination.length < 2) {
      return NextResponse.json({
        minutes: null,
        provider: "mapbox",
        reason: "destination_not_found",
      });
    }

    const [destLng, destLat] = destination;
    const directionsUrl =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}` +
      `?alternatives=false&geometries=polyline&overview=false&access_token=${encodeURIComponent(token)}`;

    const directionsRes = await fetch(directionsUrl, { cache: "no-store" });
    if (!directionsRes.ok) {
      return NextResponse.json({
        minutes: null,
        provider: "mapbox",
        reason: "directions_failed",
      });
    }

    const directionsJson = (await directionsRes.json()) as {
      routes?: Array<{ duration?: number }>;
    };
    const durationSec = directionsJson.routes?.[0]?.duration;
    if (!Number.isFinite(durationSec)) {
      return NextResponse.json({
        minutes: null,
        provider: "mapbox",
        reason: "duration_missing",
      });
    }

    const minutes = clampMinutes(Math.round((durationSec as number) / 60));

    return NextResponse.json({
      minutes,
      provider: "mapbox",
      reason: "ok",
    });
  } catch {
    return NextResponse.json({
      minutes: null,
      provider: "none",
      reason: "unexpected_error",
    });
  }
}
