"use client";

import { useEffect, useState } from "react";
import { CarFront, MapPin, Plus, Save, Trash2, UserRound } from "lucide-react";
import { CustomerContactFields } from "@/components/customer/CustomerContactFields";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { getErrorMessage } from "@/lib/tech-inspection";
import {
  formatMileage,
  formatPhoneNumber,
  normalizePhoneExtension,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
import {
  CustomerPortalAddress,
  CustomerPortalRecord,
  CustomerPortalVehicle,
  fetchCustomerPortalData,
} from "@/lib/customer-portal";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { getVehicleCatalogModes } from "@/lib/tech-inspection";
import { supabase } from "@/lib/supabase";
import { VehicleCatalogFields } from "@/components/vehicle/VehicleCatalogFields";
import { UsStateSelect } from "@/components/forms/UsStateSelect";
import {
  DEFAULT_US_STATE_CODE,
  normalizeUsStateCode,
  resolveUsStateForForm,
} from "@/lib/us-states";

type EditableVehicleDraft = {
  id?: string;
  year: string;
  make: string;
  model: string;
  engineSize: string;
  mileage: string;
  savedMileage: string;
  vin: string;
  licensePlate: string;
  useCustomMake: boolean;
  useCustomModel: boolean;
  useCustomEngineSize: boolean;
};

type EditableAddressDraft = {
  id?: string;
  isDefault: boolean;
  locationType: string;
  otherLocationType: string;
  contactName: string;
  contactPhone: string;
  contactPhoneExtension: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  gateCode: string;
  parkingNotes: string;
  serviceNotes: string;
};

const createEmptyVehicleDraft = (): EditableVehicleDraft => ({
  year: "",
  make: "",
  model: "",
  engineSize: "",
  mileage: "",
  savedMileage: "",
  vin: "",
  licensePlate: "",
  useCustomMake: false,
  useCustomModel: false,
  useCustomEngineSize: false,
});

const createEmptyAddressDraft = (): EditableAddressDraft => ({
  isDefault: false,
  locationType: "house",
  otherLocationType: "",
  contactName: "",
  contactPhone: "",
  contactPhoneExtension: "",
  address: "",
  city: "",
  state: DEFAULT_US_STATE_CODE,
  zip: "",
  gateCode: "",
  parkingNotes: "",
  serviceNotes: "",
});

const ADDRESS_LOCATION_OPTIONS = [
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "office-building", label: "Office Building" },
  { value: "other", label: "Other" },
];

const getAddressLocationOptionLabel = (value: string) =>
  ADDRESS_LOCATION_OPTIONS.find((option) => option.value === value)?.label || "Other";

const parseAddressLocationDraft = (label: string | null | undefined) => {
  const trimmedLabel = String(label || "").trim();
  const matchingOption = ADDRESS_LOCATION_OPTIONS.find(
    (option) => option.value !== "other" && option.label.toLowerCase() === trimmedLabel.toLowerCase()
  );

  if (matchingOption) {
    return {
      locationType: matchingOption.value,
      otherLocationType: "",
    };
  }

  return {
    locationType: trimmedLabel ? "other" : "house",
    otherLocationType: trimmedLabel,
  };
};

const buildAddressLocationLabel = (draft: EditableAddressDraft) =>
  draft.locationType === "other"
    ? draft.otherLocationType.trim()
    : getAddressLocationOptionLabel(draft.locationType);

const formatStoredMileageValue = (value: unknown) => {
  const digitsOnly = String(value ?? "").replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly).toLocaleString("en-US") : "";
};

const mapVehicleToDraft = (vehicle: CustomerPortalVehicle): EditableVehicleDraft => {
  const year = vehicle.year ? String(vehicle.year) : "";
  const make = vehicle.make || "";
  const model = vehicle.model || "";
  const engineSize = vehicle.engine_size || "";
  const catalogModes = getVehicleCatalogModes({ year, make, model, engineSize });

  return {
    id: vehicle.id,
    year,
    make,
    model,
    engineSize,
    mileage: formatStoredMileageValue(vehicle.mileage),
    savedMileage: formatStoredMileageValue(vehicle.mileage),
    vin: vehicle.vin || "",
    licensePlate: vehicle.license_plate || "",
    ...catalogModes,
  };
};

