"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Clock, Loader2, MapPin, Wrench } from "lucide-react";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildVehicleLabel,
  buildVehicleDetailLabel,
  fetchCustomerPortalData,
  type CustomerPortalAddress,
  type CustomerPortalData,
} from "@/lib/customer-portal";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/tech-inspection";
import { getCentralDispatchTravelMinutes } from "@/lib/routing";
import { PRE_SERVICE_STAGING_MINUTES } from "@/lib/scheduler-slots";
import {
  CUSTOMER_OTHER_SERVICE_ID,
  REPAIR_OTHER_SERVICE_CODE,
  isCustomerUnscheduledServiceRequest,
} from "@/lib/service-other";

type AvailableSlot = {
  technician_user_id: string;
  starts_at: string;
  ends_at: string;
  travel_time_minutes: number | null;
};

type ScheduleBlock = {
  technician_user_id: string;
  starts_at: string;
  ends_at: string;
};

type CatalogService = {
  id: string;
  service_code: string | null;
  service_name: string;
  service_description: string | null;
  default_duration_minutes: number | null;
};

/** Used only if the service_catalog query fails or returns no bookable rows. */
const FALLBACK_CATALOG_SERVICES: CatalogService[] = [
  {
    id: "oil_change",
    service_code: "oil_change",
    service_name: "Oil Change",
    service_description: "Oil and filter service with basic checks.",
    default_duration_minutes: 30,
  },
  {
    id: "inspection",
    service_code: "inspection",
    service_name: "Inspection",
    service_description: "Vehicle inspection and condition report.",
    default_duration_minutes: 45,
  },
  {
    id: "both",
    service_code: "oil_change_and_inspection",
    service_name: "Both",
    service_description: "Book an oil change together with a vehicle inspection.",
    default_duration_minutes: 90,
  },
  {
    id: "repair_other",
    service_code: "repair_other",
    service_name: "Repair / Other",
    service_description: "Use this when you need a repair visit or another service not listed above.",
    default_duration_minutes: 120,
  },
];

const formatServiceDurationLabel = (service: CatalogService) => {
  if (service.service_code === REPAIR_OTHER_SERVICE_CODE) {
    return "review first";
  }
  const name = (service.service_name || "").trim().toLowerCase();
  if (name.includes("repair") && name.includes("other")) {
    return "review first";
  }
  if (service.default_duration_minutes == null || service.default_duration_minutes <= 0) {
    return "varies";
  }
  return `${service.default_duration_minutes} min`;
};

const ADDRESS_LOCATION_OPTIONS = [
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "office-building", label: "Office Building" },
  { value: "other", label: "Other" },
];

const getAddressLocationDetails = (label: string | null | undefined) => {
  const trimmedLabel = String(label || "").trim();
  const matchingOption = ADDRESS_LOCATION_OPTIONS.find(
    (option) => option.value !== "other" && option.label.toLowerCase() === trimmedLabel.toLowerCase(),
  );

  return {
    locationType: matchingOption?.value || (trimmedLabel ? "other" : "house"),
    locationLabel: matchingOption?.label || trimmedLabel || "House",
    customLocationLabel: matchingOption ? "" : trimmedLabel,
  };
};

