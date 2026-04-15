"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Save, Plus } from "lucide-react";
import {
  formatPhoneNumber,
  normalizePhoneExtension,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
              disabled={saving}
              className={headerActionButtonClassName}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
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
                onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                placeholder="customer@email.com"
              />
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
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="(555) 555-5555"
                  autoComplete="tel-national"
                />
                <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-32">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Extension</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={phoneExtension}
                    onChange={(e) => setPhoneExtension(normalizePhoneExtension(e.target.value))}
                    placeholder="Ext."
                    maxLength={10}
                    autoComplete="tel-extension"
                  />
                </div>
              </div>
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
