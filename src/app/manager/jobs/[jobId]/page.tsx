"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { deleteJobWithRelatedRecords } from "@/lib/job-deletion";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

// Types
interface Job {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  estimate_id: string | null;
  business_job_number: string | null;
  service_number: number | null;
  status: string;
  priority: string;
  source: string | null;
  service_type: string;
  service_description: string | null;
  requested_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_tech_user_id: string | null;
  service_duration_minutes: number | null;
  travel_time_minutes: number | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  notes: string | null;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    tax_exempt: boolean;
  } | null;
  vehicle: { year: string; make: string; model: string; license_plate: string; vin: string } | null;
}

interface JobService {
  id: string;
  service_name: string;
  service_description: string | null;
  estimated_hours: number | null;
  estimated_price: number | null;
  sort_order: number;
}

interface CatalogService {
  id: string;
  service_code: string | null;
  service_name: string;
  service_description: string | null;
  default_duration_minutes: number | null;
  default_price: number | null;
}

interface Supplier {
  id: string;
  name: string;
  account_number: string | null;
}

interface JobPart {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  supplier: string | null;
}

interface TimeEntry {
  id: string;
  entry_type: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  technician_user_id: string;
  tech_email: string | null;
}

interface Note {
  id: string;
  note: string;
  note_type: string;
  is_pinned: boolean;
  created_at: string;
  created_by_user_id: string | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

const getServiceAddressLabel = (job: Job | null) =>
  job
    ? [
        job.service_location_name,
        job.service_address,
        [job.service_city, job.service_state, job.service_zip].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ") || "—"
    : "—";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [services, setServices] = useState<JobService[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServiceDescription, setEditServiceDescription] = useState("");
  const [editServiceEstimatedHours, setEditServiceEstimatedHours] = useState("");
  const [editServiceEstimatedPrice, setEditServiceEstimatedPrice] = useState("");
  const [parts, setParts] = useState<JobPart[]>([]);
  const [newPartName, setNewPartName] = useState("");
  const [newPartNumber, setNewPartNumber] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState("1");
  const [newPartUnitCost, setNewPartUnitCost] = useState("");
  const [newPartUnitPrice, setNewPartUnitPrice] = useState("");
  const [newPartSupplier, setNewPartSupplier] = useState("");
  const [newPartNotes, setNewPartNotes] = useState("");
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPartName, setEditPartName] = useState("");
  const [editPartNumber, setEditPartNumber] = useState("");
  const [editPartQuantity, setEditPartQuantity] = useState("1");
  const [editPartUnitCost, setEditPartUnitCost] = useState("");
  const [editPartUnitPrice, setEditPartUnitPrice] = useState("");
  const [editPartSupplier, setEditPartSupplier] = useState("");
  const [editPartNotes, setEditPartNotes] = useState("");
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{
  id: string;
  estimate_number: string | null;
  estimate_status: string;
  subtotal: number | null;
  tax_total: number | null;
  total_amount: number | null;
} | null>(null);

const [estimateLineItems, setEstimateLineItems] = useState<
  Array<{
    id: string;
    line_type: string;
    description: string;
    quantity: number;
    unit_price: number | null;
    unit_cost: number | null;
    notes: string | null;
  }>
>([]);