const mapAddressToDraft = (address: CustomerPortalAddress): EditableAddressDraft => ({
  id: address.id,
  ...parseAddressLocationDraft(address.label),
  isDefault: Boolean(address.is_default),
  contactName: address.contact_name || "",
  contactPhone: address.contact_phone || "",
  contactPhoneExtension: address.contact_phone_extension || "",
  address: address.address || "",
  city: address.city || "",
  state: resolveUsStateForForm(address.state),
  zip: address.zip || "",
  gateCode: address.gate_code || "",
  parkingNotes: address.parking_notes || "",
  serviceNotes: address.service_notes || "",
});

const hasVehicleContent = (vehicle: EditableVehicleDraft) =>
  Boolean(
    vehicle.year ||
      vehicle.make.trim() ||
      vehicle.model.trim() ||
      vehicle.engineSize.trim() ||
      vehicle.mileage ||
      vehicle.vin.trim() ||
      vehicle.licensePlate.trim()
  );

const parseOptionalNumber = (value: string) => {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly) : null;
};

const formatMileageLabel = (value: string) => {
  const numericValue = parseOptionalNumber(value);
  return typeof numericValue === "number"
    ? `${numericValue.toLocaleString("en-US")} miles`
    : "Mileage not added";
};

const getVehicleIdentifierLabel = (draft: EditableVehicleDraft) => {
  const idSuffix = draft.id ? draft.id.slice(-6).toUpperCase() : "NEW";

  if (draft.licensePlate.trim()) {
    return `Plate ${draft.licensePlate.trim()} • Record ${idSuffix}`;
  }

  if (draft.vin.trim()) {
    const vin = draft.vin.trim();
    return `VIN ${vin.slice(-6).toUpperCase()} • Record ${idSuffix}`;
  }

  return `Record ${idSuffix}`;
};

const getVehicleDuplicateKey = (draft: EditableVehicleDraft) =>
  [draft.year.trim(), draft.make.trim().toLowerCase(), draft.model.trim().toLowerCase()]
    .filter(Boolean)
    .join("|");

const getVehicleCollisionKey = (draft: EditableVehicleDraft) => {
  const normalizedPlate = normalizeLicensePlate(draft.licensePlate);
  if (normalizedPlate) {
    return `plate:${normalizedPlate}`;
  }

  const normalizedVin = normalizeVin(draft.vin);
  if (normalizedVin) {
    return `vin:${normalizedVin}`;
  }

  return "";
};

