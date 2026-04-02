"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Filter } from "lucide-react";

// Types matching your DB schema
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

export default function ManagerJobsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [technicians, setTechnicians] = useState<any[]>([]);

  // 1. Auth Check
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0 || (!roles.some(r => r.role === "manager" || r.role === "admin"))) {
        window.location.href = "/portal";
        return;
      }

      setAuthorized(true);
      fetchJobs();
    };
    checkAccess();
  }, []);

  // 2. Fetch Jobs & Technicians
  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Fetch Jobs with joins
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

          return { ...job, assigned_tech };
        })
      );

      // Fetch Technicians for filter dropdown
      const { data: techData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technician");

      if (techData) {
        const techIds = techData.map(t => t.user_id);
        const { data: techUsers } = await supabase
          .from("auth.users")
          .select("id, email")
          .in("id", techIds);
        setTechnicians(techUsers || []);
      }

      setJobs(enrichedJobs || []);
      setFilteredJobs(enrichedJobs || []);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      alert("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Filter Logic
  useEffect(() => {
    let result = jobs;

    // Status Filter
    if (statusFilter !== "all") {
      result = result.filter(job => job.status === statusFilter);
    }

    // Tech Filter
    if (techFilter !== "all") {
      result = result.filter(job => job.assigned_tech_user_id === techFilter);
    }

    // Search Filter (Customer Name, Plate, VIN, Job ID)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(job => {
        const customerName = `${job.customer?.first_name || ""} ${job.customer?.last_name || ""}`.toLowerCase();
        const plate = (job.vehicle?.license_plate || "").toLowerCase();
        const vin = (job.vehicle?.vin || "").toLowerCase();
        const jobId = job.id.toLowerCase();
        return customerName.includes(term) || plate.includes(term) || vin.includes(term) || jobId.includes(term);
      });
    }

    setFilteredJobs(result);
  }, [searchTerm, statusFilter, techFilter, jobs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new_request": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "normal": return "bg-gray-100 text-gray-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Jobs Dashboard</h1>
            <p className="text-slate-600 mt-1">Manage service requests, assignments, and workflow.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.href = "/manager"}>
              Back to Manager Home
            </Button>
            <Button onClick={() => window.location.href = "/manager/jobs/new"}>
              <Plus className="mr-2 h-4 w-4" /> New Job
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                <SelectContent>
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
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center text-sm text-slate-500">
                <Filter className="mr-2 h-4 w-4" />
                Showing {filteredJobs.length} of {jobs.length} jobs
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-slate-500">No jobs found matching your filters.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = `/manager/jobs/${job.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        #{job.business_job_number || job.id.slice(0, 8)} • {job.customer?.first_name} {job.customer?.last_name}
                      </CardTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model} 
                        {job.vehicle?.license_plate && <span className="ml-2 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">Plate: {job.vehicle.license_plate}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ").toUpperCase()}</Badge>
                      <Badge variant="outline" className={getPriorityColor(job.priority)}>{job.priority.toUpperCase()}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">Service:</span> {job.service_type}
                      {job.service_description && <p className="text-slate-500 truncate">{job.service_description}</p>}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Assigned To:</span>{" "}
                      {job.assigned_tech ? (
                        <span className="text-blue-600">
                          {`${job.assigned_tech.first_name ?? ""} ${job.assigned_tech.last_name ?? ""}`.trim() ||
                            job.assigned_tech.email}
                        </span>
                      ) : (
                        <span className="text-orange-600 italic">Unassigned</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Requested:</span>{" "}
                      {job.requested_date ? new Date(job.requested_date).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}