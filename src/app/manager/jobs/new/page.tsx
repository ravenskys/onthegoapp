"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, ArrowLeft, Save } from "lucide-react";

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
import { getPostLoginRoute, getUserRoles, hasAnyRole } from "@/lib/portal-auth";
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
  year: number | null;
  make: string | null;
  model: string | null;
  license_plate: string | null;
};

type Technician = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const SERVICE_TYPE_DESCRIPTIONS: Record<string, string> = {
  "Oil Change":
    "Perform engine oil and oil filter service. Inspect visible fluids and basic maintenance items during visit.",
  Inspection:
    "Perform inspection, document findings, and provide recommended services based on condition observed.",
  "Oil Change + Inspection":
    "Perform engine oil and oil filter service, complete vehicle inspection, document findings, and provide recommended services based on condition observed.",
};

export default function NewJobPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [serviceType, setServiceType] = useState("");
  const [priority, setPriority] = useState("normal");
  const [serviceDescription, setServiceDescription] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [assignedTechId, setAssignedTechId] = useState("");
  const [notes, setNotes] = useState("");

  const [customerOpen, setCustomerOpen] = useState(false);

  const filteredVehicles = vehicles.filter(
      (vehicle) => vehicle.customer_id === selectedCustomerId
    );

  useEffect(() => {
    const checkAccess = async () => {
      const { user, roles } = await getUserRoles();
      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasAnyRole(roles, ["manager", "admin"])) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      setAuthorized(true);

       const [{ data: customersData, error: customersError }, { data: vehiclesData, error: vehiclesError }, { data: rolesData, error: rolesError }] =
          await Promise.all([
            supabase
              .from("customers")
              .select("id, first_name, last_name, email, phone")
              .order("last_name", { ascending: true })
              .order("first_name", { ascending: true }),

            supabase
              .from("vehicles")
              .select("id, customer_id, year, make, model, license_plate")
              .order("year", { ascending: false }),

            supabase
              .from("user_roles")
              .select("user_id, role")
              .eq("role", "technician"),
          ]);

        if (customersError) throw customersError;
        if (vehiclesError) throw vehiclesError;
        if (rolesError) throw rolesError;

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

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell min-h-screen bg-slate-50 p-6">
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
                Create New Job
              </h1>
              <p className="text-slate-600">
                Set up a new service job for a customer and vehicle.
              </p>
            </div>
          </div>

          <Button type="submit" form="new-job-form" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Creating..." : "Create Job"}
          </Button>
        </div>

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

                if (!selectedVehicleId) {
                  alert("Please select a vehicle.");
                  return;
                }

                if (!serviceType) {
                  alert("Please select a service type.");
                  return;
                }

                const jobPayload: Record<string, unknown> = {
                  customer_id: selectedCustomerId,
                  vehicle_id: selectedVehicleId,
                  service_type: serviceType,
                  priority,
                  service_description: serviceDescription || null,
                  requested_date: requestedDate || null,
                  notes: notes || null,
                  status: "new",
                };

                if (assignedTechId) {
                  jobPayload.assigned_tech_user_id = assignedTechId;
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
                    className="w-full justify-between font-normal"
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

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
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
                              onSelect={() => {
                                setSelectedCustomerId(customer.id);
                                setSelectedVehicleId("");
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
              <Select
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
                disabled={!selectedCustomerId || filteredVehicles.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedCustomerId
                        ? "Select customer first"
                        : filteredVehicles.length === 0
                          ? "No vehicles found"
                          : "Select vehicle"
                    }
                  />
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
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select
                value={serviceType}
                onValueChange={(value) => {
                  setServiceType(value);

                  if (value === "Repair / Other") {
                    setServiceDescription("");
                    return;
                  }

                  const defaultDescription = SERVICE_TYPE_DESCRIPTIONS[value];
                  if (defaultDescription) {
                    setServiceDescription(defaultDescription);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Oil Change">Oil Change</SelectItem>
                  <SelectItem value="Inspection">Inspection</SelectItem>
                  <SelectItem value="Oil Change + Inspection">Oil Change + Inspection</SelectItem>
                  <SelectItem value="Repair / Other">Repair / Other</SelectItem>
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
                placeholder="Describe the requested work..."
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Requested Date</Label>
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assigned Technician</Label>
              <Select value={assignedTechId} onValueChange={setAssignedTechId}>
                <SelectTrigger>
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
