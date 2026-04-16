import { NextResponse } from "next/server";
import { normalizeVin } from "@/lib/input-formatters";
import { isValidVinFormat, validateVinCheckDigit } from "@/lib/vin";

const NHTSA_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

type NhtsaResultRow = Record<string, string>;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { vin?: string };
    const vin = normalizeVin(String(body.vin || ""));

    if (vin.length !== 17) {
      return NextResponse.json(
        { error: "Enter a complete 17-character VIN." },
        { status: 400 },
      );
    }

    if (!isValidVinFormat(vin)) {
      return NextResponse.json(
        { error: "VIN contains invalid characters. Letters I, O, and Q are not used." },
        { status: 400 },
      );
    }

    const checkDigitOk = validateVinCheckDigit(vin);

    const url = `${NHTSA_DECODE_URL}/${encodeURIComponent(vin)}?format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "VIN lookup service unavailable. Try again later." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      Results?: NhtsaResultRow[];
    };

    const row = payload.Results?.[0];
    if (!row) {
      return NextResponse.json({ error: "No data returned for this VIN." }, { status: 422 });
    }

    const errorCode = String(row.ErrorCode ?? "");
    const errorText = String(row.ErrorText ?? "");

    if (errorCode && errorCode !== "0") {
      return NextResponse.json(
        {
          error:
            errorText.trim() ||
            "This VIN could not be decoded. Check the number and try again.",
          errorCode,
        },
        { status: 422 },
      );
    }

    const modelYear = String(row.ModelYear ?? "").trim();
    const make = String(row.Make ?? "").trim();
    const model = String(row.Model ?? "").trim();

    if (!modelYear || !make || !model) {
      return NextResponse.json(
        {
          error:
            "Decoded VIN is missing year, make, or model. This can happen for some specialty vehicles.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      vin,
      modelYear,
      make,
      model,
      trim: String(row.Trim ?? "").trim() || null,
      bodyClass: String(row.BodyClass ?? "").trim() || null,
      driveType: String(row.DriveType ?? "").trim() || null,
      fuelTypePrimary: String(row.FuelTypePrimary ?? "").trim() || null,
      engineCylinders: String(row.EngineCylinders ?? "").trim() || null,
      displacementL: String(row.DisplacementL ?? "").trim() || null,
      checkDigitValid: checkDigitOk,
      source: "nhtsa_vpic",
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "VIN lookup timed out. Try again." }, { status: 504 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "VIN decode failed." },
      { status: 500 },
    );
  }
}
