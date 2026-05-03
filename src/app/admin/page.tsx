"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/input-formatters";
import { type PortalRole } from "@/lib/portal-auth";
import { getErrorMessage } from "@/lib/tech-inspection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BackToPortalButton,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

interface DeletedJobAuditEntry {
  id: string;
  job_id: string;
  business_job_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  vehicle_label: string | null;
  status: string | null;
  priority: string | null;
  service_type: string | null;
  quote_total: number | null;
  deleted_by_name: string | null;
  deleted_by_email: string | null;
  deleted_at: string;
  related_counts: Record<string, number> | null;
}

interface DeletedCustomerAuditEntry {
  id: string;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_count: number;
  address_count: number;
  inspection_count: number;
  deleted_by_name: string | null;
  deleted_by_email: string | null;
  deletion_reason: string | null;
  deleted_at: string;
}

type DeletedJobsRange = "7d" | "30d" | "all";
type OperationsDetailView = "openJobs" | "unassignedJobs" | "customers" | "techAssigned";

type OperationsJobRow = {
  id: string;
  business_job_number: string | null;
  assigned_tech_user_id: string | null;
  service_type: string | null;
  service_description: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
  }[] | null;
  vehicles: {
    year: string | number | null;
    make: string | null;
    model: string | null;
    engine_size: string | null;
    license_plate: string | null;
  }[] | null;
};

type OperationsCustomerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type PendingClosureRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_closure_requested_at: string | null;
  account_closure_request_note: string | null;
};

type PublicServiceMessageRow = {
  id: string;
  status: string;
  requested_service: string;
  service_details: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
};

const OPERATIONS_DETAIL_PAGE_SIZE = 10;
const OPERATIONS_DETAIL_FETCH_LIMIT = 1000;

function operationsJobMatchesSearch(job: OperationsJobRow, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  const customer = job.customer?.[0];
  const vehicle = job.vehicles?.[0];
  const customerName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();
  const vehicleLabel = [
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.engine_size,
    vehicle?.license_plate,
  ]
    .filter(Boolean)
    .join(" ");
  const workNeeded = (job.service_description || job.service_type || "").replaceAll("_", " ");
  const haystack = [
    job.id,
    job.business_job_number,
    customerName,
    vehicleLabel,
    workNeeded,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return haystack.some((s) => s.includes(t));
}

function operationsCustomerMatchesSearch(customer: OperationsCustomerRow, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  const haystack = [
    customer.id,
    customer.first_name,
    customer.last_name,
    fullName,
    customer.email,
    customer.phone,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return haystack.some((s) => s.includes(t));
}

/** Page numbers between Previous/Next; inserts ellipsis when the list would be long. */
function getOperationsDetailPageItems(
  totalPages: number,
  currentPage: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 1) {
    return [1];
  }
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
    if (i >= 1 && i <= totalPages) {
      pages.add(i);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) {
      result.push("ellipsis");
    }
    result.push(p);
    prev = p;
  }
  return result;
}

/** Highest privilege first; matches portal hierarchy for sorting. */
type AssignUserProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function formatProfileDisplayName(profile: AssignUserProfileRow) {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return name || profile.email?.trim() || "Unknown user";
}