const getSavedAddressSummary = (address: CustomerPortalAddress) => {
  const { locationLabel } = getAddressLocationDetails(address.label);
  const streetLine = [address.address, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(", ");

  return streetLine ? `${locationLabel} - ${streetLine}` : locationLabel;
};

const normalizeAddressValue = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase();

const LOCATION_PERMISSION_WARNING_TYPES = new Set([
  "condo",
  "apartment",
  "office-building",
  "other",
]);

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const parseDateOnly = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

const formatDayLabel = (dateKey: string) =>
  parseDateOnly(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatSlotTime = (slot: AvailableSlot) => {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);

  return `${start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

const getSlotKey = (slot: AvailableSlot) =>
  `${slot.technician_user_id}-${slot.starts_at}-${slot.ends_at}`;

const getSchedulerDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 21);

  return { start, end };
};

const buildSlotsFromScheduleBlocks = (
  blocks: ScheduleBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  slotMinutes: number,
) => {
  const slotMs = slotMinutes * 60 * 1000;
  const nextSlots: AvailableSlot[] = [];

  blocks.forEach((block) => {
    const blockStart = new Date(block.starts_at);
    const blockEnd = new Date(block.ends_at);
    const slotStart = new Date(Math.max(blockStart.getTime(), rangeStart.getTime()));
    const slotLimit = Math.min(blockEnd.getTime(), rangeEnd.getTime());

    while (slotStart.getTime() + slotMs <= slotLimit) {
      const slotEnd = new Date(slotStart.getTime() + slotMs);

      nextSlots.push({
        technician_user_id: block.technician_user_id,
        starts_at: slotStart.toISOString(),
        ends_at: slotEnd.toISOString(),
        travel_time_minutes: 30,
      });

      slotStart.setTime(slotStart.getTime() + slotMs);
    }
  });

  return nextSlots.sort(
    (first, second) =>
      new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
  );
};

const applySavedAddressToForm = (
  address: CustomerPortalAddress,
  setters: {
    setLocationType: (value: string) => void;
    setCustomLocationLabel: (value: string) => void;
    setServiceAddress: (value: string) => void;
    setServiceCity: (value: string) => void;
    setServiceState: (value: string) => void;
    setServiceZip: (value: string) => void;
  },
) => {
  const { locationType, customLocationLabel } = getAddressLocationDetails(address.label);

  setters.setLocationType(locationType);
  setters.setCustomLocationLabel(customLocationLabel);
  setters.setServiceAddress(address.address || "");
  setters.setServiceCity(address.city || "");
  setters.setServiceState(address.state || "");
  setters.setServiceZip(address.zip || "");
};

const markManualAddressEditing = (
  selectedAddressId: string,
  setSelectedAddressId: (value: string) => void,
) => {
  if (selectedAddressId !== "manual") {
    setSelectedAddressId("manual");
  }
};

function CustomerSchedulePageContent() {
  const searchParams = useSearchParams();
  const appliedQueryRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("manual");
  const [locationType, setLocationType] = useState("house");
  const [customLocationLabel, setCustomLocationLabel] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [serviceCity, setServiceCity] = useState("");
  const [serviceState, setServiceState] = useState("");
  const [serviceZip, setServiceZip] = useState("");
  const [hasLocationPermissionConfirmation, setHasLocationPermissionConfirmation] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [travelLookupDebug, setTravelLookupDebug] = useState("");

  const services = useMemo(() => {
    const base =
      catalogServices.length > 0 ? catalogServices : FALLBACK_CATALOG_SERVICES;
    if (base.some((s) => s.service_code === REPAIR_OTHER_SERVICE_CODE)) {
      return base;
    }
    return [
      ...base,
      {
        id: CUSTOMER_OTHER_SERVICE_ID,
        service_code: REPAIR_OTHER_SERVICE_CODE,
        service_name: "Other — describe the service needed",
        service_description:
          "Tell us what you need. The shop will review your request and contact you before scheduling.",
        default_duration_minutes: null,
      },
    ];
  }, [catalogServices]);

  useEffect(() => {
    if (loading || appliedQueryRef.current) return;

    const vehicleParam = searchParams.get("vehicle");
    const flow = searchParams.get("flow");
    const hasQuery = Boolean(vehicleParam || flow);
    if (!hasQuery) {
      appliedQueryRef.current = true;
      return;
    }

    const vehList = (portalData?.vehicles ?? []).filter((vehicle) => Boolean(vehicle.id));
    if (vehicleParam && vehList.some((vehicle) => vehicle.id === vehicleParam)) {
      setSelectedVehicleId(vehicleParam);
    }

    const base =
      catalogServices.length > 0 ? catalogServices : FALLBACK_CATALOG_SERVICES;
    const withOther: CatalogService[] = base.some(
      (service) => service.service_code === REPAIR_OTHER_SERVICE_CODE,
    )
      ? base
      : [
          ...base,
          {
            id: CUSTOMER_OTHER_SERVICE_ID,
            service_code: REPAIR_OTHER_SERVICE_CODE,
            service_name: "Other — describe the service needed",
            service_description:
              "Tell us what you need. The shop will review your request and contact you before scheduling.",
            default_duration_minutes: null,
          },
        ];

    if (flow === "request") {
      const otherSvc =
        withOther.find(
          (service) =>
            service.id === CUSTOMER_OTHER_SERVICE_ID ||
            service.service_code === REPAIR_OTHER_SERVICE_CODE,
        ) || null;
      if (otherSvc) {
        setSelectedServiceId(otherSvc.id);
        setSelectedSlotKey("");
      }
    } else if (flow === "book") {
      const firstBookable = withOther.find(
        (service) => !isCustomerUnscheduledServiceRequest(service.id, service),
      );
      if (firstBookable) {
        setSelectedServiceId(firstBookable.id);
        setSelectedSlotKey("");
      }
    }

    appliedQueryRef.current = true;
  }, [loading, catalogServices, portalData, searchParams]);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get("guided") !== "1") return;
    const timer = window.setTimeout(() => {
      document
        .getElementById("customer-schedule-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loading, searchParams]);

  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const isUnscheduledServiceRequest = isCustomerUnscheduledServiceRequest(
    selectedServiceId,
    selectedService ?? undefined,
  );
  const selectedServiceDuration = isUnscheduledServiceRequest
    ? 0
    : Math.max(0, selectedService?.default_duration_minutes ?? 60);
  const selectedSlotTravelMinutes = slots.find(
    (slot) => getSlotKey(slot) === selectedSlotKey,
  )?.travel_time_minutes;
  const estimatedTravelMinutes = selectedSlotTravelMinutes ?? 30;
  const totalSlotMinutes = selectedServiceDuration + estimatedTravelMinutes;
  const locationName =
    locationType === "other"
      ? customLocationLabel.trim()
      : ADDRESS_LOCATION_OPTIONS.find((option) => option.value === locationType)?.label || "House";

  const loadAvailableSlots = async () => {
    if (isUnscheduledServiceRequest) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    setLoadingSlots(true);

    try {
      const { start, end } = getSchedulerDateRange();
      const slotMinutes = selectedServiceDuration;
      const dispatchTravel = await getCentralDispatchTravelMinutes({
        serviceAddress,
        serviceCity,
        serviceState,
        serviceZip,
      });
      const dispatchTravelMinutes = dispatchTravel.minutes;
      setTravelLookupDebug(
        dispatchTravelMinutes != null
          ? `Travel default source: ${dispatchTravel.provider} (${dispatchTravel.reason}), ${dispatchTravelMinutes} min`
          : `Travel default source: ${dispatchTravel.provider} (${dispatchTravel.reason}), using fallback defaults`,
      );
      const { data, error } = await supabase.rpc("get_customer_available_schedule_slots", {
        p_range_start: start.toISOString(),
        p_range_end: end.toISOString(),
        p_service_duration_minutes: slotMinutes,
        p_service_city: serviceCity || null,
        p_service_state: serviceState || null,
        p_service_zip: serviceZip || null,
        p_default_travel_time_minutes: dispatchTravelMinutes,
      });

      if (!error) {
        setSlots((data || []) as AvailableSlot[]);
        return;
      }

      console.warn("Falling back to direct availability blocks:", error);

      const { data: blockData, error: blockError } = await supabase
        .from("technician_schedule_blocks")
        .select("technician_user_id, starts_at, ends_at")
        .eq("status", "active")
        .eq("block_type", "available")
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString())
        .order("starts_at", { ascending: true });

      if (blockError) throw blockError;

      setSlots(
        buildSlotsFromScheduleBlocks(
          (blockData || []) as ScheduleBlock[],
          start,
          end,
          selectedServiceDuration + PRE_SERVICE_STAGING_MINUTES + (dispatchTravelMinutes ?? 30),
          dispatchTravelMinutes ?? 30,
        ),
      );
    } catch (error) {
      console.error("Failed to load customer schedule slots:", error);
      setMessage(
        "We could not load available service times. Make sure the latest Supabase scheduler migration has been applied.",
      );
    } finally {
      setLoadingSlots(false);
    }
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

        const nextPortalData = await fetchCustomerPortalData(user.id);
        setPortalData(nextPortalData);
        setSelectedVehicleId(nextPortalData.vehicles[0]?.id || "");

        const { data: catalogData, error: catalogError } = await supabase
          .from("service_catalog")
          .select("id, service_code, service_name, service_description, default_duration_minutes")
          .eq("is_active", true)
          .eq("is_bookable_online", true)
          .order("sort_order", { ascending: true })
          .order("service_name", { ascending: true });

        if (catalogError) {
          console.warn("Service catalog load failed, using fallback list:", catalogError);
        }

        const nextCatalog: CatalogService[] =
          catalogData && catalogData.length > 0
            ? (catalogData as CatalogService[])
            : FALLBACK_CATALOG_SERVICES;

        setCatalogServices(nextCatalog);
        setSelectedServiceId(nextCatalog[0]?.id || "");

        const nextAddresses = (nextPortalData.addresses || []) as CustomerPortalAddress[];
        const defaultAddress = nextAddresses.find((address) => address.is_default) || nextAddresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id || "manual");
          applySavedAddressToForm(defaultAddress, {
            setLocationType,
            setCustomLocationLabel,
            setServiceAddress,
            setServiceCity,
            setServiceState,
            setServiceZip,
          });
        }
      } catch (error) {
        console.error("Customer scheduler load failed:", error);
        setMessage("We could not load the scheduler. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, []);

  useEffect(() => {
    if (loading) return;

    setSelectedSlotKey("");
    void loadAvailableSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isUnscheduledServiceRequest, selectedServiceDuration, serviceCity, serviceState, serviceZip]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const calendarDays = useMemo(() => {
    const { start } = getSchedulerDateRange();

    return Array.from({ length: 21 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return toDateKey(date);
    });
  }, []);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, AvailableSlot[]>();

    slots.forEach((slot) => {
      const dateKey = toDateKey(new Date(slot.starts_at));
      grouped.set(dateKey, [...(grouped.get(dateKey) || []), slot]);
    });

    return grouped;
  }, [slots]);

  const selectedDateSlots = slotsByDate.get(selectedDateKey) || [];
  const selectedSlot = slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null;
  const vehicles = (portalData?.vehicles ?? []).filter(
    (vehicle) => Boolean(vehicle.id),
  );
  const addresses = (portalData?.addresses ?? []).filter(
    (address): address is CustomerPortalAddress => Boolean(address.id),
  );
  const customer = portalData?.customer ?? null;
  const hasLocationDetails =
    Boolean(serviceAddress.trim()) &&
    Boolean(serviceCity.trim()) &&
    Boolean(serviceState.trim()) &&
    Boolean(serviceZip.trim()) &&
    (locationType !== "other" || Boolean(customLocationLabel.trim()));
  const showLocationPermissionWarning = LOCATION_PERMISSION_WARNING_TYPES.has(locationType);
  const hasRequiredLocationConfirmation =
    !showLocationPermissionWarning || hasLocationPermissionConfirmation;
  const canShowScheduler =
    !isUnscheduledServiceRequest &&
    Boolean(selectedVehicleId) &&
    hasLocationDetails &&
    hasRequiredLocationConfirmation;
  const vehicleRequiredError = attemptedSubmit && !selectedVehicleId;
  const locationTypeRequiredError =
    attemptedSubmit && locationType === "other" && !customLocationLabel.trim();
  const serviceAddressRequiredError = attemptedSubmit && !serviceAddress.trim();
  const serviceCityRequiredError = attemptedSubmit && !serviceCity.trim();
  const serviceStateRequiredError = attemptedSubmit && !serviceState.trim();
  const serviceZipRequiredError = attemptedSubmit && !serviceZip.trim();
  const permissionConfirmationError =
    attemptedSubmit && showLocationPermissionWarning && !hasLocationPermissionConfirmation;
  const requestDetailsRequiredError =
    attemptedSubmit && isUnscheduledServiceRequest && !notes.trim();
  const selectedSlotRequiredError =
    attemptedSubmit && !isUnscheduledServiceRequest && !selectedSlot;

  useEffect(() => {
    if (selectedAddressId === "manual") {
      const hasManualAddress =
        serviceAddress.trim() ||
        serviceCity.trim() ||
        serviceState.trim() ||
        serviceZip.trim() ||
        customLocationLabel.trim();

      if (!hasManualAddress && addresses.length > 0) {
        const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
        if (defaultAddress?.id) {
          setSelectedAddressId(defaultAddress.id);
          applySavedAddressToForm(defaultAddress, {
            setLocationType,
            setCustomLocationLabel,
            setServiceAddress,
            setServiceCity,
            setServiceState,
            setServiceZip,
          });
        }
      }

      return;
    }

    const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
    if (!selectedAddress) {
      return;
    }

    applySavedAddressToForm(selectedAddress, {
      setLocationType,
      setCustomLocationLabel,
      setServiceAddress,
      setServiceCity,
      setServiceState,
      setServiceZip,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, selectedAddressId]);

  const handleAddressChange = (addressId: string) => {
    setSelectedAddressId(addressId);

    if (addressId === "manual") {
      return;
    }

    const address = addresses.find((currentAddress) => currentAddress.id === addressId);
    if (!address) return;

    applySavedAddressToForm(address, {
      setLocationType,
      setCustomLocationLabel,
      setServiceAddress,
      setServiceCity,
      setServiceState,
      setServiceZip,
    });
  };

  const handleLocationTypeChange = (value: string) => {
    markManualAddressEditing(selectedAddressId, setSelectedAddressId);
    setLocationType(value);
    setHasLocationPermissionConfirmation(false);

    if (value !== "other") {
      setCustomLocationLabel("");
    }
  };

  const saveAddressIfNew = async () => {
    if (!customer?.id) {
      return null;
    }

    const nextAddressLabel = locationName || null;
    const matchingAddress = addresses.find((address) =>
      normalizeAddressValue(address.label) === normalizeAddressValue(nextAddressLabel) &&
      normalizeAddressValue(address.address) === normalizeAddressValue(serviceAddress) &&
      normalizeAddressValue(address.city) === normalizeAddressValue(serviceCity) &&
      normalizeAddressValue(address.state) === normalizeAddressValue(serviceState) &&
      normalizeAddressValue(address.zip) === normalizeAddressValue(serviceZip),
    );

    if (matchingAddress?.id) {
      if (selectedAddressId !== matchingAddress.id) {
        setSelectedAddressId(matchingAddress.id);
      }

      return matchingAddress;
    }

    const payload = {
      customer_id: customer.id,
      address_type: "service",
      is_default: false,
      label: nextAddressLabel,
      address: serviceAddress.trim(),
      city: serviceCity.trim() || null,
      state: serviceState.trim().toUpperCase() || null,
      zip: serviceZip.trim() || null,
    };

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert(payload)
      .select(
        "id, customer_id, address_type, is_default, label, contact_name, contact_phone, address, city, state, zip, gate_code, parking_notes, service_notes, created_at, updated_at",
      )
      .single();

    if (error) {
      throw error;
    }

    const insertedAddress = data as CustomerPortalAddress;
    setSelectedAddressId(insertedAddress.id || "manual");
    setPortalData((current) =>
      current
        ? {
            ...current,
            addresses: [...(current.addresses || []), insertedAddress],
          }
        : current,
    );

    return insertedAddress;
  };

  const handleSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    setMessage("");

    if (!selectedVehicleId) {
      setMessage("Choose the vehicle you want to schedule.");
      return;
    }

    if (!selectedServiceId || !selectedService) {
      setMessage("Choose the type of service you need.");
      return;
    }

    if (!isUnscheduledServiceRequest && !selectedSlot) {
      setMessage("Choose an available service time.");
      return;
    }

    if (!serviceAddress.trim()) {
      setMessage("Add the service address so the technician knows where to go.");
      return;
    }

    if (locationType === "other" && !customLocationLabel.trim()) {
      setMessage("Add a location description when you choose Other.");
      return;
    }

    if (showLocationPermissionWarning && !hasLocationPermissionConfirmation) {
      setMessage("Please confirm that you have permission to have work performed on your vehicle at this location.");
      return;
    }

    if (isUnscheduledServiceRequest && !notes.trim()) {
      setMessage("Add a few details about the repair or service request so the team can follow up.");
      return;
    }

    setScheduling(true);

    try {
      await saveAddressIfNew();

      const { error } = isUnscheduledServiceRequest
        ? await supabase.rpc("create_customer_unscheduled_job_request", {
            p_vehicle_id: selectedVehicleId,
            p_service_type: selectedService?.service_code || selectedService?.service_name || "repair_other",
            p_service_description: notes || selectedService?.service_description || null,
            p_notes: notes || null,
            p_service_location_name: locationName || null,
            p_service_address: serviceAddress || null,
            p_service_city: serviceCity || null,
            p_service_state: serviceState || null,
            p_service_zip: serviceZip || null,
          })
        : await supabase.rpc("create_customer_scheduled_job", {
            p_vehicle_id: selectedVehicleId,
            p_technician_user_id: selectedSlot!.technician_user_id,
            p_scheduled_start: selectedSlot!.starts_at,
            p_scheduled_end: selectedSlot!.ends_at,
            p_service_type: selectedService?.service_code || selectedService?.service_name || "general_service",
            p_service_description: selectedService?.service_description || selectedService?.service_name || null,
            p_notes: notes || null,
            p_service_duration_minutes: selectedServiceDuration,
            p_travel_time_minutes: estimatedTravelMinutes,
            p_service_location_name: locationName || null,
            p_service_address: serviceAddress || null,
            p_service_city: serviceCity || null,
            p_service_state: serviceState || null,
            p_service_zip: serviceZip || null,
          });

      if (error) throw error;

      setMessage(
        isUnscheduledServiceRequest
          ? "Your service request was sent. The team can review the details and contact you to schedule it."
          : "Your service request was scheduled. The team can now see it on the manager calendar.",
      );
      setAttemptedSubmit(false);
      setSelectedSlotKey("");
      setNotes("");
      if (!isUnscheduledServiceRequest) {
        await loadAvailableSlots();
      }
    } catch (error) {
      console.error("Failed to schedule customer service:", {
        error,
        serialized: JSON.stringify(error, null, 2),
      });
      setMessage(getErrorMessage(error, "That time could not be scheduled. Please choose another slot."));
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading service scheduler...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CustomerPortalShell
      title="Schedule Service"
      subtitle="Use this when you already have service details. For the guided first step, start from Get service."
      onLogout={handleLogout}
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Flow tip: </span>
        Need help choosing request type and vehicle first? Start at{" "}
        <a href="/customer/book" className="font-semibold text-lime-700 underline-offset-2 hover:underline">
          Get service
        </a>
        . This page stays the full scheduler for direct use.
      </div>
      {searchParams.get("guided") === "1" ? (
        <div className="rounded-2xl border border-lime-400/35 bg-lime-400/10 px-4 py-3 text-sm text-slate-800 shadow-sm">
          <span className="font-semibold text-slate-900">Guided setup: </span>
          Vehicle and service type match what you chose in Get service. Finish the service location
          {searchParams.get("flow") === "request"
            ? " and describe what you need, then send the request."
            : ", then choose an available time below."}
        </div>
      ) : null}
      <form onSubmit={handleSchedule} className="flex flex-col gap-6">
        <Card className="order-2 border-0 bg-white shadow-sm">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-lime-950">
                  <CalendarDays className="h-4 w-4" />
                  {isUnscheduledServiceRequest ? "Request Review" : "Next 21 Days"}
                </div>
                <h2 className="mt-3 text-2xl font-black text-slate-950">
                  {isUnscheduledServiceRequest ? "Share the repair details" : "Choose a service time"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {isUnscheduledServiceRequest
                    ? "Repair and other custom requests are reviewed by the team first. Send the details here and we will follow up with scheduling."
                    : "Days with available technician time show a count badge. Slots are based on the selected service duration plus travel buffer."}
                </p>
              </div>

              {canShowScheduler ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl bg-white text-slate-950"
                  onClick={loadAvailableSlots}
                  disabled={loadingSlots}
                >
                  {loadingSlots ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Times
                </Button>
              ) : null}
            </div>
            {travelLookupDebug ? (
              <p className="text-xs text-slate-500">{travelLookupDebug}</p>
            ) : null}

            {!canShowScheduler ? (
              <div
                className={`rounded-[28px] p-5 text-sm leading-6 ${
                  attemptedSubmit
                    ? "border-2 border-red-400 bg-red-50 text-red-950"
                    : "border border-dashed border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                {isUnscheduledServiceRequest
                  ? "Repair and custom requests are reviewed before a time is assigned. Send the details above and the team will follow up with scheduling."
                  : showLocationPermissionWarning && !hasLocationPermissionConfirmation
                    ? "Please check the location permission confirmation above before available appointment times can be shown."
                    : "Choose the vehicle, service type, and full service location above to unlock available appointment times."}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                  {calendarDays.map((dateKey) => {
                    const daySlots = slotsByDate.get(dateKey) || [];
                    const isSelected = dateKey === selectedDateKey;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDateKey(dateKey);
                          setSelectedSlotKey("");
                        }}
                        className={`min-h-24 rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? "border-lime-500 bg-lime-100 shadow-[0_0_0_2px_rgba(132,204,22,0.2)]"
                            : "border-slate-200 bg-slate-50 hover:border-lime-300 hover:bg-lime-50"
                        }`}
                      >
                        <div className="text-sm font-black text-slate-950">{formatDayLabel(dateKey)}</div>
                        <div className="mt-3 inline-flex rounded-full bg-slate-950 px-2 py-1 text-xs font-bold text-white">
                          {daySlots.length} {daySlots.length === 1 ? "slot" : "slots"}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-200 p-2 text-slate-900">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{formatDayLabel(selectedDateKey)}</h3>
                      <p className="text-sm text-slate-600">Select one available appointment window.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedDateSlots.map((slot) => {
                      const slotKey = getSlotKey(slot);
                      const isSelected = slotKey === selectedSlotKey;

                      return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => setSelectedSlotKey(slotKey)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-lime-500 bg-lime-300 text-black"
                              : "border-slate-200 bg-white text-slate-950 hover:border-lime-400 hover:bg-lime-50"
                          }`}
                        >
                          <div className="font-black">{formatSlotTime(slot)}</div>
                          <div className="mt-1 text-sm font-semibold opacity-80">
                            Available technician
                          </div>
                          <div className="mt-2 text-xs font-black opacity-80">
                            Includes {slot.travel_time_minutes ?? 30} min travel buffer
                          </div>
                        </button>
                      );
                    })}

                {selectedDateSlots.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
                    No open technician availability is listed for this day.
                  </div>
                )}
              </div>
              {selectedSlotRequiredError ? (
                <div className="mt-4 rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-sm font-semibold text-red-950">
                  Please choose an available service time before scheduling.
                </div>
              ) : null}
            </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          id="customer-schedule-details"
          className="order-1 h-fit scroll-mt-24 border-0 bg-white shadow-sm"
        >
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                <Wrench className="h-4 w-4" />
                Service Details
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-950">Start your request</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Choose the service type and service location for {customer?.first_name || "your account"} first. Once those details are ready, the scheduler will appear below when online booking applies.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Vehicle
              </label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger
                  className={`otg-schedule-select-trigger h-11 bg-white text-slate-950 ${
                    vehicleRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : ""
                  }`}
                >
                  <SelectValue placeholder="Choose vehicle" />
                </SelectTrigger>
                <SelectContent className="otg-schedule-select-content">
                  {vehicles.map((vehicle) => (
                    <SelectItem
                      key={vehicle.id}
                      value={vehicle.id || ""}
                      className="otg-schedule-select-item"
                    >
                      {`${buildVehicleLabel(vehicle)} - ${buildVehicleDetailLabel(vehicle)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vehicleRequiredError ? (
                <p className="text-sm font-semibold !text-red-600">
                  Please choose the vehicle you want to service.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Service Needed
              </label>
              <Select
                value={selectedServiceId}
                onValueChange={(id) => {
                  setSelectedServiceId(id);
                  setSelectedSlotKey("");
                }}
              >
                <SelectTrigger className="otg-schedule-select-trigger h-11 bg-white text-slate-950">
                  <SelectValue placeholder="Choose service" />
                </SelectTrigger>
                <SelectContent className="otg-schedule-select-content">
                  {services.map((service) => (
                    <SelectItem
                      key={service.id}
                      value={service.id}
                      className="otg-schedule-select-item"
                    >
                      {service.service_name} ({formatServiceDurationLabel(service)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {selectedService?.service_description ||
                  "This service will reserve the selected amount of technician time."}
                <div className="mt-2 font-black text-slate-950">
                  {isUnscheduledServiceRequest
                    ? "Scheduling stays open until the team reviews your request and follows up with you."
                    : `Service: ${selectedServiceDuration} min. Travel buffer is estimated from the technician's previous job after you choose a slot.`}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Service Address
              </label>
              {addresses.length > 0 && (
                <Select value={selectedAddressId} onValueChange={handleAddressChange}>
                  <SelectTrigger className="otg-schedule-select-trigger h-11 bg-white text-slate-950">
                    <SelectValue placeholder="Choose saved address" />
                  </SelectTrigger>
                  <SelectContent className="otg-schedule-select-content">
                    <SelectItem value="manual" className="otg-schedule-select-item">
                      Enter a different address
                    </SelectItem>
                    {addresses.map((address) => (
                      <SelectItem
                        key={address.id}
                        value={address.id || ""}
                        className="otg-schedule-select-item"
                      >
                        {getSavedAddressSummary(address)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="grid gap-3">
                <Select value={locationType} onValueChange={handleLocationTypeChange}>
                  <SelectTrigger
                    className={`otg-schedule-select-trigger h-11 bg-white text-slate-950 ${
                      locationTypeRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : ""
                    }`}
                  >
                    <SelectValue placeholder="Choose location type" />
                  </SelectTrigger>
                  <SelectContent className="otg-schedule-select-content">
                    {ADDRESS_LOCATION_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="otg-schedule-select-item"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locationType === "other" ? (
                  <>
                    <input
                      value={customLocationLabel}
                      onChange={(event) => {
                        markManualAddressEditing(selectedAddressId, setSelectedAddressId);
                        setCustomLocationLabel(event.target.value);
                      }}
                      placeholder="Describe the location"
                      className={`h-11 rounded-lg border bg-white px-3 text-sm text-slate-950 ${
                        locationTypeRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : "border-slate-300"
                      }`}
                    />
                    {locationTypeRequiredError ? (
                      <p className="text-sm font-semibold !text-red-600">
                        Please describe the location when you choose Other.
                      </p>
                    ) : null}
                  </>
                ) : null}
                <input
                  value={serviceAddress}
                  onChange={(event) => {
                    markManualAddressEditing(selectedAddressId, setSelectedAddressId);
                    setServiceAddress(event.target.value);
                  }}
                  placeholder="Street address"
                  className={`h-11 rounded-lg border bg-white px-3 text-sm text-slate-950 ${
                    serviceAddressRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : "border-slate-300"
                  }`}
                />
                {serviceAddressRequiredError ? (
                  <p className="text-sm font-semibold !text-red-600">
                    Street address is required.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[1fr_80px_110px]">
                  <div className="space-y-1">
                    <input
                      value={serviceCity}
                      onChange={(event) => {
                        markManualAddressEditing(selectedAddressId, setSelectedAddressId);
                        setServiceCity(event.target.value);
                      }}
                      placeholder="City"
                      className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-950 ${
                        serviceCityRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : "border-slate-300"
                      }`}
                    />
                    {serviceCityRequiredError ? (
                      <p className="text-sm font-semibold !text-red-600">City is required.</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <input
                      value={serviceState}
                      onChange={(event) => {
                        markManualAddressEditing(selectedAddressId, setSelectedAddressId);
                        setServiceState(event.target.value.toUpperCase());
                      }}
                      placeholder="State"
                      maxLength={2}
                      className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-950 ${
                        serviceStateRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : "border-slate-300"
                      }`}
                    />
                    {serviceStateRequiredError ? (
                      <p className="text-sm font-semibold !text-red-600">State is required.</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <input
                      value={serviceZip}
                      onChange={(event) => {
                        markManualAddressEditing(selectedAddressId, setSelectedAddressId);
                        setServiceZip(event.target.value);
                      }}
                      placeholder="ZIP"
                      className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-950 ${
                        serviceZipRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : "border-slate-300"
                      }`}
                    />
                    {serviceZipRequiredError ? (
                      <p className="text-sm font-semibold !text-red-600">ZIP is required.</p>
                    ) : null}
                  </div>
                </div>
                {showLocationPermissionWarning ? (
                  <div className="space-y-2">
                    <label
                      className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-sm font-semibold shadow-[0_0_0_1px_rgba(252,165,165,0.35)] ${
                        permissionConfirmationError
                          ? "!border-red-500 !bg-red-100 !text-red-950"
                          : "!border-red-300 !bg-red-50 !text-red-950"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={hasLocationPermissionConfirmation}
                        onChange={(event) => setHasLocationPermissionConfirmation(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-red-300 text-red-600 focus:ring-red-500"
                      />
                      <span>
                        I confirm that I have permission to have work performed on my vehicle at this location.
                      </span>
                    </label>
                    {permissionConfirmationError ? (
                      <p className="text-sm font-semibold !text-red-600">
                        You must confirm permission before scheduling at this location.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {isUnscheduledServiceRequest ? "Describe the services needed" : "Notes"}
              </label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={
                  isUnscheduledServiceRequest
                    ? "Describe the services needed (symptoms, goals, parts, or timing). The team will follow up — no time slot is booked yet."
                    : "Anything else the technician should know?"
                }
                className={`min-h-24 bg-white text-slate-950 ${
                  requestDetailsRequiredError ? "!border-red-500 !ring-2 !ring-red-300" : ""
                }`}
              />
              {requestDetailsRequiredError ? (
                <p className="text-sm font-semibold !text-red-600">
                  Please add request details so the team can follow up.
                </p>
              ) : null}
            </div>

            {!isUnscheduledServiceRequest && selectedSlot && (
              <div className="rounded-2xl border border-lime-300 bg-lime-100 p-4 text-sm text-lime-950">
                <div className="font-black">Selected time</div>
                <div className="mt-1 font-semibold">
                  {formatDayLabel(toDateKey(new Date(selectedSlot.starts_at)))} at{" "}
                  {formatSlotTime(selectedSlot)}
                </div>
                <div className="mt-2 font-semibold">
                  Blocks {selectedServiceDuration} min service + {estimatedTravelMinutes} min estimated travel = {totalSlotMinutes} min.
                </div>
                <div className="mt-3 flex gap-2 text-sm font-semibold">
                  <MapPin className="mt-0.5 h-4 w-4" />
                  <span>
                    {[locationName, serviceAddress, serviceCity, serviceState, serviceZip]
                          .filter(Boolean)
                          .join(", ")
                      || "Service address not added yet"}
                  </span>
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                {message}
              </div>
            )}

            {vehicles.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
                No vehicle is linked to this customer account yet, so scheduling is disabled.
              </div>
            )}

          </CardContent>
        </Card>

        <div className="order-3">
          <Button
            type="submit"
            className="h-12 w-full rounded-2xl bg-lime-400 font-black text-black hover:bg-lime-300"
            disabled={scheduling || loadingSlots || vehicles.length === 0}
          >
            {scheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {scheduling
              ? (isUnscheduledServiceRequest ? "Sending Request..." : "Scheduling...")
              : (isUnscheduledServiceRequest ? "Send Request" : "Schedule Service")}
          </Button>
        </div>
      </form>
    </CustomerPortalShell>
  );
}

export default function CustomerSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="otg-page">
          <div className="otg-container">
            <div className="otg-card p-8">
              <p className="otg-body">Loading service scheduler...</p>
            </div>
          </div>
        </div>
      }
    >
      <CustomerSchedulePageContent />
    </Suspense>
  );
}