  const [serviceTaxRate, setServiceTaxRate] = useState("0");
  const [partsTaxRate, setPartsTaxRate] = useState("0");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [technicians, setTechnicians] = useState<
    Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
    }>
    >([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Form States
  const [status, setStatus] = useState("new_request");
  const [priority, setPriority] = useState("normal");
  const [assignedTechId, setAssignedTechId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("internal");
  const [customerTaxExempt, setCustomerTaxExempt] = useState(false);

  const servicesSubtotal = services.reduce(
    (sum, service) => sum + (service.estimated_price ?? 0),
    0
  );

  const partsSubtotal = parts.reduce(
    (sum, part) => sum + ((part.unit_price ?? 0) * (part.quantity ?? 0)),
    0
  );

  const jobSubtotal = servicesSubtotal + partsSubtotal;

  const isTaxExempt = customerTaxExempt;

  const serviceTaxTotal = isTaxExempt
    ? 0
    : servicesSubtotal * (Number(serviceTaxRate || "0") / 100);

  const partsTaxTotal = isTaxExempt
    ? 0
    : partsSubtotal * (Number(partsTaxRate || "0") / 100);

  const combinedTaxTotal = serviceTaxTotal + partsTaxTotal;
  const jobGrandTotal = jobSubtotal + combinedTaxTotal;

  const fetchJobData = useCallback(async () => {
    setLoading(true);
    try {
          // 1. Fetch Job + Relations
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone, tax_exempt),
          vehicle:vehicles(year, make, model, license_plate, vin)
        `)
        .eq("id", jobId)
        .single();

        if (jobError) throw jobError;
        setJob(jobData);
        setEstimateId(jobData.estimate_id ?? null);
        setStatus(jobData.status);
        setPriority(jobData.priority);
        setAssignedTechId(jobData.assigned_tech_user_id);
        setCustomerTaxExempt(jobData.customer?.tax_exempt ?? false);

        if (jobData.estimate_id) {
        const { data: estimateData, error: estimateError } = await supabase
          .from("estimates")
          .select("id, estimate_number, estimate_status, subtotal, tax_total, total_amount")
          .eq("id", jobData.estimate_id)
          .single();

        if (estimateError) throw estimateError;

        setEstimate(estimateData);
          if ((estimateData.tax_total ?? 0) > 0 && (estimateData.subtotal ?? 0) > 0) {
            const blendedRate = ((estimateData.tax_total ?? 0) / (estimateData.subtotal ?? 1)) * 100;
            setPartsTaxRate(blendedRate.toFixed(2));
          }

        const { data: lineItemsData, error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .select("id, line_type, description, quantity, unit_price, unit_cost, notes")
          .eq("estimate_id", jobData.estimate_id)
          .order("sort_order", { ascending: true });

        if (lineItemsError) throw lineItemsError;

        setEstimateLineItems(lineItemsData ?? []);
      } else {
        setEstimate(null);
        setEstimateLineItems([]);
      }

          // 2. Fetch Services
      const { data: servicesData } = await supabase
        .from("job_services")
        .select("*")
        .eq("job_id", jobId)
        .order("sort_order");
      setServices(servicesData || []);

          // 3. Fetch Parts
      const { data: partsData } = await supabase
        .from("job_parts")
        .select("*")
        .eq("job_id", jobId);
      setParts(partsData || []);

          // 4. Fetch Time Entries
      const { data: timeData } = await supabase
        .from("time_entries")
        .select("*")
        .eq("job_id", jobId)
        .order("clock_in", { ascending: false });
      setTimeEntries(timeData || []);

          // 5. Fetch Notes
      const { data: notesData } = await supabase
        .from("job_notes")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      setNotes(notesData || []);

            // 6. Fetch Technicians for dropdown
      const { data: techRoles, error: techRolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technician");

      if (techRolesError) throw techRolesError;

      if (techRoles && techRoles.length > 0) {
        const techIds = techRoles.map((t) => t.user_id);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", techIds);

        if (profileError) throw profileError;

        const technicianList = (profileData ?? []).sort((a, b) => {
          const aName =
            `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || "";
          const bName =
            `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email || "";
          return aName.localeCompare(bName);
        });

        setTechnicians(technicianList);
      } else {
        setTechnicians([]);
      }

            // 7. Fetch active service catalog
        const { data: catalogData, error: catalogError } = await supabase
            .from("service_catalog")
            .select(
            "id, service_code, service_name, service_description, default_duration_minutes, default_price"
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("service_name", { ascending: true });

        if (catalogError) throw catalogError;

        setCatalogServices(catalogData ?? []);

              // 8. Fetch active suppliers
        const { data: supplierData, error: supplierError } = await supabase
            .from("suppliers")
            .select("id, name, account_number")
            .eq("is_active", true)
            .order("name", { ascending: true });

        if (supplierError) throw supplierError;

        setSuppliers(supplierData ?? []);

              // 9. Fetch business settings for tax rates
        const { data: settingsData, error: settingsError } = await supabase
          .from("business_settings")
          .select("default_service_tax_rate, default_parts_tax_rate")
          .limit(1)
          .single();

        if (settingsError) throw settingsError;

        setServiceTaxRate(String(settingsData.default_service_tax_rate ?? 0));
        setPartsTaxRate(String(settingsData.default_parts_tax_rate ?? 0));

    } catch (error: unknown) {
      console.error("Error fetching job:", error);
      alert("Failed to load job details.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

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
      await fetchJobData();
    };

    void checkAccessAndLoad();
  }, [fetchJobData, jobId]);

        const handleAddCatalogService = async () => {
        if (!selectedCatalogServiceId) {
            alert("Please select a service.");
            return;
        }

        const catalogService = catalogServices.find(
            (svc) => svc.id === selectedCatalogServiceId
        );

        if (!catalogService) {
            alert("Selected service not found.");
            return;
        }

        setSaving(true);

        try {
            const nextSortOrder =
            services.length > 0
                ? Math.max(...services.map((svc) => svc.sort_order || 0)) + 1
                : 0;

            const estimatedHours =
            typeof catalogService.default_duration_minutes === "number"
                ? Number((catalogService.default_duration_minutes / 60).toFixed(2))
                : null;

            const { data: insertedService, error } = await supabase
            .from("job_services")
            .insert({
                job_id: jobId,
                service_code: catalogService.service_code,
                service_name: catalogService.service_name,
                service_description: catalogService.service_description,
                estimated_hours: estimatedHours,
                estimated_price: catalogService.default_price,
                sort_order: nextSortOrder,
            })
            .select(
                "id, service_name, service_description, estimated_hours, estimated_price, sort_order"
            )
            .single();

            if (error) throw error;

            setServices((prev) => [...prev, insertedService]);
            setSelectedCatalogServiceId("");
        } catch (error: unknown) {
            console.error(error);
            alert(`Failed to add service: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
        };

        const handleAddPart = async () => {
          if (!newPartName.trim()) {
            alert("Please enter a part name.");
            return;
          }

        const quantity = Number(newPartQuantity);
        if (!quantity || quantity <= 0) {
            alert("Please enter a valid quantity.");
            return;
        }

        setSaving(true);

        try {
            const { data: insertedPart, error } = await supabase
            .from("job_parts")
            .insert({
                job_id: jobId,
                part_name: newPartName.trim(),
                part_number: newPartNumber.trim() || null,
                quantity,
                unit_cost: newPartUnitCost ? Number(newPartUnitCost) : null,
                unit_price: newPartUnitPrice ? Number(newPartUnitPrice) : null,
                supplier: newPartSupplier || null,
                notes: newPartNotes.trim() || null,
            })
            .select("id, part_name, part_number, quantity, unit_cost, unit_price, supplier")
            .single();

            if (error) throw error;

            setParts((prev) => [...prev, insertedPart]);

            setNewPartName("");
            setNewPartNumber("");
            setNewPartQuantity("1");
            setNewPartUnitCost("");
            setNewPartUnitPrice("");
            setNewPartSupplier("");
            setNewPartNotes("");
        } catch (error: unknown) {
            console.error(error);
            alert(`Failed to add part: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
        };

        const handleDeletePart = async (partId: string) => {
          const confirmed = window.confirm("Delete this part from the job?");
          if (!confirmed) return;

          setSaving(true);

          try {
            const { error } = await supabase
              .from("job_parts")
              .delete()
              .eq("id", partId);

            if (error) throw error;

            setParts((prev) => prev.filter((part) => part.id !== partId));
          } catch (error: unknown) {
            console.error(error);
            alert(`Failed to delete part: ${getErrorMessage(error)}`);
          } finally {
            setSaving(false);
          }
        };

      const handleDeleteService = async (serviceId: string) => {
        const confirmed = window.confirm("Delete this service from the job?");
        if (!confirmed) return;

        setSaving(true);

        try {
          const { error } = await supabase
            .from("job_services")
            .delete()
            .eq("id", serviceId);

          if (error) throw error;

          setServices((prev) => prev.filter((service) => service.id !== serviceId));
        } catch (error: unknown) {
          console.error(error);
          alert(`Failed to delete service: ${getErrorMessage(error)}`);
        } finally {
          setSaving(false);
        }
      };

      const handleStartEditService = (service: JobService) => {
        setEditingServiceId(service.id);
        setEditServiceName(service.service_name || "");
        setEditServiceDescription(service.service_description || "");
        setEditServiceEstimatedHours(
          typeof service.estimated_hours === "number"
            ? String(service.estimated_hours)
            : ""
        );
        setEditServiceEstimatedPrice(
          typeof service.estimated_price === "number"
            ? String(service.estimated_price)
            : ""
        );
      };

      const handleSaveEditService = async () => {
        if (!editingServiceId) return;

        if (!editServiceName.trim()) {
          alert("Please enter a service name.");
          return;
        }

        setSaving(true);

        try {
          const { data: updatedService, error } = await supabase
            .from("job_services")
            .update({
              service_name: editServiceName.trim(),
              service_description: editServiceDescription.trim() || null,
              estimated_hours: editServiceEstimatedHours
                ? Number(editServiceEstimatedHours)
                : null,
              estimated_price: editServiceEstimatedPrice
                ? Number(editServiceEstimatedPrice)
                : null,
            })
            .eq("id", editingServiceId)
            .select(
              "id, service_name, service_description, estimated_hours, estimated_price, sort_order"
            )
            .single();

          if (error) throw error;

          setServices((prev) =>
            prev.map((service) =>
              service.id === editingServiceId ? updatedService : service
            )
          );

          setEditingServiceId(null);
          setEditServiceName("");
          setEditServiceDescription("");
          setEditServiceEstimatedHours("");
          setEditServiceEstimatedPrice("");
        } catch (error: unknown) {
          console.error(error);
          alert(`Failed to update service: ${getErrorMessage(error)}`);
        } finally {
          setSaving(false);
        }
      };

      const handleCancelEditService = () => {
        setEditingServiceId(null);
        setEditServiceName("");
        setEditServiceDescription("");
        setEditServiceEstimatedHours("");
        setEditServiceEstimatedPrice("");
      };

      const handleStartEditPart = (part: JobPart) => {
        setEditingPartId(part.id);
        setEditPartName(part.part_name || "");
        setEditPartNumber(part.part_number || "");
        setEditPartQuantity(String(part.quantity ?? 1));
        setEditPartUnitCost(
          typeof part.unit_cost === "number" ? String(part.unit_cost) : ""
        );
        setEditPartUnitPrice(
          typeof part.unit_price === "number" ? String(part.unit_price) : ""
        );
        setEditPartSupplier(part.supplier || "");
        setEditPartNotes("");
      };

      const handleSaveEditPart = async () => {
        if (!editingPartId) return;

        if (!editPartName.trim()) {
          alert("Please enter a part name.");
          return;
        }

        const quantity = Number(editPartQuantity);
        if (!quantity || quantity <= 0) {
          alert("Please enter a valid quantity.");
          return;
        }

        setSaving(true);

        try {
          const { data: updatedPart, error } = await supabase
            .from("job_parts")
            .update({
              part_name: editPartName.trim(),
              part_number: editPartNumber.trim() || null,
              quantity,
              unit_cost: editPartUnitCost ? Number(editPartUnitCost) : null,
              unit_price: editPartUnitPrice ? Number(editPartUnitPrice) : null,
              supplier: editPartSupplier || null,
              notes: editPartNotes.trim() || null,
            })
            .eq("id", editingPartId)
            .select("id, part_name, part_number, quantity, unit_cost, unit_price, supplier")
            .single();

          if (error) throw error;

          setParts((prev) =>
            prev.map((part) => (part.id === editingPartId ? updatedPart : part))
          );

          setEditingPartId(null);
          setEditPartName("");
          setEditPartNumber("");
          setEditPartQuantity("1");
          setEditPartUnitCost("");
          setEditPartUnitPrice("");
          setEditPartSupplier("");
          setEditPartNotes("");
        } catch (error: unknown) {
          console.error(error);
          alert(`Failed to update part: ${getErrorMessage(error)}`);
        } finally {
          setSaving(false);
        }
      };

      const handleCancelEditPart = () => {
        setEditingPartId(null);
        setEditPartName("");
        setEditPartNumber("");
        setEditPartQuantity("1");
        setEditPartUnitCost("");
        setEditPartUnitPrice("");
        setEditPartSupplier("");
        setEditPartNotes("");
      };

      const handleSaveJobDetails = async () => {
        if (!job) {
          return;
        }

        const currentJob = job;

        setSaving(true);
        try {
          const { error: jobError } = await supabase
            .from("jobs")
            .update({
              status,
              priority,
              assigned_tech_user_id: assignedTechId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          if (jobError) throw jobError;

          const customerId = currentJob.customer_id;

          if (customerId) {
            const { error: customerError } = await supabase
              .from("customers")
              .update({
                tax_exempt: customerTaxExempt,
              })
              .eq("id", customerId);

            if (customerError) throw customerError;
          }

          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status,
                  priority,
                  assigned_tech_user_id: assignedTechId,
                  customer: prev.customer
                    ? {
                        ...prev.customer,
                        tax_exempt: customerTaxExempt,
                      }
                    : prev.customer,
                }
              : prev
          );

          alert("Job details updated!");
          fetchJobData();
        } catch (error: unknown) {
          console.error("Error updating job:", error);
          alert("Failed to update job.");
        } finally {
          setSaving(false);
        }
      };

      const handleDeleteJob = async () => {
        if (!job) {
          return;
        }

        const jobLabel = job.business_job_number || job.id.slice(0, 8);
        const customerName = `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim();
        const confirmed = window.confirm(
          `Delete job #${jobLabel}${customerName ? ` for ${customerName}` : ""}? This will also remove the linked estimate for this job and archive the deletion in the admin audit log.`
        );

        if (!confirmed) {
          return;
        }

        setSaving(true);

        try {
          await deleteJobWithRelatedRecords(job.id);
          alert("Job deleted.");
          router.push("/manager/jobs");
        } catch (error: unknown) {
          console.error("Error deleting job:", error);
          const message =
            error instanceof Error ? error.message : "Failed to delete job.";
          alert(message);

          if (message.startsWith("Job deleted,")) {
            router.push("/manager/jobs");
          }
        } finally {
          setSaving(false);
        }
      };

      const handleAddNote = async () => {
        if (!newNote.trim()) return;

        try {
          const { error } = await supabase.from("job_notes").insert({
            job_id: jobId,
            note: newNote,
            note_type: noteType,
            created_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          });

          if (error) throw error;

          setNewNote("");
          fetchJobData();
        } catch (error: unknown) {
          console.error("Error adding note:", error);
          alert("Failed to add note.");
        }
      };

      const handleCreateEstimate = async () => {
        if (!job) {
          alert("Job not loaded.");
          return;
        }

        if (estimateId) {
          alert("An estimate already exists for this job.");
          return;
        }

        setSaving(true);

        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          const { data: createdEstimate, error: estimateError } = await supabase
            .from("estimates")
            .insert({
              job_id: job.id,
              customer_id: job.customer_id ?? null,
              vehicle_id: job.vehicle_id ?? null,
              estimate_status: "draft",
              subtotal: jobSubtotal,
              tax_total: 0,
              total_amount: jobSubtotal,
              created_by_user_id: user?.id ?? null,
              notes: `Generated from job ${job.business_job_number || job.id}`,
            })
            .select("id")
            .single();

          if (estimateError) throw estimateError;

          const lineItems = [
            ...services.map((service, index) => ({
              estimate_id: createdEstimate.id,
              line_type: "service",
              description: service.service_name,
              quantity: 1,
              unit_price: service.estimated_price ?? 0,
              unit_cost: null,
              taxable: true,
              sort_order: index,
              notes: service.service_description ?? null,
            })),
            ...parts.map((part, index) => ({
              estimate_id: createdEstimate.id,
              line_type: "part",
              description: part.part_name,
              quantity: part.quantity ?? 1,
              unit_price: part.unit_price ?? 0,
              unit_cost: part.unit_cost ?? null,
              taxable: true,
              sort_order: services.length + index,
              notes: part.part_number
                ? `Part #: ${part.part_number}${part.supplier ? ` | Source: ${part.supplier}` : ""}`
                : part.supplier
                  ? `Source: ${part.supplier}`
                  : null,
            })),
          ];

          if (lineItems.length > 0) {
            const { error: lineItemsError } = await supabase
              .from("estimate_line_items")
              .insert(lineItems);

            if (lineItemsError) throw lineItemsError;
          }

          const { error: jobUpdateError } = await supabase
            .from("jobs")
            .update({ estimate_id: createdEstimate.id })
            .eq("id", job.id);

          if (jobUpdateError) throw jobUpdateError;

          setEstimateId(createdEstimate.id);
          setJob((prev) => (prev ? { ...prev, estimate_id: createdEstimate.id } : prev));

          const { data: estimateData, error: estimateFetchError } = await supabase
            .from("estimates")
            .select("id, estimate_number, estimate_status, subtotal, tax_total, total_amount")
            .eq("id", createdEstimate.id)
            .single();

          if (estimateFetchError) throw estimateFetchError;

          setEstimate(estimateData);

          const { data: lineItemsData, error: lineItemsFetchError } = await supabase
            .from("estimate_line_items")
            .select("id, line_type, description, quantity, unit_price, unit_cost, notes")
            .eq("estimate_id", createdEstimate.id)
            .order("sort_order", { ascending: true });

          if (lineItemsFetchError) throw lineItemsFetchError;

          setEstimateLineItems(lineItemsData ?? []);

          alert("Estimate created successfully.");
        } catch (error: unknown) {
          console.error(error);
          alert(`Failed to create estimate: ${getErrorMessage(error)}`);
        } finally {
          setSaving(false);
        }
      };

      const handleSaveEstimateTaxes = async () => {
        if (!estimateId) {
          alert("Create an estimate first.");
          return;
        }

        setSaving(true);

        try {
          const { data: updatedEstimate, error } = await supabase
            .from("estimates")
            .update({
              subtotal: jobSubtotal,
              tax_total: combinedTaxTotal,
              total_amount: jobGrandTotal,
            })
            .eq("id", estimateId)
            .select("id, estimate_number, estimate_status, subtotal, tax_total, total_amount")
            .single();

          if (error) throw error;

          setEstimate(updatedEstimate);
          alert("Estimate taxes updated.");
        } catch (error: unknown) {
          console.error(error);
          alert(`Failed to update estimate taxes: ${getErrorMessage(error)}`);
        } finally {
          setSaving(false);
        }
      };   

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!job) return <div className="p-8 text-center text-red-600">Job not found.</div>;

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                    Job #{job.business_job_number || job.id.slice(0, 8)}
                    </h1>
              <p className="text-slate-600">
                {job.customer?.first_name} {job.customer?.last_name} • {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <BackToPortalButton />
            {job.customer_id && (
              <Button
                variant="outline"
                className={headerActionButtonClassName}
                onClick={() => router.push(`/manager/customers/${job.customer_id}`)}
              >
                View Customer
              </Button>
            )}

            <Button
              variant="destructive"
              className={headerActionButtonClassName}
              onClick={handleDeleteJob}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Job
            </Button>

            <Button
              variant="outline"
              className={headerActionButtonClassName}
              onClick={() => router.push("/manager/jobs")}
            >
              Back to Jobs
            </Button>

            <Button
              onClick={handleSaveJobDetails}
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

        {/* Overview Tab (Always Visible at Top) */}
        <Card>
            <CardHeader>
                <CardTitle>Job Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            
            {/* Status & Priority */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_request">New Request</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Technician Assignment */}
            <div className="space-y-2">
              <Label>Assigned Technician</Label>
                <Select
                  value={assignedTechId || "unassigned"}
                  onValueChange={(val) => setAssignedTechId(val === "unassigned" ? null : val)}
                >
                <SelectTrigger>
                  <SelectValue placeholder="Select Technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
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

            <div className="space-y-2">
              <Label>Customer Tax Status</Label>
              <label className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={customerTaxExempt}
                  onChange={(e) => setCustomerTaxExempt(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Customer is tax exempt</span>
              </label>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <Label>Requested Date</Label>
              <Input 
                type="date" 
                value={job.requested_date || ""} 
                disabled 
                className="bg-slate-100"
              />
            </div>

            <div className="space-y-2">
              <Label>Scheduled Window</Label>
              <Input
                value={
                  job.scheduled_start
                    ? `${new Date(job.scheduled_start).toLocaleString()}${
                        job.scheduled_end
                          ? ` - ${new Date(job.scheduled_end).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : ""
                      }`
                    : "Unscheduled"
                }
                disabled
                className="bg-slate-100"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customer Summary</CardTitle>

            {job.customer_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/manager/customers/${job.customer_id}`)}
              >
                Open Customer
              </Button>
            )}
          </CardHeader>

          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Customer
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {`${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim() || "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Email
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {job.customer?.email || "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Phone
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {job.customer?.phone || "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Tax Status
              </div>
              <div className="mt-1">
                <Badge variant={customerTaxExempt ? "secondary" : "outline"}>
                  {customerTaxExempt ? "Tax Exempt" : "Taxable"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Job Source
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {job?.source === "customer_portal" ? "Customer Portal" : job?.source || "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Scheduled Window
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {job?.scheduled_start
                  ? `${new Date(job.scheduled_start).toLocaleString()}${
                      job.scheduled_end
                        ? ` - ${new Date(job.scheduled_end).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : ""
                    }`
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Time Breakdown
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {job?.service_duration_minutes || job?.travel_time_minutes
                  ? `${job.service_duration_minutes ?? 0} min service${
                      job.travel_time_minutes ? ` + ${job.travel_time_minutes} min travel` : ""
                    }`
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Service Address
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                {getServiceAddressLabel(job)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Details */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="parts">Parts</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Visit Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Service Type
                    </div>
                    <div className="mt-1 text-sm text-slate-900">
                      {job?.service_type || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Requested Date
                    </div>
                    <div className="mt-1 text-sm text-slate-900">
                      {job?.requested_date
                        ? new Date(job.requested_date).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned Technician
                    </div>
                    <div className="mt-1 text-sm text-slate-900">
                      {(() => {
                        const tech = technicians.find((t) => t.id === assignedTechId);
                        if (!tech) return "Unassigned";
                        return (
                          `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() ||
                          tech.email ||
                          "Unnamed technician"
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Service Description
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {job?.service_description || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Notes
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {job?.notes || "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Services Performed</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={selectedCatalogServiceId}
                    onValueChange={setSelectedCatalogServiceId}
                  >
                    <SelectTrigger className="w-full sm:w-[320px]">
                      <SelectValue placeholder="Select service from catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogServices.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.service_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button size="sm" onClick={handleAddCatalogService} disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {services.length === 0 ? (
                  <p className="py-4 text-center text-slate-500">No services added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {services.map((svc) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between rounded-lg border bg-slate-50 p-4"
                      >
                        <div className="flex-1">
                          {editingServiceId === svc.id ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Input
                                placeholder="Service name"
                                value={editServiceName}
                                onChange={(e) => setEditServiceName(e.target.value)}
                              />

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Estimated hours"
                                value={editServiceEstimatedHours}
                                onChange={(e) =>
                                  setEditServiceEstimatedHours(e.target.value)
                                }
                              />

                              <Textarea
                                placeholder="Service description"
                                value={editServiceDescription}
                                onChange={(e) =>
                                  setEditServiceDescription(e.target.value)
                                }
                                className="md:col-span-2"
                              />

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Estimated price"
                                value={editServiceEstimatedPrice}
                                onChange={(e) =>
                                  setEditServiceEstimatedPrice(e.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold">{svc.service_name}</p>
                              {svc.service_description && (
                                <p className="text-sm text-slate-600">
                                  {svc.service_description}
                                </p>
                              )}
                              <div className="mt-2 flex gap-4 text-sm text-slate-500">
                                <span>Est. Hours: {svc.estimated_hours || "-"}</span>
                                <span>
                                  Est. Price: ${svc.estimated_price?.toFixed(2) || "-"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {editingServiceId === svc.id ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSaveEditService();
                                }}
                                disabled={saving}
                              >
                                Save
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelEditService();
                                }}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStartEditService(svc);
                                }}
                                disabled={saving}
                              >
                                Edit
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteService(svc.id);
                                }}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Parts Tab */}
          <TabsContent value="parts" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Parts Used</CardTitle>
                <div className="grid w-full gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Input
                        placeholder="Part name"
                        value={newPartName}
                        onChange={(e) => setNewPartName(e.target.value)}
                    />

                    <Input
                        placeholder="Part number"
                        value={newPartNumber}
                        onChange={(e) => setNewPartNumber(e.target.value)}
                    />

                    <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Qty"
                        value={newPartQuantity}
                        onChange={(e) => setNewPartQuantity(e.target.value)}
                    />

                    <Select value={newPartSupplier} onValueChange={setNewPartSupplier}>
                        <SelectTrigger>
                        <SelectValue placeholder="Source / Supplier" />
                        </SelectTrigger>
                        <SelectContent>
                            {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.name}>
                                {supplier.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                    </Select>

                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit cost"
                        value={newPartUnitCost}
                        onChange={(e) => setNewPartUnitCost(e.target.value)}
                    />

                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit price"
                        value={newPartUnitPrice}
                        onChange={(e) => setNewPartUnitPrice(e.target.value)}
                    />

                    <Input
                        placeholder="Notes"
                        value={newPartNotes}
                        onChange={(e) => setNewPartNotes(e.target.value)}
                        className="lg:col-span-2"
                    />

                    <Button size="sm" onClick={handleAddPart} disabled={saving}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Part
                    </Button>
                    </div>
              </CardHeader>
              <CardContent>
                {parts.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No parts added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {parts.map((part) => (
                        <div
                        key={part.id}
                        className="flex items-center justify-between rounded-lg border bg-slate-50 p-4"
                        >
                        <div className="flex-1">
                          {editingPartId === part.id ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Input
                                placeholder="Part name"
                                value={editPartName}
                                onChange={(e) => setEditPartName(e.target.value)}
                              />

                              <Input
                                placeholder="Part number"
                                value={editPartNumber}
                                onChange={(e) => setEditPartNumber(e.target.value)}
                              />

                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Qty"
                                value={editPartQuantity}
                                onChange={(e) => setEditPartQuantity(e.target.value)}
                              />

                              <Select value={editPartSupplier} onValueChange={setEditPartSupplier}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Source / Supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                  {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.name}>
                                      {supplier.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Unit cost"
                                value={editPartUnitCost}
                                onChange={(e) => setEditPartUnitCost(e.target.value)}
                              />

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Unit price"
                                value={editPartUnitPrice}
                                onChange={(e) => setEditPartUnitPrice(e.target.value)}
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold">{part.part_name}</p>

                              {part.part_number && (
                                <p className="text-sm text-slate-600">Part #: {part.part_number}</p>
                              )}

                              {part.supplier && (
                                <p className="text-sm text-slate-600">Source: {part.supplier}</p>
                              )}

                              <div className="mt-2 flex gap-4 text-sm text-slate-500">
                                <span>Qty: {part.quantity}</span>
                                <span>Cost: ${part.unit_cost?.toFixed(2) || "-"}</span>
                                <span>Price: ${part.unit_price?.toFixed(2) || "-"}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {editingPartId === part.id ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSaveEditPart();
                                }}
                                disabled={saving}
                              >
                                Save
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelEditPart();
                                }}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStartEditPart(part);
                                }}
                                disabled={saving}
                              >
                                Edit
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeletePart(part.id);
                                }}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                        </div>
                    ))}
                    </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Tab */}
          <TabsContent value="time" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Time Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {timeEntries.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No time entries recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {timeEntries.map((entry) => (
                      <div key={entry.id} className="p-4 border rounded-lg bg-slate-50 flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{entry.tech_email || "Unknown Tech"}</p>
                          <p className="text-sm text-slate-600">
                            {new Date(entry.clock_in).toLocaleString()} - {entry.clock_out ? new Date(entry.clock_out).toLocaleString() : "Clocking Out..."}
                          </p>
                          <p className="text-sm font-medium text-green-700">
                            Duration: {entry.duration_minutes ? `${entry.duration_minutes} min` : "Calculating..."}
                          </p>
                        </div>
                        <Badge variant="outline">{entry.entry_type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="customer">Customer Visible</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Add a note..." 
                    value={newNote} 
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddNote}>Add</Button>
                </div>
                
                <div className="space-y-3 mt-4">
                  {notes.map((note) => (
                    <div key={note.id} className={`p-4 border rounded-lg ${note.note_type === 'customer' ? 'bg-blue-50 border-blue-200' : 'bg-slate-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={note.note_type === 'customer' ? 'default' : 'secondary'}>
                          {note.note_type === 'customer' ? 'Customer' : 'Internal'}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Estimates</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Services Subtotal
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      ${servicesSubtotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Parts Subtotal
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      ${partsSubtotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Job Subtotal
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      ${jobSubtotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {isTaxExempt && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    This customer is marked tax exempt. Service and parts taxes are currently set to $0.00.
                  </div>
                )}  

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Service Tax %
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={serviceTaxRate}
                      onChange={(e) => setServiceTaxRate(e.target.value)}
                      className="mt-3"
                    />
                    <div className="mt-3 text-sm text-slate-600">
                      Service Tax Total: ${serviceTaxTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Parts Tax %
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={partsTaxRate}
                      onChange={(e) => setPartsTaxRate(e.target.value)}
                      className="mt-3"
                    />
                    <div className="mt-3 text-sm text-slate-600">
                      Parts Tax Total: ${partsTaxTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Estimate
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {estimate
                          ? `Status: ${estimate.estimate_status}`
                          : "No estimate created yet."}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={handleCreateEstimate}
                        disabled={saving || !!estimateId}
                      >
                        {estimateId ? "Estimate Created" : "Create Estimate"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleSaveEstimateTaxes}
                        disabled={saving || !estimateId}
                      >
                        Save Tax Changes
                      </Button>
                    </div>
                  </div>

                  {estimate && (
                    <div className="mt-6 space-y-6">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Estimate Number
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            {estimate.estimate_number || "—"}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Subtotal
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            ${(estimate.subtotal ?? 0).toFixed(2)}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Tax
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            ${combinedTaxTotal.toFixed(2)}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Total
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            ${jobGrandTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Service Tax Total
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            ${serviceTaxTotal.toFixed(2)}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-slate-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Parts Tax Total
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            ${partsTaxTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          Estimate Line Items
                        </div>

                        {estimateLineItems.length === 0 ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                            No line items found.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {estimateLineItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between rounded-lg border bg-slate-50 p-4"
                              >
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {item.description}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    Type: {item.line_type} • Qty: {item.quantity}
                                  </div>
                                  {item.notes && (
                                    <div className="mt-1 text-sm text-slate-600">
                                      {item.notes}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right text-sm text-slate-700">
                                  <div>
                                    Unit Price: ${(item.unit_price ?? 0).toFixed(2)}
                                  </div>
                                  <div>
                                    Line Total: $
                                    {((item.unit_price ?? 0) * (item.quantity ?? 0)).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