export default function CustomerAccountPage() {
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState("");
  const [customer, setCustomer] = useState<CustomerPortalRecord | null>(null);
  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountPhoneExtension, setAccountPhoneExtension] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [vehicleDrafts, setVehicleDrafts] = useState<EditableVehicleDraft[]>([]);
  const [addressDrafts, setAddressDrafts] = useState<EditableAddressDraft[]>([]);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingVehicleIndex, setSavingVehicleIndex] = useState<number | null>(null);
  const [savingAddressIndex, setSavingAddressIndex] = useState<number | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState("");
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [addressMessage, setAddressMessage] = useState("");
  const vehicleDuplicateCounts = vehicleDrafts.reduce<Record<string, number>>(
    (counts, draft) => {
      const key = getVehicleDuplicateKey(draft);
      if (!key) return counts;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    },
    {}
  );
  const vehicleCollisionCounts = vehicleDrafts.reduce<Record<string, number>>(
    (counts, draft) => {
      const key = getVehicleCollisionKey(draft);
      if (!key) return counts;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    },
    {}
  );

  const refreshPortalData = async (nextAuthUserId: string) => {
    const data = await fetchCustomerPortalData(nextAuthUserId);

    setCustomer(data.customer);
    setAccountFirstName(data.customer?.first_name || "");
    setAccountLastName(data.customer?.last_name || "");
    setAccountPhone(data.customer?.phone || "");
    setAccountPhoneExtension(data.customer?.phone_extension || "");
    setAccountEmail(data.customer?.email || "");
    setVehicleDrafts(
      data.vehicles.length
        ? data.vehicles.map(mapVehicleToDraft)
        : [createEmptyVehicleDraft()]
    );
    setAddressDrafts(
      data.addresses.length
        ? data.addresses.map(mapAddressToDraft)
        : [createEmptyAddressDraft()]
    );
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        const { user, roles } = await getUserRoles();

        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (!hasPortalAccess(roles, "customer")) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }

        setAuthUserId(user.id);
        await refreshPortalData(user.id);
      } catch (error) {
        console.error("Customer account load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, []);

  useEffect(() => {
    if (loading) return;

    const scrollToVehiclesSection = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#customer-account-vehicles") return;
      const el = document.getElementById("customer-account-vehicles");
      if (!el) return;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    scrollToVehiclesSection();
    window.addEventListener("hashchange", scrollToVehiclesSection);
    return () => window.removeEventListener("hashchange", scrollToVehiclesSection);
  }, [loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleVehicleDraftChange = (
    index: number,
    field: keyof EditableVehicleDraft,
    value: string
  ) => {
    setVehicleDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft
      )
    );
  };

  const handleAddressDraftChange = (
    index: number,
    field: keyof EditableAddressDraft,
    value: string | boolean
  ) => {
    setAddressDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft
      )
    );
  };

  const handleSaveAccountInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer?.id) return;

    setSavingAccount(true);
    setAccountMessage("");

    try {
      const trimmedFirstName = accountFirstName.trim();
      const trimmedLastName = accountLastName.trim();
      const trimmedPhone = formatPhoneNumber(accountPhone).trim();
      const trimmedExtension = normalizePhoneExtension(accountPhoneExtension);
      const normalizedCustomerEmail = normalizeEmail(accountEmail);

      if (!normalizedCustomerEmail) {
        setAccountMessage(
          "Email is required because it links your customer profile and portal history."
        );
        setSavingAccount(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("You must be logged in to update your account.");
      }

      const authEmail = normalizeEmail(user.email || "");
      if (!authEmail) {
        throw new Error("Your login email could not be confirmed.");
      }

      const canUpdateCustomerEmail = normalizedCustomerEmail === authEmail;
      const customerUpdate = {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        phone: trimmedPhone,
        phone_extension: trimmedExtension || null,
        email: canUpdateCustomerEmail ? normalizedCustomerEmail : authEmail,
      };

      const { error } = await supabase
        .from("customers")
        .update(customerUpdate)
        .eq("id", customer.id);

      if (error) throw error;

      const savedEmail = canUpdateCustomerEmail
        ? normalizedCustomerEmail
        : authEmail;

      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              first_name: trimmedFirstName,
              last_name: trimmedLastName,
              phone: trimmedPhone,
              phone_extension: trimmedExtension || null,
              email: savedEmail,
            }
          : prev
      );
      setAccountEmail(savedEmail);

      setAccountMessage(
        canUpdateCustomerEmail
          ? "Account information updated."
          : "Contact information updated. Email was not changed because portal email changes must be handled through the login email first."
      );
    } catch (error) {
      setAccountMessage(getErrorMessage(error, "Failed to update account information."));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveVehicle = async (index: number) => {
    if (!customer?.id || !authUserId) return;

    const draft = vehicleDrafts[index];
    if (!draft || !hasVehicleContent(draft)) {
      setVehicleMessage("Add at least some vehicle details before saving.");
      return;
    }

    setSavingVehicleIndex(index);
    setVehicleMessage("");

    try {
      const payload = {
        customer_id: customer.id,
        year: parseOptionalNumber(draft.year),
        make: draft.make.trim() || null,
        model: draft.model.trim() || null,
        engine_size: draft.engineSize.trim() || null,
        mileage: parseOptionalNumber(draft.mileage),
        vin: normalizeVin(draft.vin) || null,
        license_plate: normalizeLicensePlate(draft.licensePlate) || null,
      };

      if (draft.id) {
        const { data: updatedVehicle, error } = await supabase
          .from("vehicles")
          .update(payload)
          .eq("id", draft.id)
          .select("id, mileage")
          .maybeSingle();

        if (error) throw error;
        if (!updatedVehicle) {
          throw new Error(
            "Vehicle update was blocked. Apply the customer vehicle write policy migration in Supabase and try again."
          );
        }
      } else {
        const { data: insertedVehicle, error } = await supabase
          .from("vehicles")
          .insert(payload)
          .select("id, mileage")
          .maybeSingle();

        if (error) throw error;
        if (!insertedVehicle) {
          throw new Error(
            "Vehicle create was blocked. Apply the customer vehicle write policy migration in Supabase and try again."
          );
        }
      }

      setVehicleDrafts((currentDrafts) =>
        currentDrafts.map((currentDraft, draftIndex) =>
          draftIndex === index
            ? {
                ...currentDraft,
                year: draft.year,
                make: draft.make.trim(),
                model: draft.model.trim(),
                engineSize: draft.engineSize.trim(),
                mileage: draft.mileage,
                savedMileage: draft.mileage,
                vin: normalizeVin(draft.vin),
                licensePlate: normalizeLicensePlate(draft.licensePlate),
              }
            : currentDraft
        )
      );
      await refreshPortalData(authUserId);
      setEditingVehicleId(null);
      setVehicleMessage("Vehicle information saved.");
    } catch (error) {
      setVehicleMessage(
        getErrorMessage(error, "Failed to save vehicle information.")
      );
    } finally {
      setSavingVehicleIndex(null);
    }
  };

  const handleDeleteVehicle = async (index: number) => {
    const draft = vehicleDrafts[index];
    if (!draft) return;

    setVehicleMessage("");

    if (!draft.id) {
      setVehicleDrafts((currentDrafts) =>
        currentDrafts.filter((_, draftIndex) => draftIndex !== index)
      );
      return;
    }

    setSavingVehicleIndex(index);

    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", draft.id);

      if (error) throw error;

      setVehicleDrafts((currentDrafts) =>
        currentDrafts.filter((_, draftIndex) => draftIndex !== index)
      );
      if (editingVehicleId === draft.id) {
        setEditingVehicleId(null);
      }
      setVehicleMessage("Vehicle deleted.");
    } catch (error) {
      setVehicleMessage(getErrorMessage(error, "Failed to delete vehicle."));
    } finally {
      setSavingVehicleIndex(null);
    }
  };

  const handleSaveAddress = async (index: number) => {
    if (!customer?.id || !authUserId) return;

    const draft = addressDrafts[index];
    if (!draft?.address.trim()) {
      setAddressMessage("Street address is required before saving an address.");
      return;
    }
    if (draft.locationType === "other" && !draft.otherLocationType.trim()) {
      setAddressMessage("Describe the location type when you choose Other.");
      return;
    }

    setSavingAddressIndex(index);
    setAddressMessage("");

    try {
      const payload = {
        customer_id: customer.id,
        address_type: "service",
        is_default: draft.isDefault,
        label: buildAddressLocationLabel(draft) || null,
        contact_name: draft.contactName.trim() || null,
        contact_phone: formatPhoneNumber(draft.contactPhone).trim() || null,
        contact_phone_extension: normalizePhoneExtension(draft.contactPhoneExtension) || null,
        address: draft.address.trim(),
        city: draft.city.trim() || null,
        state: normalizeUsStateCode(draft.state) || DEFAULT_US_STATE_CODE,
        zip: draft.zip.trim() || null,
        gate_code: draft.gateCode.trim() || null,
        parking_notes: draft.parkingNotes.trim() || null,
        service_notes: draft.serviceNotes.trim() || null,
      };

      if (payload.is_default) {
        const existingAddressIds = addressDrafts
          .map((address) => address.id)
          .filter((value): value is string => Boolean(value));

        if (existingAddressIds.length > 0) {
          const { error: clearDefaultError } = await supabase
            .from("customer_addresses")
            .update({ is_default: false })
            .in("id", existingAddressIds);

          if (clearDefaultError) throw clearDefaultError;
        }
      }

      if (draft.id) {
        const { error } = await supabase
          .from("customer_addresses")
          .update(payload)
          .eq("id", draft.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_addresses")
          .insert(payload);

        if (error) throw error;
      }

      await refreshPortalData(authUserId);
      setEditingAddressId(null);
      setAddressMessage("Service address saved.");
    } catch (error) {
      setAddressMessage(getErrorMessage(error, "Failed to save service address."));
    } finally {
      setSavingAddressIndex(null);
    }
  };

  const handleDeleteAddress = async (index: number) => {
    const draft = addressDrafts[index];
    if (!draft) return;

    setAddressMessage("");

    if (!draft.id) {
      setAddressDrafts((currentDrafts) =>
        currentDrafts.filter((_, draftIndex) => draftIndex !== index)
      );
      return;
    }

    setSavingAddressIndex(index);

    try {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", draft.id);

      if (error) throw error;

      setAddressDrafts((currentDrafts) =>
        currentDrafts.filter((_, draftIndex) => draftIndex !== index)
      );
      if (editingAddressId === draft.id) {
        setEditingAddressId(null);
      }
      setAddressMessage("Service address deleted.");
    } catch (error) {
      setAddressMessage(getErrorMessage(error, "Failed to delete service address."));
    } finally {
      setSavingAddressIndex(null);
    }
  };

  if (loading) {
    return <div className="otg-page"><div className="otg-container"><div className="otg-card p-8"><p className="otg-body">Loading account...</p></div></div></div>;
  }

  return (
    <CustomerPortalShell
      title="Account"
      subtitle="Use this page to update the account information connected to your customer record, vehicles, saved service addresses, and portal history."
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <div className="otg-card p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Account Information</h2>
              <p className="mt-1 text-sm text-slate-600">
                Keep your full customer profile current so reports, updates, and portal access stay tied to the right account.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Profile Details
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Email is required because it is the main way portal access and service history stay linked to the correct account.
            </p>
          </div>

          <form onSubmit={handleSaveAccountInfo} className="mt-6 space-y-4">
            <CustomerContactFields
              firstName={accountFirstName}
              lastName={accountLastName}
              phone={accountPhone}
              phoneExtension={accountPhoneExtension}
              email={accountEmail}
              setFirstName={setAccountFirstName}
              setLastName={setAccountLastName}
              setPhone={(value) => setAccountPhone(formatPhoneNumber(value))}
              setPhoneExtension={(value) => setAccountPhoneExtension(normalizePhoneExtension(value))}
              setEmail={(value) => setAccountEmail(normalizeEmail(value))}
            />

            <button
              type="submit"
              disabled={savingAccount}
              className="otg-btn otg-btn-primary disabled:opacity-50 sm:w-auto"
            >
              {savingAccount ? "Saving..." : "Save Account Information"}
            </button>
          </form>

          {accountMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {accountMessage}
            </div>
          ) : null}
        </div>

        <div id="customer-account-vehicles" className="otg-card scroll-mt-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
                <CarFront className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Vehicles</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Keep the vehicles on your account current so scheduling and service history stay accurate.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setVehicleDrafts((currentDrafts) => [
                  ...currentDrafts,
                  createEmptyVehicleDraft(),
                ]);
                setEditingVehicleId(null);
              }}
              className="otg-btn otg-btn-secondary sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {vehicleDrafts.map((draft, index) => (
              <div
                key={draft.id || `new-vehicle-${index}`}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                {(() => {
                  const duplicateKey = getVehicleDuplicateKey(draft);
                  const collisionKey = getVehicleCollisionKey(draft);
                  const hasMatchingIdentity =
                    Boolean(collisionKey) &&
                    (vehicleCollisionCounts[collisionKey] || 0) > 1;
                  const hasSimilarVehicleRows =
                    Boolean(duplicateKey) &&
                    (vehicleDuplicateCounts[duplicateKey] || 0) > 1;
                  const isEditingVehicle = !draft.id || editingVehicleId === draft.id;

                  return isEditingVehicle ? (
                    <>
                      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {draft.id ? "Edit Vehicle" : "New Vehicle"}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {[draft.year, draft.make, draft.model].filter(Boolean).join(" ") || "Vehicle details"}
                          </div>
                          <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                            {getVehicleIdentifierLabel(draft)}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Last recorded mileage: {formatMileageLabel(draft.savedMileage)}
                          </div>
                          {hasMatchingIdentity ? (
                            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900">
                              Possible duplicate record detected. Another vehicle on this account has the same plate or VIN.
                            </div>
                          ) : hasSimilarVehicleRows ? (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                              Multiple vehicles on this account share the same year, make, and model. That can be normal for fleet accounts, so use the plate, VIN, or record id above to confirm you are editing the right one.
                            </div>
                          ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                          {draft.id ? (
                            <button
                              type="button"
                              onClick={() => setEditingVehicleId(null)}
                              className="otg-btn otg-btn-secondary w-full sm:w-auto"
                            >
                              Cancel
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleSaveVehicle(index)}
                            disabled={savingVehicleIndex === index}
                            className="otg-btn otg-btn-primary w-full disabled:opacity-50 sm:w-auto"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {savingVehicleIndex === index ? "Saving..." : "Save Vehicle"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteVehicle(index)}
                            disabled={savingVehicleIndex === index}
                            className="otg-btn w-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <VehicleCatalogFields
                        year={draft.year}
                        make={draft.make}
                        model={draft.model}
                        engineSize={draft.engineSize}
                        licensePlate={draft.licensePlate}
                        vin={draft.vin}
                        useCustomMake={draft.useCustomMake}
                        useCustomModel={draft.useCustomModel}
                        useCustomEngineSize={draft.useCustomEngineSize}
                        normalizeYear={normalizeYear}
                        normalizeVin={normalizeVin}
                        normalizeLicensePlate={normalizeLicensePlate}
                        setYear={(value) => handleVehicleDraftChange(index, "year", value)}
                        setMake={(value) => handleVehicleDraftChange(index, "make", value)}
                        setModel={(value) => handleVehicleDraftChange(index, "model", value)}
                        setEngineSize={(value) => handleVehicleDraftChange(index, "engineSize", value)}
                        setLicensePlate={(value) =>
                          handleVehicleDraftChange(index, "licensePlate", value)
                        }
                        setVin={(value) => handleVehicleDraftChange(index, "vin", value)}
                        setUseCustomMake={(updater) => {
                          setVehicleDrafts((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, useCustomMake: updater(row.useCustomMake) }
                                : row
                            )
                          );
                        }}
                        setUseCustomModel={(updater) => {
                          setVehicleDrafts((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, useCustomModel: updater(row.useCustomModel) }
                                : row
                            )
                          );
                        }}
                        setUseCustomEngineSize={(updater) => {
                          setVehicleDrafts((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, useCustomEngineSize: updater(row.useCustomEngineSize) }
                                : row
                            )
                          );
                        }}
                        makeListId={`customer-account-make-${index}`}
                        modelListId={`customer-account-model-${index}`}
                        engineListId={`customer-account-engine-${draft.id || `new-${index}`}`}
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                      />

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="otg-label">Mileage</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draft.mileage}
                            onChange={(event) =>
                              handleVehicleDraftChange(
                                index,
                                "mileage",
                                formatMileage(event.target.value)
                              )
                            }
                            className="otg-input"
                            placeholder="75,000"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Saved Vehicle
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {[draft.year, draft.make, draft.model].filter(Boolean).join(" ") || "Vehicle details"}
                          </div>
                          <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                            {getVehicleIdentifierLabel(draft)}
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            Mileage: {formatMileageLabel(draft.savedMileage)}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Engine: {draft.engineSize.trim() || "Not added"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Plate: {draft.licensePlate.trim() || "Not added"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            VIN: {draft.vin.trim() || "Not added"}
                          </div>
                          {hasMatchingIdentity ? (
                            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900">
                              Possible duplicate record detected. Another vehicle on this account has the same plate or VIN.
                            </div>
                          ) : hasSimilarVehicleRows ? (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                              Multiple vehicles on this account share the same year, make, and model. That can be normal for fleet accounts, so use the plate, VIN, or record id above to confirm you are editing the right one.
                            </div>
                          ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingVehicleId(draft.id || null)}
                            className="otg-btn otg-btn-secondary w-full sm:w-auto"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteVehicle(index)}
                            disabled={savingVehicleIndex === index}
                            className="otg-btn w-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {vehicleMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {vehicleMessage}
            </div>
          ) : null}
        </div>

        <div className="otg-card p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Service Addresses</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Save service locations here so customer scheduling can reuse them.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAddressDrafts((currentDrafts) => [
                  ...currentDrafts,
                  createEmptyAddressDraft(),
                ]);
                setEditingAddressId(null);
              }}
              className="otg-btn otg-btn-secondary sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {addressDrafts.map((draft, index) => (
              <div
                key={draft.id || `new-address-${index}`}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                {draft.id && editingAddressId !== draft.id ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Saved Address
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {buildAddressLocationLabel(draft) || "Service address"}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {[draft.address, draft.city, draft.state, draft.zip].filter(Boolean).join(", ") || "Address details not added"}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          Contact: {draft.contactName || "Not added"}{" "}
                          {draft.contactPhone
                            ? `• ${draft.contactPhone}${
                                draft.contactPhoneExtension
                                  ? ` ext. ${draft.contactPhoneExtension}`
                                  : ""
                              }`
                            : ""}
                        </div>
                        {draft.gateCode ? (
                          <div className="mt-1 text-sm text-slate-600">Gate code: {draft.gateCode}</div>
                        ) : null}
                        {draft.parkingNotes ? (
                          <div className="mt-1 text-sm text-slate-600">Parking: {draft.parkingNotes}</div>
                        ) : null}
                        {draft.serviceNotes ? (
                          <div className="mt-1 text-sm text-slate-600">Service notes: {draft.serviceNotes}</div>
                        ) : null}
                        {draft.isDefault ? (
                          <div className="mt-2 inline-flex rounded-full border border-lime-300 bg-lime-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-lime-950">
                            Default service address
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingAddressId(draft.id || null)}
                          className="otg-btn otg-btn-secondary sm:w-auto"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAddress(index)}
                          disabled={savingAddressIndex === index}
                          className="otg-btn bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {draft.id ? "Edit Address" : "New Address"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {buildAddressLocationLabel(draft) || draft.address || "Service address"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {draft.id ? (
                          <button
                            type="button"
                            onClick={() => setEditingAddressId(null)}
                            className="otg-btn otg-btn-secondary sm:w-auto"
                          >
                            Cancel
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleSaveAddress(index)}
                          disabled={savingAddressIndex === index}
                          className="otg-btn otg-btn-primary disabled:opacity-50 sm:w-auto"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {savingAddressIndex === index ? "Saving..." : "Save Address"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAddress(index)}
                          disabled={savingAddressIndex === index}
                          className="otg-btn bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 sm:w-auto"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="otg-label">Location Type</label>
                        <select
                          value={draft.locationType}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "locationType", event.target.value)
                          }
                          className="otg-input"
                        >
                          {ADDRESS_LOCATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {draft.locationType === "other" ? (
                        <div className="space-y-2">
                          <label className="otg-label">Describe Location</label>
                          <input
                            type="text"
                            value={draft.otherLocationType}
                            onChange={(event) =>
                              handleAddressDraftChange(index, "otherLocationType", event.target.value)
                            }
                            className="otg-input"
                            placeholder="Describe this location"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="otg-label">Contact Name</label>
                          <input
                            type="text"
                            value={draft.contactName}
                            onChange={(event) =>
                              handleAddressDraftChange(index, "contactName", event.target.value)
                            }
                            className="otg-input"
                            placeholder="Contact person"
                          />
                        </div>
                      )}

                      {draft.locationType === "other" ? (
                        <div className="space-y-2">
                          <label className="otg-label">Contact Name</label>
                          <input
                            type="text"
                            value={draft.contactName}
                            onChange={(event) =>
                              handleAddressDraftChange(index, "contactName", event.target.value)
                            }
                            className="otg-input"
                            placeholder="Contact person"
                          />
                        </div>
                      ) : null}

                      <div className="space-y-2 md:col-span-2">
                        <label className="otg-label">Contact phone at this location</label>
                        <p className="text-xs text-slate-600">
                          Optional if it matches your account phone — use when someone at the site should be reached directly.
                        </p>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <input
                            type="tel"
                            value={draft.contactPhone}
                            onChange={(event) =>
                              handleAddressDraftChange(
                                index,
                                "contactPhone",
                                formatPhoneNumber(event.target.value)
                              )
                            }
                            className="otg-input min-w-0 flex-1"
                            placeholder="(555) 555-5555"
                            autoComplete="tel-local"
                          />
                          <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-36">
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Extension
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={draft.contactPhoneExtension}
                              onChange={(event) =>
                                handleAddressDraftChange(
                                  index,
                                  "contactPhoneExtension",
                                  normalizePhoneExtension(event.target.value)
                                )
                              }
                              className="otg-input w-full"
                              placeholder="Ext."
                              maxLength={10}
                              autoComplete="tel-extension"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="otg-label">Street Address</label>
                        <input
                          type="text"
                          value={draft.address}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "address", event.target.value)
                          }
                          className="otg-input"
                          placeholder="123 Main St"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="otg-label">City</label>
                        <input
                          type="text"
                          value={draft.city}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "city", event.target.value)
                          }
                          className="otg-input"
                          placeholder="Pocatello"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="otg-label">State</label>
                        <UsStateSelect
                          value={draft.state}
                          onChange={(code) => handleAddressDraftChange(index, "state", code)}
                          className="otg-input"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="otg-label">ZIP</label>
                        <input
                          type="text"
                          value={draft.zip}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "zip", event.target.value)
                          }
                          className="otg-input"
                          placeholder="83202"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="otg-label">Gate Code</label>
                        <input
                          type="text"
                          value={draft.gateCode}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "gateCode", event.target.value)
                          }
                          className="otg-input"
                          placeholder="Optional"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="otg-label">Parking Notes</label>
                        <textarea
                          value={draft.parkingNotes}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "parkingNotes", event.target.value)
                          }
                          className="otg-input min-h-24"
                          placeholder="Parking instructions or access details"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="otg-label">Service Notes</label>
                        <textarea
                          value={draft.serviceNotes}
                          onChange={(event) =>
                            handleAddressDraftChange(index, "serviceNotes", event.target.value)
                          }
                          className="otg-input min-h-24"
                          placeholder="Anything the technician should know about this location"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={draft.isDefault}
                            onChange={(event) =>
                              handleAddressDraftChange(index, "isDefault", event.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          <span>Use as default service address</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {addressMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {addressMessage}
            </div>
          ) : null}
        </div>
      </div>
    </CustomerPortalShell>
  );
}
