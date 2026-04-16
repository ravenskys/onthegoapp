"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import {
  formatPhoneNumber,
  normalizePhoneExtension,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
import {
  getEmailInputWarning,
  getPhoneExtensionInputWarning,
  getPhoneInputWarning,
} from "@/lib/input-validation-feedback";
import { VehicleCatalogFields } from "@/components/vehicle/VehicleCatalogFields";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_extension: string | null;
  tax_exempt: boolean;
};

type Vehicle = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  engine_size?: string | null;
  license_plate: string | null;
  vin: string | null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const getSupabaseRpcErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return getErrorMessage(error);
  }

  const supabaseError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  const message =
    typeof supabaseError.message === "string" ? supabaseError.message.trim() : "";
  const details =
    typeof supabaseError.details === "string" ? supabaseError.details.trim() : "";
  const hint = typeof supabaseError.hint === "string" ? supabaseError.hint.trim() : "";
  const code = typeof supabaseError.code === "string" ? supabaseError.code.trim() : "";

  const segments = [message, details, hint ? `Hint: ${hint}` : "", code ? `Code: ${code}` : ""].filter(
    Boolean,
  );
  if (segments.length) {
    return segments.join(" | ");
  }

  const keys = Object.getOwnPropertyNames(error);
  if (keys.length) {
    return `Unknown RPC error with fields: ${keys.join(", ")}`;
  }

  return "Unknown RPC error. Ensure the latest customer deletion migrations are applied.";
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [newVehicleYear, setNewVehicleYear] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleEngineSize, setNewVehicleEngineSize] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleVin, setNewVehicleVin] = useState("");
  const [useCustomMake, setUseCustomMake] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [useCustomEngineSize, setUseCustomEngineSize] = useState(false);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [emailFormatHint, setEmailFormatHint] = useState<string | null>(null);
  const [phoneFormatHint, setPhoneFormatHint] = useState<string | null>(null);
  const [phoneExtensionFormatHint, setPhoneExtensionFormatHint] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    const checkAccessAndLoad = async () => {
      const { user, roles } = await getUserRoles();

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roles, "manager")) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      setAuthorized(true);
      await fetchCustomer();
    };

    void checkAccessAndLoad();
  }, [customerId]);

  const fetchCustomer = async () => {
  setLoading(true);

  try {
    console.log("Loading customer page for customerId:", customerId);

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, phone_extension, tax_exempt")
      .eq("id", customerId)
      .single();

    if (customerError) {
      console.error("Customer query failed", customerError);
      throw customerError;
    }

    setCustomer(customerData);
    setFirstName(customerData.first_name ?? "");
    setLastName(customerData.last_name ?? "");
    setEmail(customerData.email ?? "");
    setPhone(customerData.phone ?? "");
    setPhoneExtension(customerData.phone_extension ?? "");
    setTaxExempt(customerData.tax_exempt ?? false);

    const { data: vehicleData, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, year, make, model, engine_size, license_plate, vin")
      .eq("customer_id", customerId)
      .order("year", { ascending: false });

    if (vehicleError) {
      console.error("Vehicle query failed", vehicleError);
      throw vehicleError;
    }

    setVehicles(vehicleData ?? []);
  } catch (error: unknown) {
    console.error("Error loading customer:", {
      message: getErrorMessage(error),
      full: error,
      customerId,
    });
    alert(`Failed to load customer: ${getErrorMessage(error)}`);
  } finally {
    setLoading(false);
  }
};

  const handleSaveCustomer = async () => {
    setSaving(true);

    try {
      const normalizedCustomerEmail = normalizeEmail(email);

      if (!normalizedCustomerEmail) {
        alert("Email is required because it is the main way customer records are matched and linked.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: normalizedCustomerEmail,
          phone: formatPhoneNumber(phone).trim() || null,
          phone_extension: normalizePhoneExtension(phoneExtension) || null,
          tax_exempt: taxExempt,
        })
        .eq("id", customerId);

      if (error) throw error;

      alert("Customer updated.");
      fetchCustomer();
    } catch (error: unknown) {
      console.error("Error saving customer:", error);
      alert("Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;

    const customerName =
      `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "this customer";
    const deleteReasonInput = window.prompt(
      "Reason for deleting this customer (optional, saved to audit log):",
      "",
    );
    if (deleteReasonInput === null) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${customerName}? This removes the customer record and logs who deleted it and when.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await supabase.rpc("delete_customer_with_audit", {
        p_customer_id: customerId,
        p_reason: deleteReasonInput.trim() || null,
      });

      if (error) {
        throw new Error(getSupabaseRpcErrorMessage(error));
      }

      alert("Customer deleted. The action has been logged.");
      router.push("/manager/customers");
    } catch (error: unknown) {
      const ownKeys = error && typeof error === "object" ? Object.getOwnPropertyNames(error) : [];
      console.error("Error deleting customer:", {
        error,
        ownKeys,
        message: getErrorMessage(error),
      });
      alert(`Failed to delete customer: ${getErrorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-600">Customer not found.</div>;
  }

  const handleAddVehicle = async () => {
  if (!customerId) return;

  if (!newVehicleMake.trim() && !newVehicleModel.trim() && !newVehicleVin.trim()) {
    alert("Please enter at least basic vehicle information.");
    return;
  }

  setSaving(true);

  try {
    const { error } = await supabase.from("vehicles").insert({
      customer_id: customerId,
      year: newVehicleYear ? Number(newVehicleYear) : null,
      make: newVehicleMake.trim() || null,
      model: newVehicleModel.trim() || null,
      engine_size: newVehicleEngineSize.trim() || null,
      license_plate: normalizeLicensePlate(newVehiclePlate) || null,
      vin: normalizeVin(newVehicleVin) || null,
    });

    if (error) throw error;

    setNewVehicleYear("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setNewVehicleEngineSize("");
    setNewVehiclePlate("");
    setNewVehicleVin("");
    setUseCustomMake(false);
    setUseCustomModel(false);
    setUseCustomEngineSize(false);

    fetchCustomer();
  } catch (error: unknown) {
    console.error("Error adding vehicle:", error);
    alert(`Failed to add vehicle: ${getErrorMessage(error)}`);
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Customer Details
              </h1>
              <p className="text-slate-600">
                {firstName} {lastName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button
              onClick={handleSaveCustomer}
              disabled={saving || deleting}
              className={headerActionButtonClassName}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCustomer}
              disabled={saving || deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Customer
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  const raw = e.target.value;
                  setEmailFormatHint(getEmailInputWarning(raw));
                  setEmail(normalizeEmail(raw));
                }}
                placeholder="customer@email.com"
              />
              {emailFormatHint ? (
                <p className="text-xs text-amber-800">{emailFormatHint}</p>
              ) : null}
              <p className="text-xs text-slate-500">
                Required. We use email to match customer records, portal access, and service history.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Phone</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  type="tel"
                  className="min-w-0 flex-1"
                  value={phone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setPhoneFormatHint(getPhoneInputWarning(raw));
                    setPhone(formatPhoneNumber(raw));
                  }}
                  placeholder="(555) 555-5555"
                  autoComplete="tel-national"
                />
                <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-32">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Extension</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={phoneExtension}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPhoneExtensionFormatHint(getPhoneExtensionInputWarning(raw));
                      setPhoneExtension(normalizePhoneExtension(raw));
                    }}
                    placeholder="Ext."
                    maxLength={10}
                    autoComplete="tel-extension"
                  />
                </div>
              </div>
              {phoneFormatHint ? (
                <p className="text-xs text-amber-800">{phoneFormatHint}</p>
              ) : null}
              {phoneExtensionFormatHint ? (
                <p className="text-xs text-amber-800">{phoneExtensionFormatHint}</p>
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tax Status</Label>
              <label className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={taxExempt}
                  onChange={(e) => setTaxExempt(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Customer is tax exempt</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <VehicleCatalogFields
                  year={newVehicleYear}
                  make={newVehicleMake}
                  model={newVehicleModel}
                  engineSize={newVehicleEngineSize}
                  licensePlate={newVehiclePlate}
                  vin={newVehicleVin}
                  useCustomMake={useCustomMake}
                  useCustomModel={useCustomModel}
                  useCustomEngineSize={useCustomEngineSize}
                  normalizeYear={normalizeYear}
                  normalizeVin={normalizeVin}
                  normalizeLicensePlate={normalizeLicensePlate}
                  setYear={setNewVehicleYear}
                  setMake={setNewVehicleMake}
                  setModel={setNewVehicleModel}
                  setEngineSize={setNewVehicleEngineSize}
                  setLicensePlate={setNewVehiclePlate}
                  setVin={setNewVehicleVin}
                  setUseCustomMake={setUseCustomMake}
                  setUseCustomModel={setUseCustomModel}
                  setUseCustomEngineSize={setUseCustomEngineSize}
                  makeListId="manager-vehicle-makes"
                  modelListId="manager-vehicle-models"
                  engineListId="manager-vehicle-engine-sizes"
                />

                <div>
                    <Button onClick={handleAddVehicle} disabled={saving}>
                    {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Vehicle
                    </Button>
                </div>

                {vehicles.length === 0 ? (
                    <p className="text-sm text-slate-500">No vehicles found for this customer.</p>
                ) : (
                    <div className="space-y-3">
                    {vehicles.map((vehicle) => {
                        const vehicleName =
                        [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unnamed vehicle";

                        return (
                        <div
                            key={vehicle.id}
                            className="rounded-lg border bg-slate-50 p-4"
                        >
                            <div className="font-medium text-slate-900">{vehicleName}</div>

                            <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                            <div>Engine: {vehicle.engine_size || "—"}</div>
                            <div>Plate: {vehicle.license_plate || "—"}</div>
                            <div>VIN: {vehicle.vin || "—"}</div>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
