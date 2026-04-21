"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Search, Filter, Trash2 } from "lucide-react";
import { deleteJobWithRelatedRecords } from "@/lib/job-deletion";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { formatJobSourceLabel, isCustomerPortalJob } from "@/lib/job-source";
import { getSingleRelation } from "@/lib/customer-portal";
import { cn } from "@/lib/utils";

const managerJobsSelectContentClassName = cn(
  "!border !border-white/30 !bg-transparent !text-white shadow-none ring-0",
  "dark:!bg-transparent dark:!text-white",
  "[&_[data-slot=select-item]]:!text-white",
  "[&_[data-slot=select-item][data-highlighted]]:!bg-white/15",
  "[&_[data-slot=select-item]:focus]:!bg-white/15",
  "[&_[data-slot=select-scroll-up-button]]:!bg-transparent",
  "[&_[data-slot=select-scroll-down-button]]:!bg-transparent",
  "[&_svg]:!text-white"
);

interface Job {
  id: string;
  status: string;
  priority: string;
  service_type: string;
  service_description: string | null;
  requested_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  business_job_number: string | null;
  assigned_tech_user_id: string | null;
  created_by_user_id: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  vehicle: {
    id: string;
    year: string;
    make: string;
    model: string;
    license_plate: string;
    vin: string;
  } | null;
  assigned_tech: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface TechnicianOption {
  id: string;
  email: string | null;
}

export default function ManagerJobsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  useEffect(() => {
    void fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone),
          vehicle:vehicles(year, make, model, license_plate, vin)
        `)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      const enrichedJobs = await Promise.all(
        (jobsData || []).map(async (job) => {
          let assigned_tech = null;

          if (job.assigned_tech_user_id) {
            const { data: techProfile } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, email")
              .eq("id", job.assigned_tech_user_id)
              .single();

            assigned_tech = techProfile;
          }

          return {
            ...job,
            customer: getSingleRelation(job.customer),
            vehicle: getSingleRelation(job.vehicle),
            assigned_tech,
          };
        })
      );

      const { data: techData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technician");

      if (techData) {
        const techIds = techData.map((t) => t.user_id);
        const { data: techUsers, error: techUsersError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", techIds);

        if (techUsersError) throw techUsersError;
        setTechnicians(techUsers || []);
      }

      setJobs(enrichedJobs || []);
      setFilteredJobs(enrichedJobs || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      alert("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = jobs;

    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter);
    }

    if (techFilter !== "all") {
      result = result.filter((job) => job.assigned_tech_user_id === techFilter);
    }

    if (sourceFilter === "customer_portal") {
      result = result.filter((job) => isCustomerPortalJob(job.source));
    } else if (sourceFilter === "shop") {
      result = result.filter((job) => !isCustomerPortalJob(job.source));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((job) => {
        const customerName = `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.toLowerCase();
        const plate = (job.vehicle?.license_plate || "").toLowerCase();
        const vin = (job.vehicle?.vin || "").toLowerCase();
        const jobId = job.id.toLowerCase();
        return (
          customerName.includes(term) ||
          plate.includes(term) ||
          vin.includes(term) ||
          jobId.includes(term)
        );
      });
    }

    setFilteredJobs(result);
  }, [searchTerm, statusFilter, techFilter, sourceFilter, jobs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new_request":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "normal":
        return "bg-gray-100 text-gray-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDeleteJob = async (job: Job) => {
    const jobLabel = job.business_job_number || job.id.slice(0, 8);
    const customerName = `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim();
    const confirmed = window.confirm(
      `Delete job #${jobLabel}${customerName ? ` for ${customerName}` : ""}? This will also remove the linked estimate for this job and archive the deletion in the admin audit log.`
    );

    if (!confirmed) return;

    setDeletingJobId(job.id);

    try {
      await deleteJobWithRelatedRecords(job.id);

      setJobs((prev) => prev.filter((currentJob) => currentJob.id !== job.id));
      setFilteredJobs((prev) => prev.filter((currentJob) => currentJob.id !== job.id));
    } catch (error) {
      console.error("Error deleting job:", error);
      await fetchJobs();
      alert(error instanceof Error ? error.message : "Failed to delete job.");
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <div className="otg-manager-shell otg-theme-light otg-portal-page bg-transparent text-slate-950">
      <div className="otg-portal-page-inner">
        <div className="otg-page-header">
          <div className="otg-page-header-content">
            <h1>All jobs</h1>
            <p>
              Shop-created jobs and customer portal requests share this list; use the source filter to separate them.
            </p>
          </div>
          <div className="otg-page-header-actions">
            <BackToPortalButton />
            <Button
              variant="outline"
              className={headerActionButtonClassName}
              onClick={() => router.push("/manager/jobs")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Jobs menu
            </Button>
            <Button
              variant="outline"
              className={headerActionButtonClassName}
              onClick={() => router.push("/manager")}
            >
              Manager home
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

        <Card className="otg-jobs-filter-card">
          <CardContent className="p-4">
            <div className="otg-jobs-filter-grid">
              <div className="otg-jobs-search-wrap">
                <Search className="otg-jobs-search-icon" />
                <Input
                  placeholder="Search customer, plate, VIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent className={managerJobsSelectContentClassName}>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new_request">New Request</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Technician" />
                </SelectTrigger>
                <SelectContent className={managerJobsSelectContentClassName}>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Job source" />
                </SelectTrigger>
                <SelectContent className={managerJobsSelectContentClassName}>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="shop">Shop / manager</SelectItem>
                  <SelectItem value="customer_portal">Customer portal</SelectItem>
                </SelectContent>
              </Select>

              <div className="otg-jobs-filter-count">
                <Filter className="mr-2 h-4 w-4" />
                Showing {filteredJobs.length} of {jobs.length} jobs
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="bg-transparent p-12 text-center">
            <p className="text-slate-500">No jobs found matching your filters.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => {
              const c = job.customer;
              const nameFromParts = c && `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
              const customerLabel = nameFromParts || (c?.email?.trim() ? c.email.trim() : null);

              return (
                <Card
                  key={job.id}
                  className="cursor-pointer bg-transparent transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/manager/jobs/${job.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-semibold text-slate-900">
                          #{job.business_job_number || job.id.slice(0, 8)}
                          {customerLabel ? (
                            <span className="font-normal text-slate-600"> • {customerLabel}</span>
                          ) : null}
                        </CardTitle>
                        <p className="mt-1 text-sm text-slate-600">
                          {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}
                          {job.vehicle?.license_plate && (
                            <span className="ml-2 rounded px-2 py-0.5 font-mono text-xs bg-transparent">
                              Plate: {job.vehicle.license_plate}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isCustomerPortalJob(job.source)
                              ? "border-violet-300 bg-violet-50 text-violet-900"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          }
                        >
                          {formatJobSourceLabel(job.source)}
                        </Badge>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(job.priority)}>
                          {job.priority.toUpperCase()}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          disabled={deletingJobId === job.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleDeleteJob(job);
                          }}
                        >
                          {deletingJobId === job.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                      <div>
                        <span className="font-medium text-slate-700">Service:</span> {job.service_type}
                        {job.service_description && (
                          <p className="truncate text-slate-500">{job.service_description}</p>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Assigned To:</span>{" "}
                        {job.assigned_tech ? (
                          <span className="text-blue-600">
                            {`${job.assigned_tech.first_name ?? ""} ${job.assigned_tech.last_name ?? ""}`.trim() ||
                              job.assigned_tech.email}
                          </span>
                        ) : (
                          <span className="italic text-orange-600">Unassigned</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Requested:</span>{" "}
                        {job.requested_date ? new Date(job.requested_date).toLocaleDateString() : "N/A"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
