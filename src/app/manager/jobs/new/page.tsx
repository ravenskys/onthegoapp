"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Plus, Save, CalendarDays, Clock, MapPin } from "lucide-react";

import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { VehicleCatalogFields } from "@/components/vehicle/VehicleCatalogFields";
import {
  formatPhoneNumber,
  normalizeEmail,
  normalizeLicensePlate,
  normalizeVin,
  normalizeYear,
} from "@/lib/input-formatters";
import { getPhoneInputWarning } from "@/lib/input-validation-feedback";
import {
  laborSellTotalFromHours,
  laborShopCostFromHours,
  LABOR_COST_USD_PER_HOUR,
  LABOR_SELL_USD_PER_HOUR,
} from "@/lib/labor-pricing";
import {
  MANAGER_OTHER_SERVICE_VALUE,
  MANAGER_OTHER_VEHICLE_VALUE,
  REPAIR_OTHER_SERVICE_CODE,
  parseOptionalDecimal,
} from "@/lib/service-other";
import {
  PART_UNIT_SELL_RULE,
  formatSellPriceForPartInput,
  resolvePartUnitPriceForSave,
  unitSellPriceFromUnitCost,
} from "@/lib/pricing";
import { getTechnicianHourlyPayAsOf } from "@/lib/technician-pay";
import {
  type AvailableSlot,
  PRE_SERVICE_STAGING_MINUTES,
  type ScheduleBlock,
  buildSlotsFromScheduleBlocks,
  formatDayLabel,
  formatSlotTime,
  getSchedulerDateRange,
  getSlotKey,
  toDateKey,
} from "@/lib/scheduler-slots";
import { getCentralDispatchTravelMinutes } from "@/lib/routing";
import { UsStateSelect } from "@/components/forms/UsStateSelect";
import { DEFAULT_US_STATE_CODE } from "@/lib/us-states";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type Vehicle = {
  id: string;
  customer_id: string | null;
  year: string | number | null;
  make: string | null;
  model: string | null;
  engine_size: string | null;
  license_plate: string | null;
  vin: string | null;
};

type Technician = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

/** Row from `service_catalog` — shop job form lists all active services, including internal (not bookable online). */
type CatalogServiceRow = {
  id: string;
  service_name: string;
  service_description: string | null;
  is_bookable_online: boolean;
  category: string | null;
  sort_order: number | null;
  service_code: string | null;
  default_duration_minutes: number | null;
};

const FALLBACK_SERVICE_CATALOG: CatalogServiceRow[] = [
  {
    id: "fallback-1",
    service_name: "Oil Change",
    service_description:
      "Perform engine oil and oil filter service. Inspect visible fluids and basic maintenance items during visit.",
    is_bookable_online: true,
    category: "Maintenance",
    sort_order: 10,
    service_code: "oil_change",
    default_duration_minutes: 30,
  },
  {
    id: "fallback-2",
    service_name: "Inspection",
    service_description:
      "Perform inspection, document findings, and provide recommended services based on condition observed.",
    is_bookable_online: true,
    category: "Inspection",
    sort_order: 20,
    service_code: "inspection",
    default_duration_minutes: 45,
  },
  {
    id: "fallback-3",
    service_name: "Oil Change + Inspection",
    service_description:
      "Perform engine oil and oil filter service, complete vehicle inspection, document findings, and provide recommended services based on condition observed.",
    is_bookable_online: true,
    category: "Maintenance",
    sort_order: 30,
    service_code: "oil_change_and_inspection",
    default_duration_minutes: 90,
  },
  {
    id: "fallback-4",
    service_name: "Repair / Other",
    service_description: "",
    is_bookable_online: true,
    category: "Repair",
    sort_order: 40,
    service_code: REPAIR_OTHER_SERVICE_CODE,
    default_duration_minutes: 60,
  },
];