const ADMIN_ROLE_OPTIONS: { value: PortalRole; label: string; hint: string }[] = [
  {
    value: "admin",
    label: "Admin",
    hint: "All portals — admin, manager, technician, and customer",
  },
  {
    value: "manager",
    label: "Manager",
    hint: "Manager, technician, and customer areas",
  },
  {
    value: "technician",
    label: "Technician",
    hint: "Technician and customer areas",
  },
  {
    value: "customer",
    label: "Customer",
    hint: "Customer account only",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<PortalRole>("technician");
  const [roleComboOpen, setRoleComboOpen] = useState(false);
  const [assignableProfiles, setAssignableProfiles] = useState<AssignUserProfileRow[]>([]);
  const [assignUsersLoading, setAssignUsersLoading] = useState(false);
  const [assignUsersError, setAssignUsersError] = useState("");
  const [emailComboOpen, setEmailComboOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [managerOpenJobsCount, setManagerOpenJobsCount] = useState(0);
  const [managerUnassignedJobsCount, setManagerUnassignedJobsCount] = useState(0);
  const [managerCustomersCount, setManagerCustomersCount] = useState(0);
  const [techActiveJobsCount, setTechActiveJobsCount] = useState(0);
  const [operationsDetailView, setOperationsDetailView] = useState<OperationsDetailView>("openJobs");
  const [operationsDetailLoading, setOperationsDetailLoading] = useState(false);
  const [operationsDetailMessage, setOperationsDetailMessage] = useState("");
  const [openJobsDetails, setOpenJobsDetails] = useState<OperationsJobRow[]>([]);
  const [unassignedJobsDetails, setUnassignedJobsDetails] = useState<OperationsJobRow[]>([]);
  const [techAssignedJobsDetails, setTechAssignedJobsDetails] = useState<OperationsJobRow[]>([]);
  const [customersDetails, setCustomersDetails] = useState<OperationsCustomerRow[]>([]);
  const [operationsDetailSearch, setOperationsDetailSearch] = useState("");
  const [operationsDetailPage, setOperationsDetailPage] = useState(1);
  const operationsDetailRef = useRef<HTMLDivElement | null>(null);

  const openOperationsDetail = (view: OperationsDetailView) => {
    setOperationsDetailView(view);
    setOperationsDetailPage(1);
    setOperationsDetailSearch("");
    window.setTimeout(() => {
      operationsDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };
  const [deletedJobs, setDeletedJobs] = useState<DeletedJobAuditEntry[]>([]);
  const [deletedCustomers, setDeletedCustomers] = useState<DeletedCustomerAuditEntry[]>([]);
  const [deletionAuditLoading, setDeletionAuditLoading] = useState(true);
  const [deletionAuditMessage, setDeletionAuditMessage] = useState("");
  const [deletionAuditSearch, setDeletionAuditSearch] = useState("");
  const [deletionAuditRange, setDeletionAuditRange] = useState<DeletedJobsRange>("7d");
  const [deletedCustomersById, setDeletedCustomersById] = useState<
    Record<string, DeletedCustomerAuditEntry>
  >({});
  const [pendingClosures, setPendingClosures] = useState<PendingClosureRow[]>([]);
  const [pendingClosuresLoading, setPendingClosuresLoading] = useState(true);
  const [pendingClosuresMessage, setPendingClosuresMessage] = useState("");
  const [finalizingClosureId, setFinalizingClosureId] = useState<string | null>(null);
  const [publicMessagesLoading, setPublicMessagesLoading] = useState(true);
  const [publicMessagesMessage, setPublicMessagesMessage] = useState("");
  const [publicMessagesCount, setPublicMessagesCount] = useState(0);
  const [recentPublicMessages, setRecentPublicMessages] = useState<PublicServiceMessageRow[]>([]);

  const fetchDeletionAudit = useCallback(async (range: DeletedJobsRange) => {
    setDeletionAuditLoading(true);
    setDeletionAuditMessage("");

    const days = range === "7d" ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const applyRangeFilter = <T,>(query: T): T =>
      range === "all"
        ? query
        : (query as { gte: (column: string, value: string) => T }).gte(
            "deleted_at",
            cutoffDate.toISOString(),
          );

    let nextDeletedJobs: DeletedJobAuditEntry[] = [];
    let nextDeletedCustomers: DeletedCustomerAuditEntry[] = [];
    let jobsError = "";
    let customersError = "";
    let jobsUsedFallback = false;
    try {
      const jobsBaseQuery = supabase
        .from("deleted_jobs_audit")
        .select(`
          id,
          job_id,
          business_job_number,
          customer_id,
          customer_name,
          vehicle_label,
          status,
          priority,
          service_type,
          quote_total,
          deleted_by_name,
          deleted_by_email,
          deleted_at,
          related_counts
        `)
        .order("deleted_at", { ascending: false })
        .limit(range === "all" ? 250 : 100);
      const { data: jobsData, error: jobsQueryError } = await applyRangeFilter(jobsBaseQuery);
      if (jobsQueryError) {
        const fallbackJobsQuery = supabase
          .from("deleted_jobs_audit")
          .select(`
            id,
            job_id,
            business_job_number,
            deleted_by_name,
            deleted_by_email,
            deleted_at
          `)
          .order("deleted_at", { ascending: false })
          .limit(range === "all" ? 250 : 100);
        const { data: fallbackJobsData, error: fallbackJobsError } = await applyRangeFilter(
          fallbackJobsQuery,
        );

        if (fallbackJobsError) {
          jobsError = getErrorMessage(jobsQueryError, "");
        } else {
          jobsUsedFallback = true;
          nextDeletedJobs = (fallbackJobsData ?? []).map((row) => ({
            id: row.id,
            job_id: row.job_id,
            business_job_number: row.business_job_number ?? null,
            customer_id: null,
            customer_name: null,
            vehicle_label: null,
            status: null,
            priority: null,
            service_type: null,
            quote_total: null,
            deleted_by_name: row.deleted_by_name ?? null,
            deleted_by_email: row.deleted_by_email ?? null,
            deleted_at: row.deleted_at,
            related_counts: null,
          }));
        }
      } else {
        nextDeletedJobs = jobsData ?? [];
      }

      const customersBaseQuery = supabase
        .from("deleted_customers_audit")
        .select(`
          id,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          vehicle_count,
          address_count,
          inspection_count,
          deleted_by_name,
          deleted_by_email,
          deletion_reason,
          deleted_at
        `)
        .order("deleted_at", { ascending: false })
        .limit(range === "all" ? 250 : 100);
      const { data: customersData, error: customersQueryError } = await applyRangeFilter(
        customersBaseQuery,
      );
      if (customersQueryError) {
        customersError = getErrorMessage(customersQueryError, "");
      } else {
        nextDeletedCustomers = customersData ?? [];
      }

      setDeletedJobs(nextDeletedJobs);
      setDeletedCustomers(nextDeletedCustomers);

      const customerIds = Array.from(
        new Set(nextDeletedJobs.map((entry) => entry.customer_id).filter(Boolean)),
      ) as string[];

      if (customerIds.length === 0) {
        setDeletedCustomersById({});
      } else {
        const latestByCustomerId = nextDeletedCustomers.reduce<Record<string, DeletedCustomerAuditEntry>>(
          (acc, row) => {
            if (!row.customer_id) return acc;
            if (!acc[row.customer_id]) {
              acc[row.customer_id] = row;
            }
            return acc;
          },
          {},
        );
        setDeletedCustomersById(latestByCustomerId);
      }

      const jobSourceFailed =
        jobsError &&
        (jobsError.toLowerCase().includes("does not exist") ||
          jobsError.toLowerCase().includes("permission denied") ||
          jobsError.toLowerCase().includes("relation"));
      const customerSourceFailed =
        customersError &&
        (customersError.toLowerCase().includes("does not exist") ||
          customersError.toLowerCase().includes("permission denied") ||
          customersError.toLowerCase().includes("relation"));

      if (jobsError || customersError) {
        if (jobSourceFailed && customerSourceFailed) {
          setDeletionAuditMessage(
            "Deletion audit is not available yet. Apply the latest Supabase deletion-audit migrations and refresh.",
          );
        } else {
          const partialIssues = [
            jobsError ? `jobs: ${jobsError}` : "",
            customersError ? `customers: ${customersError}` : "",
            jobsUsedFallback ? "jobs: using fallback columns" : "",
          ]
            .filter(Boolean)
            .join(" | ");
          setDeletionAuditMessage(
            `Showing available deletion records. Partial source issue: ${partialIssues}`,
          );
        }
      }
    } catch (error) {
      const rawMessage = getErrorMessage(error, "Unknown deletion audit error.");
      setDeletionAuditMessage(`Deletion audit could not be loaded: ${rawMessage}`);
      setDeletedJobs([]);
      setDeletedCustomers([]);
      setDeletedCustomersById({});
    } finally {
      setDeletionAuditLoading(false);
    }
  }, []);

  const fetchOperationsSnapshot = useCallback(async () => {
    setOperationsDetailLoading(true);
    setOperationsDetailMessage("");
    try {
      const [
        { count: openJobs, error: openJobsError },
        { count: unassignedJobs, error: unassignedJobsError },
        { count: customers, error: customersError },
        { count: techJobs, error: techJobsError },
        { data: openJobsRows, error: openJobsRowsError },
        { data: unassignedRows, error: unassignedRowsError },
        { data: techAssignedRows, error: techAssignedRowsError },
        { data: customerRows, error: customerRowsError },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["new_request", "in_progress"]),
        supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["new_request", "in_progress"])
          .is("assigned_tech_user_id", null),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["new_request", "in_progress"])
          .not("assigned_tech_user_id", "is", null),
        supabase
          .from("jobs")
          .select(
            "id, business_job_number, assigned_tech_user_id, service_type, service_description, customer:customers(first_name,last_name), vehicles:vehicles(year,make,model,engine_size,license_plate)",
          )
          .in("status", ["new_request", "in_progress"])
          .order("updated_at", { ascending: false })
          .limit(OPERATIONS_DETAIL_FETCH_LIMIT),
        supabase
          .from("jobs")
          .select(
            "id, business_job_number, assigned_tech_user_id, service_type, service_description, customer:customers(first_name,last_name), vehicles:vehicles(year,make,model,engine_size,license_plate)",
          )
          .in("status", ["new_request", "in_progress"])
          .is("assigned_tech_user_id", null)
          .order("updated_at", { ascending: false })
          .limit(OPERATIONS_DETAIL_FETCH_LIMIT),
        supabase
          .from("jobs")
          .select(
            "id, business_job_number, assigned_tech_user_id, service_type, service_description, customer:customers(first_name,last_name), vehicles:vehicles(year,make,model,engine_size,license_plate)",
          )
          .in("status", ["new_request", "in_progress"])
          .not("assigned_tech_user_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(OPERATIONS_DETAIL_FETCH_LIMIT),
        supabase
          .from("customers")
          .select("id, first_name, last_name, email, phone")
          .order("created_at", { ascending: false })
          .limit(OPERATIONS_DETAIL_FETCH_LIMIT),
      ]);

      if (openJobsError) throw openJobsError;
      if (unassignedJobsError) throw unassignedJobsError;
      if (customersError) throw customersError;
      if (techJobsError) throw techJobsError;
      if (openJobsRowsError) throw openJobsRowsError;
      if (unassignedRowsError) throw unassignedRowsError;
      if (techAssignedRowsError) throw techAssignedRowsError;
      if (customerRowsError) throw customerRowsError;

      setManagerOpenJobsCount(openJobs ?? 0);
      setManagerUnassignedJobsCount(unassignedJobs ?? 0);
      setManagerCustomersCount(customers ?? 0);
      setTechActiveJobsCount(techJobs ?? 0);
      setOpenJobsDetails((openJobsRows ?? []) as OperationsJobRow[]);
      setUnassignedJobsDetails((unassignedRows ?? []) as OperationsJobRow[]);
      setTechAssignedJobsDetails((techAssignedRows ?? []) as OperationsJobRow[]);
      setCustomersDetails((customerRows ?? []) as OperationsCustomerRow[]);
    } catch (error) {
      setOperationsDetailMessage(
        `Operations snapshot could not load details: ${getErrorMessage(error, "Unknown error.")}`,
      );
    } finally {
      setOperationsDetailLoading(false);
    }
  }, []);

  const fetchPendingClosures = useCallback(async () => {
    setPendingClosuresLoading(true);
    setPendingClosuresMessage("");
    try {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, email, account_closure_requested_at, account_closure_request_note",
        )
        .eq("account_closure_request_status", "requested")
        .order("account_closure_requested_at", { ascending: true });
      if (error) {
        throw error;
      }
      setPendingClosures((data ?? []) as PendingClosureRow[]);
    } catch (error) {
      setPendingClosures([]);
      setPendingClosuresMessage(getErrorMessage(error, "Could not load pending account deletions."));
    } finally {
      setPendingClosuresLoading(false);
    }
  }, []);

  const fetchPublicMessages = useCallback(async () => {
    setPublicMessagesLoading(true);
    setPublicMessagesMessage("");
    try {
      const [
        { count, error: countError },
        { data, error: dataError },
      ] = await Promise.all([
        supabase
          .from("service_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("service_requests")
          .select(
            "id, status, requested_service, service_details, contact_name, contact_phone, contact_email, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (countError) throw countError;
      if (dataError) throw dataError;

      setPublicMessagesCount(count ?? 0);
      setRecentPublicMessages((data ?? []) as PublicServiceMessageRow[]);
    } catch (error) {
      setPublicMessagesCount(0);
      setRecentPublicMessages([]);
      setPublicMessagesMessage(getErrorMessage(error, "Could not load website messages."));
    } finally {
      setPublicMessagesLoading(false);
    }
  }, []);

  const handleFinalizeClosure = async (row: PendingClosureRow) => {
    const customerName =
      `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "this customer";
    const confirmed = window.confirm(
      `Delete ${customerName} permanently now? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setFinalizingClosureId(row.id);
    setPendingClosuresMessage("");
    try {
      const { error } = await supabase.rpc("delete_customer_with_audit", {
        p_customer_id: row.id,
        p_reason: "Customer initiated account deletion from portal after hold period.",
      });
      if (error) {
        throw error;
      }
      await Promise.all([fetchPendingClosures(), fetchDeletionAudit(deletionAuditRange)]);
    } catch (error) {
      setPendingClosuresMessage(getErrorMessage(error, "Could not delete customer account."));
    } finally {
      setFinalizingClosureId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchOperationsSnapshot();
      setLoading(false);
    };

    void load();
  }, [fetchOperationsSnapshot]);

  useEffect(() => {
    void fetchDeletionAudit(deletionAuditRange);
  }, [deletionAuditRange, fetchDeletionAudit]);

  useEffect(() => {
    void fetchPendingClosures();
  }, [fetchPendingClosures]);

  useEffect(() => {
    void fetchPublicMessages();
  }, [fetchPublicMessages]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      setAssignUsersLoading(true);
      setAssignUsersError("");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("email", { ascending: true });

      if (cancelled) {
        return;
      }

      setAssignUsersLoading(false);

      if (error) {
        setAssignUsersError(error.message);
        setAssignableProfiles([]);
        return;
      }

      setAssignableProfiles((data ?? []) as AssignUserProfileRow[]);
    };

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAssignProfile = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      return undefined;
    }
    const normalized = normalizeEmail(trimmed);
    return assignableProfiles.find(
      (p) => p.email && normalizeEmail(p.email) === normalized,
    );
  }, [email, assignableProfiles]);

  const operationsDetailPagination = useMemo(() => {
    const term = operationsDetailSearch.trim();
    if (operationsDetailView === "customers") {
      const filtered = customersDetails.filter((c) =>
        operationsCustomerMatchesSearch(c, term),
      );
      const totalPages = Math.max(1, Math.ceil(filtered.length / OPERATIONS_DETAIL_PAGE_SIZE));
      const safePage = Math.min(operationsDetailPage, totalPages);
      const start = (safePage - 1) * OPERATIONS_DETAIL_PAGE_SIZE;
      const pageSlice = filtered.slice(start, start + OPERATIONS_DETAIL_PAGE_SIZE);
      const rangeStart = filtered.length === 0 ? 0 : start + 1;
      const rangeEnd = start + pageSlice.length;
      return {
        mode: "customers" as const,
        customersPage: pageSlice,
        jobsPage: [] as OperationsJobRow[],
        filteredCount: filtered.length,
        totalPages,
        safePage,
        rangeStart,
        rangeEnd,
      };
    }

    const jobRows =
      operationsDetailView === "openJobs"
        ? openJobsDetails
        : operationsDetailView === "unassignedJobs"
        ? unassignedJobsDetails
        : techAssignedJobsDetails;
    const filtered = jobRows.filter((j) => operationsJobMatchesSearch(j, term));
    const totalPages = Math.max(1, Math.ceil(filtered.length / OPERATIONS_DETAIL_PAGE_SIZE));
    const safePage = Math.min(operationsDetailPage, totalPages);
    const start = (safePage - 1) * OPERATIONS_DETAIL_PAGE_SIZE;
    const pageSlice = filtered.slice(start, start + OPERATIONS_DETAIL_PAGE_SIZE);
    const rangeStart = filtered.length === 0 ? 0 : start + 1;
    const rangeEnd = start + pageSlice.length;
    return {
      mode: "jobs" as const,
      customersPage: [] as OperationsCustomerRow[],
      jobsPage: pageSlice,
      filteredCount: filtered.length,
      totalPages,
      safePage,
      rangeStart,
      rangeEnd,
    };
  }, [
    operationsDetailView,
    operationsDetailSearch,
    operationsDetailPage,
    customersDetails,
    openJobsDetails,
    unassignedJobsDetails,
    techAssignedJobsDetails,
  ]);

  useEffect(() => {
    setOperationsDetailPage((p) => Math.min(p, operationsDetailPagination.totalPages));
  }, [operationsDetailPagination.totalPages]);

  const filteredDeletionAudit = [
    ...deletedJobs.map((entry) => ({ type: "job" as const, deleted_at: entry.deleted_at, entry })),
    ...deletedCustomers.map((entry) => ({
      type: "customer" as const,
      deleted_at: entry.deleted_at,
      entry,
    })),
  ]
    .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())
    .filter((item) => {
      const term = deletionAuditSearch.trim().toLowerCase();

      if (!term) {
        return true;
      }

      if (item.type === "job") {
        const entry = item.entry;
        return [
          entry.business_job_number,
          entry.job_id,
          entry.customer_id,
          entry.customer_name,
          entry.vehicle_label,
          entry.status,
          entry.priority,
          entry.service_type,
          entry.quote_total,
          entry.deleted_by_name,
          entry.deleted_by_email,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      }

      const entry = item.entry;
      return [
        entry.customer_id,
        entry.customer_name,
        entry.customer_email,
        entry.customer_phone,
        entry.deleted_by_name,
        entry.deleted_by_email,
        entry.deletion_reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (!email.trim()) {
        setMessage("Select a user to assign a role.");
        setSubmitting(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
          role: selectedRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Failed to assign role.");
        setSubmitting(false);
        return;
      }

      setMessage(`Role "${selectedRole}" assigned to ${normalizeEmail(email)}.`);
      setEmail("");
      setSelectedRole("technician");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to assign role."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container max-w-6xl">
        <div className="otg-app-panel">
          <p className="text-slate-700">Loading admin dashboard...</p>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-page otg-portal-dark">
      <div className="otg-container max-w-6xl space-y-6">
        <div className="otg-app-panel">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <BrandLogo priority />
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="mt-2 text-slate-600">
                Manage users, roles, and system settings.
              </p>
            </div>

            <div className="w-full max-w-2xl space-y-4">
              <div className="flex justify-end">
                <PortalTopNav section="admin" />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <BackToPortalButton />
              </div>
            </div>
          </div>
        </div>

        <div className="otg-app-panel">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_minmax(0,1fr)]">
            <section>
              <h2 className="text-2xl font-bold text-slate-900">1) Operations Snapshot</h2>
              <p className="mt-2 text-slate-600">
                Admin stays in the admin environment while still seeing manager and technician workload data.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openOperationsDetail("openJobs")}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    operationsDetailView === "openJobs"
                      ? "border-lime-400 bg-lime-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Manager
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{managerOpenJobsCount}</div>
                  <p className="mt-1 text-sm text-slate-600">Open jobs</p>
                  <p className="mt-1 text-xs font-semibold text-lime-700">View details</p>
                </button>
                <button
                  type="button"
                  onClick={() => openOperationsDetail("unassignedJobs")}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    operationsDetailView === "unassignedJobs"
                      ? "border-lime-400 bg-lime-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Manager
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{managerUnassignedJobsCount}</div>
                  <p className="mt-1 text-sm text-slate-600">Unassigned jobs</p>
                  <p className="mt-1 text-xs font-semibold text-lime-700">View details</p>
                </button>
                <button
                  type="button"
                  onClick={() => openOperationsDetail("customers")}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    operationsDetailView === "customers"
                      ? "border-lime-400 bg-lime-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Manager
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{managerCustomersCount}</div>
                  <p className="mt-1 text-sm text-slate-600">Active customers</p>
                  <p className="mt-1 text-xs font-semibold text-lime-700">View details</p>
                </button>
                <button
                  type="button"
                  onClick={() => openOperationsDetail("techAssigned")}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    operationsDetailView === "techAssigned"
                      ? "border-lime-400 bg-lime-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Technician
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{techActiveJobsCount}</div>
                  <p className="mt-1 text-sm text-slate-600">Assigned active jobs</p>
                  <p className="mt-1 text-xs font-semibold text-lime-700">View details</p>
                </button>
              </div>

              <div ref={operationsDetailRef} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {operationsDetailView === "openJobs"
                    ? "Open jobs detail"
                    : operationsDetailView === "unassignedJobs"
                    ? "Unassigned jobs detail"
                    : operationsDetailView === "customers"
                    ? "Active customers detail"
                    : "Technician assigned jobs detail"}
                </div>
                {operationsDetailLoading ? (
                  <p className="mt-2 text-sm text-slate-600">Loading details...</p>
                ) : operationsDetailMessage ? (
                  <p className="mt-2 text-sm text-amber-800">{operationsDetailMessage}</p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Input
                        value={operationsDetailSearch}
                        onChange={(e) => {
                          setOperationsDetailSearch(e.target.value);
                          setOperationsDetailPage(1);
                        }}
                        placeholder={
                          operationsDetailView === "customers"
                            ? "Search name, email, phone, or ID"
                            : "Search job #, status, priority, customer ID, or date"
                        }
                        className="max-w-md bg-white"
                      />
                      <p className="text-xs text-slate-600">
                        {operationsDetailPagination.filteredCount === 0
                          ? "No matches"
                          : `Showing ${operationsDetailPagination.rangeStart}–${operationsDetailPagination.rangeEnd} of ${operationsDetailPagination.filteredCount}`}
                      </p>
                    </div>

                    {operationsDetailPagination.mode === "customers" ? (
                      operationsDetailPagination.filteredCount ? (
                        <div className="mt-2 space-y-2">
                          {operationsDetailPagination.customersPage.map((customer) => (
                            <div
                              key={customer.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => router.push(`/manager/customers/${customer.id}`)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  router.push(`/manager/customers/${customer.id}`);
                                }
                              }}
                              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-lime-300 hover:bg-lime-50"
                            >
                              <div className="font-semibold text-slate-900">
                                {[customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                                  "Unnamed customer"}
                              </div>
                              <div className="text-xs text-slate-600">
                                {customer.email || "No email"}{" "}
                                {customer.phone ? `• ${customer.phone}` : ""}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-lime-700">Open customer details</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">
                          {customersDetails.length
                            ? "No rows match your search."
                            : "No customers to display."}
                        </p>
                      )
                    ) : operationsDetailPagination.filteredCount ? (
                      <div className="mt-2 space-y-2">
                        {operationsDetailPagination.jobsPage.map((job) => (
                          <div
                            key={job.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/manager/jobs/${job.id}`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(`/manager/jobs/${job.id}`);
                              }
                            }}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-lime-300 hover:bg-lime-50"
                          >
                            {(() => {
                              const customer = job.customer?.[0];
                              const vehicle = job.vehicles?.[0];
                              return (
                                <>
                            <div className="font-semibold text-slate-900">
                              Job #{job.business_job_number || job.id.slice(0, 8)}
                            </div>
                            <div className="text-xs text-slate-600">
                              Customer:{" "}
                              {`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
                                "Unknown customer"}
                            </div>
                            <div className="text-xs text-slate-600">
                              Vehicle:{" "}
                              {[
                                vehicle?.year,
                                vehicle?.make,
                                vehicle?.model,
                                vehicle?.engine_size,
                                vehicle?.license_plate,
                              ]
                                .filter(Boolean)
                                .join(" ") || "No vehicle details"}
                            </div>
                            <div className="text-xs text-slate-600">
                              Work needed:{" "}
                              {(job.service_description || job.service_type || "General service").replaceAll(
                                "_",
                                " ",
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              {operationsDetailView === "openJobs"
                                ? job.assigned_tech_user_id
                                  ? "Assignment: Assigned"
                                  : "Assignment: Unassigned"
                                : operationsDetailView === "techAssigned"
                                ? "Assignment: Assigned to technician"
                                : "Assignment: Pending assignment"}
                            </div>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">
                        {(operationsDetailView === "openJobs"
                          ? openJobsDetails
                          : operationsDetailView === "unassignedJobs"
                          ? unassignedJobsDetails
                          : techAssignedJobsDetails
                        ).length
                          ? "No rows match your search."
                          : "No jobs to display."}
                      </p>
                    )}

                    {operationsDetailPagination.totalPages > 1 ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={operationsDetailPagination.safePage <= 1}
                          onClick={() => {
                            const tp = operationsDetailPagination.totalPages;
                            setOperationsDetailPage((p) => Math.max(1, Math.min(tp, p - 1)));
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <div
                          className="flex flex-wrap items-center gap-1"
                          aria-label="Page numbers"
                        >
                          {getOperationsDetailPageItems(
                            operationsDetailPagination.totalPages,
                            operationsDetailPagination.safePage,
                          ).map((item, idx) =>
                            item === "ellipsis" ? (
                              <span
                                key={`ellipsis-${idx}`}
                                className="px-1.5 text-sm text-slate-500"
                                aria-hidden
                              >
                                …
                              </span>
                            ) : (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setOperationsDetailPage(item)}
                                className={
                                  item === operationsDetailPagination.safePage
                                    ? "min-w-[2.25rem] rounded-lg border border-lime-400 bg-lime-50 px-2 py-1.5 text-sm font-semibold text-slate-900 shadow-sm"
                                    : "min-w-[2.25rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
                                }
                                aria-current={item === operationsDetailPagination.safePage ? "page" : undefined}
                              >
                                {item}
                              </button>
                            ),
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={
                            operationsDetailPagination.safePage >=
                            operationsDetailPagination.totalPages
                          }
                          onClick={() => {
                            const tp = operationsDetailPagination.totalPages;
                            setOperationsDetailPage((p) => Math.min(tp, p + 1));
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xl font-bold text-slate-900">2) Manage User Access</h3>
              <p className="mt-2 text-sm text-slate-600">
                Choose a user (name and email), then assign one role at a time.
              </p>

              <form onSubmit={handleAssignRole} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="otg-label" htmlFor="admin-assign-user">
                    User
                  </label>
                  <Popover open={emailComboOpen} onOpenChange={setEmailComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="admin-assign-user"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={emailComboOpen}
                        disabled={assignUsersLoading}
                        className="otg-select h-auto min-h-10 w-full justify-between py-2 font-normal disabled:opacity-60"
                      >
                        <span className="flex min-w-0 flex-col items-start text-left">
                          {assignUsersLoading ? (
                            <span className="text-slate-500">Loading users…</span>
                          ) : selectedAssignProfile ? (
                            <>
                              <span className="font-medium text-slate-900">
                                {formatProfileDisplayName(selectedAssignProfile)}
                              </span>
                              <span className="text-xs font-normal text-slate-600">
                                {selectedAssignProfile.email}
                              </span>
                            </>
                          ) : email.trim() ? (
                            <span className="text-amber-800">
                              No matching profile — pick a user from the list
                            </span>
                          ) : (
                            <span className="text-slate-500">Select a user…</span>
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(100%,var(--radix-popover-trigger-width))] border border-slate-600/80 bg-[#0f172a] p-0 text-white sm:min-w-[340px]"
                      align="start"
                    >
                      <Command className="bg-[#0f172a] text-white [&_[data-slot=command-input-wrapper]]:border-slate-600/80">
                        <CommandInput
                          placeholder="Filter by name or email…"
                          className="h-9 border-0 text-white placeholder:text-slate-400"
                        />
                        <CommandList>
                          <CommandEmpty className="text-slate-400">
                            {assignUsersLoading
                              ? "Loading…"
                              : assignUsersError
                              ? "Could not load users."
                              : "No user matches."}
                          </CommandEmpty>
                          <CommandGroup>
                            {assignableProfiles
                              .filter((p) => p.email?.trim())
                              .map((p) => {
                                const display = formatProfileDisplayName(p);
                                const emailValue = normalizeEmail(p.email!);
                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={`${display} ${p.first_name ?? ""} ${p.last_name ?? ""} ${emailValue}`}
                                    onSelect={() => {
                                      setEmail(emailValue);
                                      setEmailComboOpen(false);
                                    }}
                                    className="cursor-pointer text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white aria-selected:bg-white/10"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0 text-lime-400",
                                        selectedAssignProfile?.id === p.id
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                      <span className="font-semibold text-white">{display}</span>
                                      <span className="text-xs text-slate-400">{emailValue}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {assignUsersError ? (
                    <p className="text-xs text-amber-800">{assignUsersError}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="otg-label" htmlFor="admin-assign-role">
                    Role
                  </label>
                  <Popover open={roleComboOpen} onOpenChange={setRoleComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="admin-assign-role"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={roleComboOpen}
                        className="otg-select h-auto min-h-10 w-full justify-between py-2 font-normal"
                      >
                        <span className="flex min-w-0 flex-col items-start text-left">
                          <span className="font-medium text-slate-900">
                            {ADMIN_ROLE_OPTIONS.find((o) => o.value === selectedRole)?.label ??
                              selectedRole}
                          </span>
                          <span className="text-xs font-normal text-slate-500">
                            {ADMIN_ROLE_OPTIONS.find((o) => o.value === selectedRole)?.hint}
                          </span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(100%,var(--radix-popover-trigger-width))] p-0 sm:min-w-[320px]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Filter roles…" className="h-9" />
                        <CommandList>
                          <CommandEmpty>No role matches.</CommandEmpty>
                          <CommandGroup>
                            {ADMIN_ROLE_OPTIONS.map((opt) => (
                              <CommandItem
                                key={opt.value}
                                value={`${opt.label} ${opt.hint} ${opt.value}`}
                                onSelect={() => {
                                  setSelectedRole(opt.value);
                                  setRoleComboOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    selectedRole === opt.value ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <span className="font-medium">{opt.label}</span>
                                  <span className="text-xs text-slate-500">{opt.hint}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <button
                  type="submit"
                  disabled={submitting || assignUsersLoading || !email.trim()}
                  className="otg-btn otg-btn-dark w-full disabled:opacity-50"
                >
                  {submitting ? "Assigning..." : "Assign Role"}
                </button>
              </form>
            </section>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="otg-app-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Website Messages</h2>
              <p className="mt-2 text-slate-600">
                Messages from the public contact page are stored here for manager and admin follow-up.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
                {publicMessagesCount} new
              </div>
              <button
                type="button"
                onClick={() => void fetchPublicMessages()}
                className="otg-btn otg-btn-dark"
              >
                Refresh Messages
              </button>
            </div>
          </div>

          {publicMessagesLoading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Loading website messages...
            </div>
          ) : publicMessagesMessage ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {publicMessagesMessage}
            </div>
          ) : recentPublicMessages.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No website messages yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentPublicMessages.map((messageRow) => (
                <div
                  key={messageRow.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {messageRow.requested_service}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {messageRow.contact_name || "No name provided"}
                      </div>
                    </div>
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {new Date(messageRow.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    {messageRow.contact_phone ? <div>{messageRow.contact_phone}</div> : null}
                    {messageRow.contact_email ? <div>{messageRow.contact_email}</div> : null}
                    <div>{messageRow.service_details || "No details provided."}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="otg-app-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Deleted Accounts</h2>
              <p className="mt-2 text-slate-600">
                Customer delete actions land here first. Use this section to finalize actual deletion.
              </p>
            </div>
            <button type="button" onClick={() => void fetchPendingClosures()} className="otg-btn otg-btn-dark">
              Refresh Queue
            </button>
          </div>

          {pendingClosuresLoading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Loading pending account deletions...
            </div>
          ) : pendingClosuresMessage ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {pendingClosuresMessage}
            </div>
          ) : pendingClosures.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No pending customer account deletions.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {pendingClosures.map((row) => {
                const customerName =
                  `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unnamed customer";
                return (
                  <div key={row.id} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{customerName}</p>
                        <p>{row.email || "No email on file"}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Requested:{" "}
                          {row.account_closure_requested_at
                            ? new Date(row.account_closure_requested_at).toLocaleString()
                            : "Unknown"}
                        </p>
                        {row.account_closure_request_note ? (
                          <p className="mt-1 text-xs text-slate-600">Note: {row.account_closure_request_note}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleFinalizeClosure(row)}
                        disabled={finalizingClosureId === row.id}
                        className="otg-btn bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        {finalizingClosureId === row.id ? "Deleting..." : "Delete Account"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="otg-app-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Deletion Audit</h2>
              <p className="mt-2 text-slate-600">
                3) Review customer and job deletions with who deleted them and when.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void fetchDeletionAudit(deletionAuditRange)}
              className="otg-btn otg-btn-dark"
            >
              Refresh Log
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={deletionAuditSearch}
              onChange={(e) => setDeletionAuditSearch(e.target.value)}
              placeholder="Search customer, job, service, vehicle, reason, or deleted by"
            />

            <select
              value={deletionAuditRange}
              onChange={(e) => {
                const nextRange = e.target.value as DeletedJobsRange;
                setDeletionAuditRange(nextRange);
              }}
              className="otg-select"
            >
              <option value="7d">Previous 7 days</option>
              <option value="30d">Previous 30 days</option>
              <option value="all">All deletions</option>
            </select>
          </div>

          {deletionAuditLoading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Loading deletion audit...
            </div>
          ) : (
            <>
              {deletionAuditMessage ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {deletionAuditMessage}
                </div>
              ) : null}
              {filteredDeletionAudit.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No deletions match the current filters.
                </div>
              ) : (
            <div className="mt-6 space-y-4">
              {filteredDeletionAudit.map((auditItem) => {
                if (auditItem.type === "customer") {
                  const entry = auditItem.entry;
                  return (
                    <details
                      key={`customer-${entry.id}`}
                      className="group rounded-3xl border border-slate-200 bg-slate-50"
                    >
                      <summary className="list-none cursor-pointer p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              Customer deletion: {entry.customer_name || "Unnamed customer"}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                              {entry.customer_email || "No email"}{" "}
                              {entry.customer_phone ? `• ${entry.customer_phone}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                                {entry.vehicle_count} vehicles
                              </span>
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                                {entry.address_count} addresses
                              </span>
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                                {entry.inspection_count} inspections
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-slate-600 md:text-right">
                            <p className="font-medium text-slate-900">
                              {entry.deleted_by_name || entry.deleted_by_email || "Unknown user"}
                            </p>
                            <p>{new Date(entry.deleted_at).toLocaleString()}</p>
                            <p className="mt-1 text-xs font-semibold text-lime-700 group-open:text-lime-800">
                              {`View details ${"\u25BE"}`}
                            </p>
                          </div>
                        </div>
                      </summary>
                      <div className="border-t border-slate-200 px-5 pb-5 pt-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <p>
                            <span className="font-semibold text-slate-900">Customer ID:</span>{" "}
                            {entry.customer_id.slice(0, 8)}
                          </p>
                          {entry.deletion_reason ? (
                            <p className="mt-2">
                              <span className="font-semibold text-slate-900">Reason:</span>{" "}
                              {entry.deletion_reason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  );
                }

                const entry = auditItem.entry;
                const relatedCounts = entry.related_counts ?? {};
                const relatedSummary = Object.entries(relatedCounts)
                  .filter(([, count]) => Number(count) > 0)
                  .map(([label, count]) => `${count} ${label.replaceAll("_", " ")}`)
                  .join(", ");
                const statusLabel = entry.status ? entry.status.replaceAll("_", " ") : "Unknown status";
                const priorityLabel = entry.priority ? `${entry.priority} priority` : "No priority";
                const quoteLabel =
                  typeof entry.quote_total === "number"
                    ? `$${entry.quote_total.toFixed(2)}`
                    : "No quote";
                const deletedCustomerAudit =
                  entry.customer_id ? deletedCustomersById[entry.customer_id] : undefined;

                return (
                  <details
                    key={`job-${entry.id}`}
                    className="group rounded-3xl border border-slate-200 bg-slate-50"
                  >
                    <summary className="list-none cursor-pointer p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            Job deletion: #{entry.business_job_number || entry.job_id.slice(0, 8)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.customer_name || "Unknown customer"}
                            {entry.vehicle_label ? ` • ${entry.vehicle_label}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                              {statusLabel}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                              {priorityLabel}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
                              Quote: {quoteLabel}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-slate-600 md:text-right">
                          <p className="font-medium text-slate-900">
                            {entry.deleted_by_name || entry.deleted_by_email || "Unknown user"}
                          </p>
                          <p>{new Date(entry.deleted_at).toLocaleString()}</p>
                          <p className="mt-1 text-xs font-semibold text-lime-700 group-open:text-lime-800">
                            {`View details ${"\u25BE"}`}
                          </p>
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-slate-200 px-5 pb-5 pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <p>
                            <span className="font-semibold text-slate-900">Customer ID:</span>{" "}
                            {entry.customer_id ? entry.customer_id.slice(0, 8) : "Unknown"}
                          </p>
                          {deletedCustomerAudit ? (
                            <>
                              <p className="mt-2">
                                <span className="font-semibold text-slate-900">Deleted customer record:</span>{" "}
                                {deletedCustomerAudit.customer_name || "Unnamed customer"}
                              </p>
                              <p className="mt-1">
                                {deletedCustomerAudit.customer_email || "No email"}
                                {" • "}
                                deleted {new Date(deletedCustomerAudit.deleted_at).toLocaleString()}
                              </p>
                            </>
                          ) : null}
                          <p className="mt-2">
                            <span className="font-semibold text-slate-900">Service:</span>{" "}
                            {entry.service_type || "General service"}
                          </p>
                          <p className="mt-2">
                            <span className="font-semibold text-slate-900">Deleted by:</span>{" "}
                            {entry.deleted_by_name || entry.deleted_by_email || "Unknown user"}
                          </p>
                          {entry.deleted_by_email ? (
                            <p className="mt-1">{entry.deleted_by_email}</p>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Related records at deletion</p>
                          <p className="mt-2">
                            {relatedSummary || "No related record counts were captured."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