/** Match `.otg-portal-dark` select/input surfaces (`globals.css`) — customer combobox uses Button, not SelectTrigger. */
const managerDarkFieldTriggerClassName = cn(
  "h-8 w-full justify-between rounded-lg px-2.5 font-normal shadow-none",
  "!border-[rgba(115,145,126,0.35)] !bg-[#121b14] !text-[#f3fff4]",
  "hover:!bg-[#1a2620] aria-expanded:!bg-[#1a2620]"
);

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow");
  const returningPickerOpenedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceRow[]>(
    []
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [serviceType, setServiceType] = useState("");
  const [priority, setPriority] = useState("normal");
  const [serviceDescription, setServiceDescription] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [assignedTechId, setAssignedTechId] = useState("");
  const [notes, setNotes] = useState("");

  /** Service location for scheduler travel buffer (same RPC as customer portal). */
  const [serviceAddress, setServiceAddress] = useState("");
  const [serviceCity, setServiceCity] = useState("");
  const [serviceState, setServiceState] = useState(DEFAULT_US_STATE_CODE);
  const [serviceZip, setServiceZip] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [scheduleLoadError, setScheduleLoadError] = useState("");
  const [travelLookupDebug, setTravelLookupDebug] = useState("");

  const [otherLaborHours, setOtherLaborHours] = useState("");
  const [otherPartName, setOtherPartName] = useState("");
  const [otherPartQty, setOtherPartQty] = useState("1");
  const [otherPartUnitCost, setOtherPartUnitCost] = useState("");
  const [otherPartUnitPrice, setOtherPartUnitPrice] = useState("");

  /** Resolved shop pay rate for assigned tech (for labor cost). */
  const [assignedTechHourlyPay, setAssignedTechHourlyPay] = useState<number | null>(null);
  const [assignedTechPayEffectiveYmd, setAssignedTechPayEffectiveYmd] = useState<string | null>(null);

  const [customerOpen, setCustomerOpen] = useState(false);

  const [newCustomerFirst, setNewCustomerFirst] = useState("");
  const [newCustomerLast, setNewCustomerLast] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerPhoneFormatHint, setNewCustomerPhoneFormatHint] = useState<string | null>(null);
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  /** Inline validation for Step 1 — Add customer (highlights fields + messages). */
  const [newCustomerErrors, setNewCustomerErrors] = useState<
    Partial<Record<"name" | "email" | "phone", string>>
  >({});

  const newCustomerInputErrorClass =
    "!border-red-500 !ring-2 !ring-red-200 focus-visible:!ring-red-300";

  const [newVehicleYear, setNewVehicleYear] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleEngineSize, setNewVehicleEngineSize] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleVin, setNewVehicleVin] = useState("");
  const [useCustomMake, setUseCustomMake] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [useCustomEngineSize, setUseCustomEngineSize] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);

  const filteredVehicles = vehicles.filter(
      (vehicle) => vehicle.customer_id === selectedCustomerId
    );

  const selectedCatalogRow = useMemo(
    () => catalogServices.find((s) => s.service_name === serviceType),
    [catalogServices, serviceType]
  );

  /** Minutes reserved for slot search — matches catalog when possible. */
  const selectedServiceDurationForSchedule = useMemo(() => {
    if (!serviceType) return 0;
    if (serviceType === MANAGER_OTHER_SERVICE_VALUE) return 60;
    const row = catalogServices.find((s) => s.service_name === serviceType);
    if (row?.service_code === REPAIR_OTHER_SERVICE_CODE) return 60;
    const d = row?.default_duration_minutes;
    if (d != null && d > 0) return d;
    return 60;
  }, [serviceType, catalogServices]);

  const canShowScheduler =
    Boolean(serviceType) &&
    selectedServiceDurationForSchedule > 0 &&
    Boolean(serviceAddress.trim()) &&
    Boolean(serviceCity.trim()) &&
    Boolean(serviceState.trim()) &&
    Boolean(serviceZip.trim());

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

  const selectedScheduleSlot =
    slots.find((slot) => getSlotKey(slot) === selectedSlotKey) ?? null;

  const loadManagerScheduleSlots = useCallback(async () => {
    if (!canShowScheduler) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setScheduleLoadError("");

    try {
      const { start, end } = getSchedulerDateRange();
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
        p_service_duration_minutes: selectedServiceDurationForSchedule,
        p_service_city: serviceCity.trim() || null,
        p_service_state: serviceState.trim() || null,
        p_service_zip: serviceZip.trim() || null,
        p_default_travel_time_minutes: dispatchTravelMinutes,
      });

      if (!error) {
        setSlots((data || []) as AvailableSlot[]);
        return;
      }

      console.warn("Manager scheduler RPC fallback:", error);

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
          selectedServiceDurationForSchedule +
            PRE_SERVICE_STAGING_MINUTES +
            (dispatchTravelMinutes ?? 30),
          dispatchTravelMinutes ?? 30,
        ),
      );
    } catch (err) {
      console.error("Manager schedule slots failed:", err);
      setScheduleLoadError(
        "Could not load available times. Confirm the scheduler migration is applied and technicians have availability blocks.",
      );
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [
    canShowScheduler,
    selectedServiceDurationForSchedule,
    serviceAddress,
    serviceCity,
    serviceState,
    serviceZip,
  ]);

  const showManagerLaborParts =
    serviceType === MANAGER_OTHER_SERVICE_VALUE ||
    selectedCatalogRow?.service_code === REPAIR_OTHER_SERVICE_CODE;

  const otherLaborHoursParsed = useMemo(
    () => parseOptionalDecimal(otherLaborHours),
    [otherLaborHours]
  );

  const computedLaborSell = useMemo(() => {
    if (otherLaborHoursParsed == null) return null;
    return laborSellTotalFromHours(otherLaborHoursParsed);
  }, [otherLaborHoursParsed]);

  const laborCostAsOfYmd = useMemo(() => {
    const t = requestedDate.trim();
    if (t) return t;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [requestedDate]);

  const computedLaborCost = useMemo(() => {
    if (otherLaborHoursParsed == null) return null;
    return laborShopCostFromHours(otherLaborHoursParsed, assignedTechHourlyPay);
  }, [otherLaborHoursParsed, assignedTechHourlyPay]);

  useEffect(() => {
    if (!assignedTechId) {
      setAssignedTechHourlyPay(null);
      setAssignedTechPayEffectiveYmd(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const row = await getTechnicianHourlyPayAsOf(
        supabase,
        assignedTechId,
        laborCostAsOfYmd
      );
      if (cancelled) return;
      setAssignedTechHourlyPay(row?.hourly_pay ?? null);
      setAssignedTechPayEffectiveYmd(row?.effective_date ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [assignedTechId, laborCostAsOfYmd]);

  useEffect(() => {
    if (loading || !authorized) return;
    if (!canShowScheduler) {
      setSlots([]);
      setSelectedSlotKey("");
      return;
    }
    setSelectedSlotKey("");
    void loadManagerScheduleSlots();
  }, [loading, authorized, canShowScheduler, loadManagerScheduleSlots]);

  useEffect(() => {
    if (!selectedScheduleSlot) return;
    setAssignedTechId(selectedScheduleSlot.technician_user_id);
    setRequestedDate(toDateKey(new Date(selectedScheduleSlot.starts_at)));
  }, [selectedScheduleSlot]);

  useEffect(() => {
    const checkAccess = async () => {
      const { user, roles } = await getUserRoles();
      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roles, "manager")) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      setCurrentUserId(user.id);
      setAuthorized(true);

       const [
          { data: customersData, error: customersError },
          { data: vehiclesData, error: vehiclesError },
          { data: rolesData, error: rolesError },
          { data: catalogData, error: catalogError },
        ] = await Promise.all([
            supabase
              .from("customers")
              .select("id, first_name, last_name, email, phone")
              .order("last_name", { ascending: true })
              .order("first_name", { ascending: true }),

            supabase
              .from("vehicles")
              .select("id, customer_id, year, make, model, engine_size, license_plate, vin")
              .order("year", { ascending: false }),

            supabase
              .from("user_roles")
              .select("user_id, role")
              .eq("role", "technician"),

            supabase
              .from("service_catalog")
              .select(
                "id, service_name, service_description, is_bookable_online, category, sort_order, service_code, default_duration_minutes"
              )
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
              .order("service_name", { ascending: true }),
          ]);

        if (customersError) throw customersError;
        if (vehiclesError) throw vehiclesError;
        if (rolesError) throw rolesError;
        if (catalogError) {
          console.error("Service catalog load failed:", catalogError);
        }

        const catalogRows = (catalogData ?? []) as CatalogServiceRow[];
        setCatalogServices(
          catalogRows.length > 0 ? catalogRows : FALLBACK_SERVICE_CATALOG
        );
        if (catalogRows.length === 0 && !catalogError) {
          console.warn(
            "Service catalog returned no active rows; using fallback list."
          );
        }

        setCustomers(customersData ?? []);
        setVehicles(vehiclesData ?? []);

        const technicianIds = (rolesData ?? []).map((row) => row.user_id);

          if (technicianIds.length > 0) {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, email")
              .in("id", technicianIds);

            if (profileError) throw profileError;

            const technicianList = (profileData ?? [])
              .map((profile) => ({
                id: profile.id,
                first_name: profile.first_name ?? null,
                last_name: profile.last_name ?? null,
                email: profile.email ?? null,
              }))
              .sort((a, b) => {
                const aName =
                  `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || "";
                const bName =
                  `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email || "";
                return aName.localeCompare(bName);
              });

            setTechnicians(technicianList);
          }

      setLoading(false);
    };

    checkAccess();
  }, []);

  useEffect(() => {
    if (loading || !authorized) return;
    if (flow !== "returning" || returningPickerOpenedRef.current) return;
    returningPickerOpenedRef.current = true;
    setCustomerOpen(true);
  }, [loading, authorized, flow]);

  useEffect(() => {
    if (!newCustomerErrors.name && !newCustomerErrors.email && !newCustomerErrors.phone) {
      return;
    }
    const focusId = newCustomerErrors.name
      ? "new-cust-first"
      : newCustomerErrors.email
        ? "new-cust-email"
        : "new-cust-phone";
    const el = document.getElementById(focusId);
    if (el && typeof (el as HTMLElement).focus === "function") {
      (el as HTMLElement).focus();
    }
  }, [newCustomerErrors]);

  const handleCreateCustomer = async () => {
    setNewCustomerErrors({});

    const first = newCustomerFirst.trim();
    const last = newCustomerLast.trim();
    if (!first && !last) {
      setNewCustomerErrors({
        name: "Enter at least a first or last name.",
      });
      return;
    }

    const emailNorm = normalizeEmail(newCustomerEmail);
    if (!emailNorm) {
      setNewCustomerErrors({
        email: "Email is required. We use it to spot repeat customers and match portal accounts.",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      setNewCustomerErrors({
        email: "Enter a valid email (example: name@company.com).",
      });
      return;
    }

    const phoneDigits = newCustomerPhone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setNewCustomerErrors({
        phone: "Enter a complete 10-digit U.S. phone number.",
      });
      return;
    }
    const phoneFormatted = formatPhoneNumber(phoneDigits);

    setCreatingCustomer(true);
    try {
      const { data: existingByEmail, error: dupError } = await supabase
        .from("customers")
        .select("id")
        .eq("email", emailNorm)
        .maybeSingle();

      if (dupError) throw dupError;
      if (existingByEmail?.id) {
        setNewCustomerErrors({
          email:
            "This email is already on file. Use Returning customer from Jobs and search, or use a different email.",
        });
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: first || null,
          last_name: last || null,
          phone: phoneFormatted,
          email: emailNorm,
          tax_exempt: false,
        })
        .select("id, first_name, last_name, email, phone")
        .single();

      if (error) throw error;

      const row = data as Customer;
      setCustomers((prev) =>
        [...prev, row].sort((a, b) => {
          const an = `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim();
          const bn = `${b.last_name ?? ""} ${b.first_name ?? ""}`.trim();
          return an.localeCompare(bn);
        })
      );
      setSelectedCustomerId(row.id);
      setSelectedVehicleId("");
      setNewCustomerFirst("");
      setNewCustomerLast("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerErrors({});
      setCustomerOpen(false);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not create customer.";
      if (/email|unique|duplicate/i.test(msg)) {
        setNewCustomerErrors({ email: msg });
      } else {
        alert(msg);
      }
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleAddVehicleForCustomer = async () => {
    if (!selectedCustomerId) return;

    if (
      !newVehicleMake.trim() &&
      !newVehicleModel.trim() &&
      !newVehicleVin.trim()
    ) {
      alert("Please enter at least basic vehicle information (make, model, or VIN).");
      return;
    }

    setAddingVehicle(true);
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .insert({
          customer_id: selectedCustomerId,
          year: newVehicleYear.trim() || null,
          make: newVehicleMake.trim() || null,
          model: newVehicleModel.trim() || null,
          engine_size: newVehicleEngineSize.trim() || null,
          license_plate: normalizeLicensePlate(newVehiclePlate) || null,
          vin: normalizeVin(newVehicleVin) || null,
        })
        .select(
          "id, customer_id, year, make, model, engine_size, license_plate, vin"
        )
        .single();

      if (error) throw error;

      setVehicles((prev) => [...prev, data]);
      setSelectedVehicleId(data.id);
      setNewVehicleYear("");
      setNewVehicleMake("");
      setNewVehicleModel("");
      setNewVehicleEngineSize("");
      setNewVehiclePlate("");
      setNewVehicleVin("");
      setUseCustomMake(false);
      setUseCustomModel(false);
      setUseCustomEngineSize(false);
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error ? err.message : "Could not save the vehicle."
      );
    } finally {
      setAddingVehicle(false);
    }
  };

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/manager/jobs")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Create shop job
              </h1>
              <p className="text-slate-600">
                Internal job entry (not created by the customer scheduling portal). Customer online bookings still appear as jobs with source &quot;Customer portal&quot;.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button
              type="submit"
              form="new-job-form"
              disabled={saving}
              className={headerActionButtonClassName}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

        {flow === "new" || flow === "returning" ? (
          <div className="rounded-xl border border-lime-400/35 bg-lime-400/10 px-4 py-3 text-sm text-slate-800">
            {flow === "new" ? (
              <>
                <span className="font-semibold text-slate-900">New customer path: </span>
                Add the person below, then choose a vehicle and complete the job.
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-900">Returning customer: </span>
                The customer search should be open—pick someone on file, then their vehicle.
              </>
            )}
          </div>
        ) : null}

        {flow === "new" ? (
          <Card>
            <CardHeader>
              <CardTitle>Step 1 — Add customer</CardTitle>
              <p className="text-sm font-normal text-slate-600">
                Email is required and must be unique—it is how we catch repeat customers. Phone is saved as a
                standard 10-digit U.S. format.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="new-cust-first"
                  className={cn(newCustomerErrors.name && "font-semibold text-red-700")}
                >
                  First name
                </Label>
                <Input
                  id="new-cust-first"
                  value={newCustomerFirst}
                  onChange={(e) => {
                    setNewCustomerFirst(e.target.value);
                    if (newCustomerErrors.name) {
                      setNewCustomerErrors((prev) => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }
                  }}
                  placeholder="First name"
                  autoComplete="given-name"
                  aria-invalid={Boolean(newCustomerErrors.name)}
                  className={cn(
                    "h-11 bg-white text-slate-950",
                    newCustomerErrors.name && newCustomerInputErrorClass
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="new-cust-last"
                  className={cn(newCustomerErrors.name && "font-semibold text-red-700")}
                >
                  Last name
                </Label>
                <Input
                  id="new-cust-last"
                  value={newCustomerLast}
                  onChange={(e) => {
                    setNewCustomerLast(e.target.value);
                    if (newCustomerErrors.name) {
                      setNewCustomerErrors((prev) => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }
                  }}
                  placeholder="Last name"
                  autoComplete="family-name"
                  aria-invalid={Boolean(newCustomerErrors.name)}
                  className={cn(
                    "h-11 bg-white text-slate-950",
                    newCustomerErrors.name && newCustomerInputErrorClass
                  )}
                />
              </div>
              {newCustomerErrors.name ? (
                <p className="text-sm font-medium text-red-600 md:col-span-2" role="alert">
                  {newCustomerErrors.name}
                </p>
              ) : null}
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="new-cust-email"
                  className={cn(newCustomerErrors.email && "font-semibold text-red-700")}
                >
                  Email <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="new-cust-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={newCustomerEmail}
                  onChange={(e) => {
                    setNewCustomerEmail(e.target.value);
                    if (newCustomerErrors.email) {
                      setNewCustomerErrors((prev) => {
                        const next = { ...prev };
                        delete next.email;
                        return next;
                      });
                    }
                  }}
                  placeholder="name@example.com"
                  aria-invalid={Boolean(newCustomerErrors.email)}
                  className={cn(
                    "h-11 max-w-lg bg-white text-slate-950",
                    newCustomerErrors.email && newCustomerInputErrorClass
                  )}
                />
                {newCustomerErrors.email ? (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    {newCustomerErrors.email}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    If this email already exists, use <strong>Returning customer</strong> from Jobs instead.
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="new-cust-phone"
                  className={cn(newCustomerErrors.phone && "font-semibold text-red-700")}
                >
                  Phone <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="new-cust-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={newCustomerPhone}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setNewCustomerPhoneFormatHint(getPhoneInputWarning(raw));
                    setNewCustomerPhone(formatPhoneNumber(raw));
                    if (newCustomerErrors.phone) {
                      setNewCustomerErrors((prev) => {
                        const next = { ...prev };
                        delete next.phone;
                        return next;
                      });
                    }
                  }}
                  placeholder="(555) 555-5555"
                  aria-invalid={Boolean(newCustomerErrors.phone)}
                  className={cn(
                    "h-11 max-w-xs bg-white font-mono text-slate-950 tracking-wide",
                    newCustomerErrors.phone && newCustomerInputErrorClass
                  )}
                />
                {newCustomerErrors.phone ? (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    {newCustomerErrors.phone}
                  </p>
                ) : newCustomerPhoneFormatHint ? (
                  <p className="text-xs text-amber-800">{newCustomerPhoneFormatHint}</p>
                ) : (
                  <p className="text-xs text-slate-500">10 digits; formatting applies as you type.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  disabled={creatingCustomer}
                  onClick={() => void handleCreateCustomer()}
                  className={headerActionButtonClassName}
                >
                  {creatingCustomer ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Save customer and continue
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

          <form
            id="new-job-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);

              try {
                if (!selectedCustomerId) {
                  alert("Please select a customer.");
                  return;
                }

                if (!selectedVehicleId || selectedVehicleId === MANAGER_OTHER_VEHICLE_VALUE) {
                  alert(
                    selectedVehicleId === MANAGER_OTHER_VEHICLE_VALUE
                      ? "Save the new vehicle using “Add vehicle for this customer” below, or pick an existing vehicle from the list."
                      : selectedCustomerId && filteredVehicles.length === 0
                      ? "Add a vehicle for this customer using the form (same catalog as Customer page), then click “Add vehicle for this customer” before creating the job."
                      : "Please select a vehicle."
                  );
                  return;
                }

                if (!serviceType) {
                  alert("Please select a service type.");
                  return;
                }

                const resolvedServiceType =
                  serviceType === MANAGER_OTHER_SERVICE_VALUE
                    ? "Other"
                    : serviceType;

                const catalogRowForSubmit = catalogServices.find(
                  (s) => s.service_name === serviceType
                );

                const isOtherOrRepairFlow =
                  serviceType === MANAGER_OTHER_SERVICE_VALUE ||
                  catalogRowForSubmit?.service_code === REPAIR_OTHER_SERVICE_CODE;

                if (isOtherOrRepairFlow && !serviceDescription.trim()) {
                  alert("Please describe the service needed.");
                  return;
                }

                const jobPayload: Record<string, unknown> = {
                  customer_id: selectedCustomerId,
                  vehicle_id: selectedVehicleId,
                  service_type: resolvedServiceType,
                  priority,
                  service_description: serviceDescription || null,
                  notes: notes || null,
                  status: "new",
                  source: "manual",
                  created_by_user_id: currentUserId,
                };

                if (selectedScheduleSlot) {
                  jobPayload.requested_date = toDateKey(
                    new Date(selectedScheduleSlot.starts_at),
                  );
                  jobPayload.scheduled_start = selectedScheduleSlot.starts_at;
                  jobPayload.scheduled_end = selectedScheduleSlot.ends_at;
                  jobPayload.assigned_tech_user_id =
                    selectedScheduleSlot.technician_user_id;
                  jobPayload.service_duration_minutes =
                    selectedServiceDurationForSchedule;
                  jobPayload.travel_time_minutes =
                    selectedScheduleSlot.travel_time_minutes ?? 30;
                  jobPayload.service_address = serviceAddress.trim() || null;
                  jobPayload.service_city = serviceCity.trim() || null;
                  jobPayload.service_state = serviceState.trim() || null;
                  jobPayload.service_zip = serviceZip.trim() || null;
                } else {
                  jobPayload.requested_date = requestedDate || null;
                  if (assignedTechId) {
                    jobPayload.assigned_tech_user_id = assignedTechId;
                  }
                }

                const { data: insertedJob, error: insertError } = await supabase
                  .from("jobs")
                  .insert(jobPayload)
                  .select("id")
                  .single();

                if (insertError) {
                  console.error(insertError);
                  alert(`Failed to create job: ${insertError.message}`);
                  return;
                }

                if (isOtherOrRepairFlow && serviceDescription.trim()) {
                  const { data: insertedService, error: jobServiceError } =
                    await supabase
                      .from("job_services")
                      .insert({
                        job_id: insertedJob.id,
                        service_code:
                          serviceType === MANAGER_OTHER_SERVICE_VALUE
                            ? null
                            : catalogRowForSubmit?.service_code ?? null,
                        service_name:
                          serviceType === MANAGER_OTHER_SERVICE_VALUE
                            ? "Other"
                            : serviceType,
                        service_description: serviceDescription.trim(),
                        estimated_hours: otherLaborHoursParsed,
                        estimated_price: computedLaborSell,
                        estimated_cost: computedLaborCost,
                        sort_order: 0,
                      })
                      .select("id")
                      .single();

                  if (jobServiceError) {
                    console.error(jobServiceError);
                    alert(
                      `Job was created, but saving labor line failed: ${jobServiceError.message}`
                    );
                  } else if (otherPartName.trim() && insertedService?.id) {
                    const qty = parseOptionalDecimal(otherPartQty) ?? 1;
                    const { error: partError } = await supabase
                      .from("job_parts")
                      .insert({
                        job_id: insertedJob.id,
                        job_service_id: insertedService.id,
                        part_name: otherPartName.trim(),
                        quantity: qty > 0 ? qty : 1,
                        unit_cost: parseOptionalDecimal(otherPartUnitCost),
                        unit_price: resolvePartUnitPriceForSave(
                          otherPartUnitCost,
                          otherPartUnitPrice,
                        ),
                      });

                    if (partError) {
                      console.error(partError);
                      alert(
                        `Job was created, but saving the part line failed: ${partError.message}`
                      );
                    }
                  }
                }

                router.push(`/manager/jobs/${insertedJob.id}`);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
              </CardHeader>

          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>

              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className={managerDarkFieldTriggerClassName}
                  >
                    {selectedCustomerId
                      ? (() => {
                          const customer = customers.find((c) => c.id === selectedCustomerId);
                          if (!customer) return "Select customer";

                          const name =
                            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                            "Unnamed customer";
                          const detail = customer.phone || customer.email || "";

                          return detail ? `${name} - ${detail}` : name;
                        })()
                      : "Select customer"}

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#7f9988]" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[420px] border border-[rgba(115,145,126,0.35)] bg-[#121b14] p-0 text-[#f3fff4] shadow-lg"
                  align="start"
                >
                  <Command
                    className={cn(
                      "!bg-[#121b14] !text-[#f3fff4]",
                      "[&_[data-slot=command-input-wrapper]]:border-[rgba(115,145,126,0.35)]",
                      "[&_[data-slot=command-input-wrapper]_svg]:text-[#7f9988]"
                    )}
                  >
                    <CommandInput
                      placeholder="Search customer..."
                      className="text-[#f3fff4] placeholder:text-[#7f9988]"
                    />
                    <CommandList>
                      <CommandEmpty className="text-[#7f9988]">
                        No customer found.
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => {
                          const name =
                            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                            "Unnamed customer";
                          const detail = customer.phone || customer.email || "";
                          const label = detail ? `${name} - ${detail}` : name;

                          return (
                            <CommandItem
                              key={customer.id}
                              value={`${name} ${customer.email ?? ""} ${customer.phone ?? ""}`}
                              className="text-[#f3fff4] data-[selected=true]:!bg-[rgba(57,255,20,0.16)] data-[selected=true]:!text-[#f3fff4]"
                              onSelect={() => {
                                setSelectedCustomerId(customer.id);
                                setSelectedVehicleId("");
                                setNewVehicleYear("");
                                setNewVehicleMake("");
                                setNewVehicleModel("");
                                setNewVehicleEngineSize("");
                                setNewVehiclePlate("");
                                setNewVehicleVin("");
                                setUseCustomMake(false);
                                setUseCustomModel(false);
                                setUseCustomEngineSize(false);
                                setCustomerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Vehicle</Label>
              {!selectedCustomerId ? (
                <div
                  className={cn(
                    "flex h-8 w-full items-center rounded-lg border px-2.5 text-sm text-[#7f9988]",
                    "border-[rgba(115,145,126,0.35)] bg-[#121b14]/50"
                  )}
                >
                  Select customer first
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="space-y-4 rounded-lg border border-dashed border-[rgba(115,145,126,0.45)] bg-[#0d160f]/50 p-4">
                  <p className="text-sm text-slate-400">
                    No vehicles on file for this customer. Use the searchable year,
                    make, model, and engine lists (same catalog as on the customer
                    vehicle form), then save the vehicle before creating the job.
                  </p>
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
                    makeListId="new-job-vehicle-makes"
                    modelListId="new-job-vehicle-models"
                    engineListId="new-job-vehicle-engine-sizes"
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                    showLicensePlateHint={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      managerDarkFieldTriggerClassName,
                      "w-full sm:w-auto"
                    )}
                    disabled={addingVehicle}
                    onClick={() => void handleAddVehicleForCustomer()}
                  >
                    {addingVehicle ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving vehicle…
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add vehicle for this customer
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Select
                    value={selectedVehicleId}
                    onValueChange={setSelectedVehicleId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVehicles.map((vehicle) => {
                        const label = [
                          vehicle.year,
                          vehicle.make,
                          vehicle.model,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        const display =
                          label || vehicle.license_plate || "Unnamed vehicle";

                        return (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.license_plate
                              ? `${display} - ${vehicle.license_plate}`
                              : display}
                          </SelectItem>
                        );
                      })}
                      <SelectItem value={MANAGER_OTHER_VEHICLE_VALUE}>
                        Other — add a vehicle not in this list
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedVehicleId === MANAGER_OTHER_VEHICLE_VALUE ? (
                    <div className="space-y-4 rounded-lg border border-dashed border-[rgba(115,145,126,0.45)] bg-[#0d160f]/50 p-4">
                      <p className="text-sm text-slate-400">
                        Enter year, make, model, and VIN or plate, then save. The vehicle is
                        added to this customer and selected for the job.
                      </p>
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
                        makeListId="new-job-vehicle-makes-other"
                        modelListId="new-job-vehicle-models-other"
                        engineListId="new-job-vehicle-engine-sizes-other"
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                        showLicensePlateHint={false}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          managerDarkFieldTriggerClassName,
                          "w-full sm:w-auto"
                        )}
                        disabled={addingVehicle}
                        onClick={() => void handleAddVehicleForCustomer()}
                      >
                        {addingVehicle ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving vehicle…
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Add vehicle for this customer
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Service Type</Label>
              <p className="text-xs text-slate-500">
                Active services from the catalog, including shop-only items not
                shown on the customer booking portal.
              </p>
              <Select
                value={serviceType}
                onValueChange={(value) => {
                  setServiceType(value);
                  if (value === MANAGER_OTHER_SERVICE_VALUE) {
                    setServiceDescription("");
                    setOtherLaborHours("");
                    setOtherPartName("");
                    setOtherPartQty("1");
                    setOtherPartUnitCost("");
                    setOtherPartUnitPrice("");
                    return;
                  }
                  const row = catalogServices.find(
                    (s) => s.service_name === value
                  );
                  const nextDesc = row?.service_description?.trim() ?? "";
                  setServiceDescription(nextDesc);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {catalogServices.map((svc) => (
                    <SelectItem key={svc.id} value={svc.service_name}>
                      {svc.service_name}
                      {!svc.is_bookable_online ? " (shop only)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={MANAGER_OTHER_SERVICE_VALUE}>
                    Other — describe below (labor and parts)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Service Description</Label>
              <Textarea
                placeholder={
                  showManagerLaborParts
                    ? "Describe the service needed (required for Other / repair requests)…"
                    : "Describe the requested work…"
                }
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
              />
            </div>

            {showManagerLaborParts ? (
              <div className="space-y-4 md:col-span-2 rounded-lg border border-[rgba(115,145,126,0.35)] bg-[#0d160f]/40 p-4">
                <div className="text-sm font-medium text-[#f3fff4]">
                  Labor (shop)
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[#c5dcc9]">Est. labor hours</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                      value={otherLaborHours}
                      onChange={(e) => setOtherLaborHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 rounded-lg border border-[rgba(115,145,126,0.25)] bg-[#121b14]/60 p-3 text-sm text-[#c5dcc9]">
                    <div className="font-medium text-[#f3fff4]">Labor dollars (auto)</div>
                    <p className="text-xs leading-relaxed text-[#7f9988]">
                      <span className="text-[#c5dcc9]">Customer labor total</span> uses the catalog sell rule (
                      {LABOR_SELL_USD_PER_HOUR}/hr × hours).{" "}
                      <span className="text-[#c5dcc9]">Shop labor cost</span> uses the assigned technician&apos;s
                      hourly pay (Employees list) effective on{" "}
                      {laborCostAsOfYmd}
                      {assignedTechHourlyPay != null
                        ? ` — $${assignedTechHourlyPay.toFixed(2)}/hr from ${assignedTechPayEffectiveYmd ?? "—"}.`
                        : assignedTechId
                          ? ` — no rate on file; using default $${LABOR_COST_USD_PER_HOUR}/hr.`
                          : ` — no technician assigned; using default $${LABOR_COST_USD_PER_HOUR}/hr.`}
                    </p>
                    <div className="mt-2 space-y-1 font-mono text-[#f3fff4]">
                      <div>
                        Customer total (est.):{" "}
                        {computedLaborSell != null ? `$${computedLaborSell.toFixed(2)}` : "—"}
                      </div>
                      <div>
                        Shop cost (est.):{" "}
                        {computedLaborCost != null ? `$${computedLaborCost.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-sm font-medium text-[#f3fff4]">
                  Parts (optional)
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[#c5dcc9]">Part name</Label>
                    <Input
                      className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                      value={otherPartName}
                      onChange={(e) => setOtherPartName(e.target.value)}
                      placeholder="e.g. filter, belt…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#c5dcc9]">Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                      value={otherPartQty}
                      onChange={(e) => setOtherPartQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#c5dcc9]">Unit cost</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                      value={otherPartUnitCost}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOtherPartUnitCost(v);
                        const n = Number(v);
                        if (v.trim() !== "" && Number.isFinite(n) && n > 0) {
                          const p = unitSellPriceFromUnitCost(n);
                          if (p != null) {
                            setOtherPartUnitPrice(formatSellPriceForPartInput(p));
                          }
                        } else if (v.trim() === "") {
                          setOtherPartUnitPrice("");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#c5dcc9]">Unit price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                      value={otherPartUnitPrice}
                      onChange={(e) => setOtherPartUnitPrice(e.target.value)}
                    />
                    <p className="text-xs text-[#7f9988]">
                      Filled from cost (rule v{PART_UNIT_SELL_RULE.version}): min $
                      {PART_UNIT_SELL_RULE.minSellUnitPrice} sell. Cost ≤$
                      {PART_UNIT_SELL_RULE.costBlendStartUsd}: ×
                      {PART_UNIT_SELL_RULE.multiplierBelowBlendUsd}. From $
                      {PART_UNIT_SELL_RULE.costBlendStartUsd} to $
                      {PART_UNIT_SELL_RULE.costBlendEndUsd}, multiplier ramps smoothly to ×
                      {PART_UNIT_SELL_RULE.multiplierEndBlendUsd} (no price dip at $50.01). Above $
                      {PART_UNIT_SELL_RULE.costBlendEndUsd}: ×
                      {PART_UNIT_SELL_RULE.multiplierAboveBlendUsd}. You can still edit price.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-4 md:col-span-2">
              <div className="flex flex-col gap-2 border-b border-[rgba(115,145,126,0.25)] pb-2">
                <div className="inline-flex items-center gap-2 text-[#c5dcc9]">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Schedule on calendar
                  </span>
                </div>
                <p className="text-sm text-[#7f9988]">
                  Uses the same availability rules as the customer scheduler. Enter the service address, then
                  pick a slot or leave unscheduled and set the date and tech manually below.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[#c5dcc9]">Service street address</Label>
                  <Input
                    className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    placeholder="123 Main St"
                    autoComplete="street-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#c5dcc9]">City</Label>
                  <Input
                    className="border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                    value={serviceCity}
                    onChange={(e) => setServiceCity(e.target.value)}
                    placeholder="Pocatello"
                    autoComplete="address-level2"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#c5dcc9]">State</Label>
                  <UsStateSelect
                    className="h-8 w-full rounded-lg border border-[rgba(115,145,126,0.35)] bg-[#121b14] px-2.5 text-sm text-[#f3fff4]"
                    value={serviceState}
                    onChange={setServiceState}
                    autoComplete="address-level1"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[#c5dcc9]">ZIP</Label>
                  <Input
                    className="max-w-xs border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]"
                    value={serviceZip}
                    onChange={(e) => setServiceZip(e.target.value)}
                    placeholder="83202"
                    autoComplete="postal-code"
                  />
                </div>
              </div>

              {!canShowScheduler ? (
                <p className="text-sm text-[#7f9988]">
                  Choose a service type and complete address (street, city, state, ZIP) to load open times for
                  the next 21 days ({selectedServiceDurationForSchedule || "—"} min job window from the
                  catalog).
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-[#f3fff4]">
                      <CalendarDays className="h-4 w-4 text-[#7f9988]" />
                      <span className="text-sm font-medium">Next 21 days</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          managerDarkFieldTriggerClassName,
                          "h-9 w-auto px-3",
                        )}
                        onClick={() => void loadManagerScheduleSlots()}
                        disabled={loadingSlots}
                      >
                        {loadingSlots ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Refresh times
                      </Button>
                      {selectedSlotKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 text-[#c5dcc9] hover:text-[#f3fff4]"
                          onClick={() => {
                            setSelectedSlotKey("");
                            setAssignedTechId("");
                          }}
                        >
                          Clear slot
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {scheduleLoadError ? (
                    <p className="text-sm font-medium text-red-400" role="alert">
                      {scheduleLoadError}
                    </p>
                  ) : null}
                  {travelLookupDebug ? (
                    <p className="text-xs text-[#7f9988]">{travelLookupDebug}</p>
                  ) : null}

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
                          className={cn(
                            "min-h-20 rounded-lg border p-2 text-left text-sm transition",
                            isSelected
                              ? "border-lime-500/80 bg-[rgba(57,255,20,0.12)]"
                              : "border-[rgba(115,145,126,0.35)] bg-[#0d160f] hover:border-lime-400/50",
                          )}
                        >
                          <div className="font-medium text-[#f3fff4]">{formatDayLabel(dateKey)}</div>
                          <div className="mt-2 text-xs font-semibold text-[#7f9988]">
                            {daySlots.length} slot{daySlots.length === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-[rgba(115,145,126,0.35)] bg-[#0d160f]/80 p-4">
                    <div className="flex items-center gap-2 text-[#f3fff4]">
                      <Clock className="h-4 w-4 text-[#7f9988]" />
                      <span className="font-medium">{formatDayLabel(selectedDateKey)}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedDateSlots.map((slot) => {
                        const slotKey = getSlotKey(slot);
                        const isSelected = slotKey === selectedSlotKey;
                        const techLabel = (() => {
                          const t = technicians.find((x) => x.id === slot.technician_user_id);
                          const name = `${t?.first_name ?? ""} ${t?.last_name ?? ""}`.trim();
                          return name || t?.email || "Technician";
                        })();

                        return (
                          <button
                            key={slotKey}
                            type="button"
                            onClick={() => setSelectedSlotKey(slotKey)}
                            className={cn(
                              "rounded-lg border p-3 text-left text-sm transition",
                              isSelected
                                ? "border-lime-500/90 bg-[rgba(57,255,20,0.18)] text-[#f3fff4]"
                                : "border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4] hover:border-lime-400/45",
                            )}
                          >
                            <div className="font-semibold">{formatSlotTime(slot)}</div>
                            <div className="mt-1 text-xs text-[#c5dcc9]">{techLabel}</div>
                            <div className="mt-1 text-xs text-[#7f9988]">
                              ~{slot.travel_time_minutes ?? 30} min travel buffer
                            </div>
                          </button>
                        );
                      })}
                      {selectedDateSlots.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[rgba(115,145,126,0.4)] p-4 text-sm text-[#7f9988] sm:col-span-2 lg:col-span-3">
                          {loadingSlots
                            ? "Loading slots…"
                            : "No open times this day. Try another day or refresh."}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selectedSlotKey ? (
                    <p className="text-sm text-[#7f9988]">
                      Requested date and assigned technician below follow this slot. Use{" "}
                      <button
                        type="button"
                        className="font-medium text-lime-300 underline underline-offset-2"
                        onClick={() => {
                          setSelectedSlotKey("");
                          setAssignedTechId("");
                        }}
                      >
                        Clear slot
                      </button>{" "}
                      to pick a tech or date manually instead.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Requested Date</Label>
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                disabled={Boolean(selectedSlotKey)}
                title={
                  selectedSlotKey
                    ? "Clear the selected calendar slot to edit the date manually."
                    : undefined
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Assigned Technician</Label>
              <Select
                value={assignedTechId}
                onValueChange={setAssignedTechId}
                disabled={Boolean(selectedSlotKey)}
              >
                <SelectTrigger
                  disabled={Boolean(selectedSlotKey)}
                  title={
                    selectedSlotKey
                      ? "Clear the selected calendar slot to assign a different technician."
                      : undefined
                  }
                >
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => {
                    const techName =
                      `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() ||
                      tech.email ||
                      "Unnamed technician";

                    return (
                      <SelectItem key={tech.id} value={tech.id}>
                        {techName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
      }
    >
      <NewJobPageContent />
    </Suspense>
  );
}
