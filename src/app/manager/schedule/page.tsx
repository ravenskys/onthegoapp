"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";

type ScheduleJob = {
  id: string;
  status: string;
  priority: string;
  source: string | null;
  service_type: string;
  service_description: string | null;
  requested_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  service_duration_minutes: number | null;
  travel_time_minutes: number | null;
  service_location_name: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  business_job_number: string | null;
  assigned_tech_user_id: string | null;
  notes: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    year: string | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
    vin: string | null;
  } | null;
  assigned_tech: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

type TechnicianOption = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ScheduleBlock = {
  id: string;
  technician_user_id: string;
  block_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  title: string | null;
  notes: string | null;
  technician: TechnicianOption | null;
};

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "new_request", label: "New Request" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const parseDateOnly = (date: string) => new Date(`${date}T12:00:00`);

const getJobDateKey = (job: ScheduleJob) => {
  if (job.scheduled_start) {
    return toDateKey(new Date(job.scheduled_start));
  }

  return job.requested_date || null;
};

const getBlockDateKeys = (block: ScheduleBlock) => {
  const keys: string[] = [];
  const start = new Date(block.starts_at);
  const end = new Date(block.ends_at || block.starts_at);
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= endDate) {
    keys.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return keys;
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const formatJobTime = (job: ScheduleJob) => {
  if (!job.scheduled_start) {
    return job.requested_date ? "Requested date" : "Unscheduled";
  }

  const start = new Date(job.scheduled_start);
  const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (!job.scheduled_end) {
    return startLabel;
  }

  const end = new Date(job.scheduled_end);
  const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${startLabel} - ${endLabel}`;
};

const formatBlockTime = (block: ScheduleBlock) => {
  const start = new Date(block.starts_at);
  const end = new Date(block.ends_at);
  const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${startLabel} - ${endLabel}`;
};

const getCustomerName = (job: ScheduleJob) =>
  [job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ") ||
  "No customer";

const getVehicleLabel = (job: ScheduleJob) =>
  [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") ||
  "No vehicle";

const getServiceLocationLabel = (job: ScheduleJob) =>
  [
    job.service_location_name,
    job.service_address,
    [job.service_city, job.service_state, job.service_zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ") || "No service address";

const getTechName = (tech: ScheduleJob["assigned_tech"]) =>
  tech
    ? [tech.first_name, tech.last_name].filter(Boolean).join(" ") || tech.email || "Assigned tech"
    : "Unassigned";

const getTechnicianLabel = (tech: TechnicianOption) =>
  [tech.first_name, tech.last_name].filter(Boolean).join(" ") || tech.email || "Technician";

const getBlockTechnicianName = (block: ScheduleBlock) =>
  block.technician ? getTechnicianLabel(block.technician) : "Technician";

const getStatusStyles = (status: string) => {
  switch (status) {
    case "new_request":
      return "border-sky-200 bg-sky-100 text-sky-950";
    case "in_progress":
      return "border-amber-200 bg-amber-100 text-amber-950";
    case "completed":
      return "border-emerald-200 bg-emerald-100 text-emerald-950";
    case "cancelled":
      return "border-red-200 bg-red-100 text-red-950";
    case "draft":
      return "border-slate-200 bg-slate-100 text-slate-900";
    default:
      return "border-slate-200 bg-white text-slate-900";
  }
};

const formatStatusLabel = (status: string) => status.replaceAll("_", " ").toUpperCase();

const formatBlockTypeLabel = (blockType: string) =>
  blockType.replaceAll("_", " ").toUpperCase();

const getBlockStyles = (blockType: string) => {
  switch (blockType) {
    case "available":
      return "border-lime-300 bg-lime-100 text-lime-950";
    case "training":
      return "border-indigo-200 bg-indigo-100 text-indigo-950";
    case "pto":
      return "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-950";
    default:
      return "border-slate-300 bg-slate-100 text-slate-950";
  }
};

const buildCalendarDays = (monthDate: Date): CalendarDay[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);

    return {
      date,
      key,
      isCurrentMonth: date.getMonth() === month,
      isToday: key === todayKey,
    };
  });
};

export default function ManagerSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");

  useEffect(() => {
    const loadSchedule = async () => {
      try {
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

        const { data: techRoleRows, error: techRoleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "technician");

        if (techRoleError) throw techRoleError;

        const techIds = (techRoleRows || []).map((row) => row.user_id).filter(Boolean);
        const { data: techUsers, error: techUsersError } = techIds.length
          ? await supabase
              .from("profiles")
              .select("id, first_name, last_name, email")
              .in("id", techIds)
          : { data: [], error: null };

        if (techUsersError) throw techUsersError;

        const techById = new Map(
          (techUsers || []).map((tech) => [tech.id, tech as TechnicianOption]),
        );

        const [
          { data: jobsData, error: jobsError },
          { data: blockData, error: blockError },
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select(`
              *,
              customer:customers(first_name, last_name, email, phone),
              vehicle:vehicles(year, make, model, license_plate, vin)
            `)
            .order("scheduled_start", { ascending: true, nullsFirst: false })
            .order("requested_date", { ascending: true, nullsFirst: false }),
          supabase
            .from("technician_schedule_blocks")
            .select("*")
            .eq("status", "active")
            .order("starts_at", { ascending: true }),
        ]);

        if (jobsError) throw jobsError;
        if (blockError) throw blockError;

        setTechnicians((techUsers || []) as TechnicianOption[]);
        setJobs(
          (jobsData || []).map((job) => ({
            ...job,
            assigned_tech: job.assigned_tech_user_id
              ? techById.get(job.assigned_tech_user_id) || null
              : null,
          })) as ScheduleJob[],
        );
        setScheduleBlocks(
          (blockData || []).map((block) => ({
            ...block,
            technician: techById.get(block.technician_user_id) || null,
          })) as ScheduleBlock[],
        );
      } catch (error) {
        console.error("Failed to load manager schedule:", error);
        alert("Failed to load the schedule calendar.");
      } finally {
        setLoading(false);
      }
    };

    void loadSchedule();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesTech = techFilter === "all" || job.assigned_tech_user_id === techFilter;
      return matchesStatus && matchesTech;
    });
  }, [jobs, statusFilter, techFilter]);

  const filteredBlocks = useMemo(() => {
    return scheduleBlocks.filter((block) => {
      const matchesTech = techFilter === "all" || block.technician_user_id === techFilter;
      return block.status === "active" && matchesTech;
    });
  }, [scheduleBlocks, techFilter]);

  const scheduledJobs = useMemo(
    () => filteredJobs.filter((job) => getJobDateKey(job)),
    [filteredJobs],
  );

  const unscheduledJobs = useMemo(
    () => filteredJobs.filter((job) => !getJobDateKey(job)),
    [filteredJobs],
  );

  const jobsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleJob[]>();

    scheduledJobs.forEach((job) => {
      const key = getJobDateKey(job);
      if (!key) return;
      grouped.set(key, [...(grouped.get(key) || []), job]);
    });

    return grouped;
  }, [scheduledJobs]);

  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleBlock[]>();

    filteredBlocks.forEach((block) => {
      getBlockDateKeys(block).forEach((key) => {
        grouped.set(key, [...(grouped.get(key) || []), block]);
      });
    });

    return grouped;
  }, [filteredBlocks]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedJobs = jobsByDate.get(selectedDateKey) || [];
  const selectedBlocks = blocksByDate.get(selectedDateKey) || [];
  const monthJobCount = calendarDays
    .filter((day) => day.isCurrentMonth)
    .reduce((count, day) => count + (jobsByDate.get(day.key)?.length || 0), 0);
  const monthBlockCount = calendarDays
    .filter((day) => day.isCurrentMonth)
    .reduce((count, day) => count + (blocksByDate.get(day.key)?.length || 0), 0);

  const selectedDateLabel = parseDateOnly(selectedDateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const goToMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(toDateKey(today));
  };

  if (loading || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-theme-light min-h-screen bg-[#eef3e8] p-4 text-slate-950 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="otg-surface-dark overflow-hidden rounded-[2rem] bg-[#10180f] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-lime-300/40 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-lime-200">
                <CalendarDays className="h-4 w-4" />
                Scheduling Calendar
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                Plan the shop day without losing sight of the week.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                View scheduled jobs, requested service dates, technician assignment, and unscheduled work from one manager calendar.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <PortalTopNav section="manager" />
              <div className="flex flex-wrap gap-3">
                <BackToPortalButton />
                <Button
                  type="button"
                  className={headerActionButtonClassName}
                  onClick={() => window.location.href = "/manager/jobs"}
                >
                  New Job
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm font-semibold text-slate-600">This Month</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{monthJobCount}</div>
              <div className="mt-1 text-sm text-slate-500">dated jobs in view</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm font-semibold text-slate-600">Employee Availability</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{monthBlockCount}</div>
              <div className="mt-1 text-sm text-slate-500">availability blocks in view</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm font-semibold text-slate-600">Selected Day</div>
              <div className="mt-2 text-3xl font-black text-slate-950">
                {selectedJobs.length + selectedBlocks.length}
              </div>
              <div className="mt-1 text-sm text-slate-500">calendar items on {selectedDateLabel}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => goToMonth(-1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button type="button" variant="outline" onClick={goToToday}>
                  Today
                </Button>
                <Button type="button" variant="outline" onClick={() => goToMonth(1)}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <div className="ml-0 text-2xl font-black text-slate-950 sm:ml-3">
                  {formatMonthTitle(visibleMonth)}
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-full bg-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="h-11 w-full bg-white">
                  <SelectValue placeholder="Filter by tech" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {getTechnicianLabel(tech)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.7fr)]">
          <Card className="min-w-0 overflow-hidden border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700">
                <span className="rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-sky-950">Jobs</span>
                <span className="rounded-full border border-lime-300 bg-lime-100 px-3 py-1 text-lime-950">Available</span>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-950">Unavailable / Other</span>
              </div>
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-950 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-lime-200 sm:text-xs">
                {weekdayLabels.map((day) => (
                  <div key={day} className="px-1 py-3">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dayJobs = jobsByDate.get(day.key) || [];
                  const dayBlocks = blocksByDate.get(day.key) || [];
                  const visibleItems = [
                    ...dayJobs.slice(0, 2).map((job) => ({ type: "job" as const, job })),
                    ...dayBlocks.slice(0, 2).map((block) => ({ type: "block" as const, block })),
                  ].slice(0, 3);
                  const hiddenItemCount = dayJobs.length + dayBlocks.length - visibleItems.length;
                  const isSelected = day.key === selectedDateKey;

                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDateKey(day.key)}
                      className={`min-h-[7.25rem] border-b border-r border-slate-200 p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[9rem] sm:p-2.5 ${
                        isSelected
                          ? "bg-lime-100 ring-2 ring-inset ring-lime-500"
                          : day.isCurrentMonth
                            ? "bg-white hover:bg-slate-50"
                            : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
                            day.isToday ? "bg-slate-950 text-white" : "text-slate-950"
                          }`}
                        >
                          {day.date.getDate()}
                        </span>
                        {dayJobs.length + dayBlocks.length > 0 && (
                          <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {dayJobs.length + dayBlocks.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        {visibleItems.map((item) =>
                          item.type === "job" ? (
                            <div
                              key={`job-${item.job.id}`}
                              className={`truncate rounded-lg border px-1.5 py-1 text-[10px] font-bold leading-tight sm:text-xs ${getStatusStyles(item.job.status)}`}
                            >
                              {formatJobTime(item.job)} {getCustomerName(item.job)}
                            </div>
                          ) : (
                            <div
                              key={`block-${item.block.id}`}
                              className={`truncate rounded-lg border px-1.5 py-1 text-[10px] font-bold leading-tight sm:text-xs ${getBlockStyles(item.block.block_type)}`}
                            >
                              {formatBlockTime(item.block)} {getBlockTechnicianName(item.block)}
                            </div>
                          )
                        )}
                        {hiddenItemCount > 0 && (
                          <div className="text-[10px] font-bold text-slate-600">
                            +{hiddenItemCount} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-6">
            <Card className="min-w-0 border-0 bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Employee Availability</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage regular weekly hours and exceptions from the dedicated availability page.
                    This calendar will update from the same schedule blocks.
                  </p>
                </div>
                <Link
                  href="/manager/availability"
                  className="block rounded-2xl border border-lime-300 bg-lime-100 p-4 font-black text-lime-950 transition hover:border-lime-500 hover:bg-lime-200"
                >
                  Open Employee Availability
                </Link>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-0 bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-black text-slate-950">{selectedDateLabel}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedJobs.length || selectedBlocks.length
                      ? "Jobs and availability for this day."
                      : "No calendar items planned for this day."}
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedBlocks.map((block) => (
                    <div
                      key={block.id}
                      className={`rounded-2xl border p-4 ${getBlockStyles(block.block_type)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-950">
                            {block.title || formatBlockTypeLabel(block.block_type)}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {getBlockTechnicianName(block)}
                          </div>
                        </div>
                        <Badge className={getBlockStyles(block.block_type)}>
                          {formatBlockTypeLabel(block.block_type)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex gap-2 text-sm text-slate-700">
                        <Clock className="mt-0.5 h-4 w-4 text-slate-500" />
                        <span>{formatBlockTime(block)}</span>
                      </div>
                      {block.notes && (
                        <div className="mt-2 text-sm text-slate-700">{block.notes}</div>
                      )}
                    </div>
                  ))}

                  {selectedJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/manager/jobs/${job.id}`}
                      className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-lime-400 hover:bg-lime-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-950">
                            #{job.business_job_number || job.id.slice(0, 8)}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {getCustomerName(job)}
                          </div>
                        </div>
                        <Badge className={getStatusStyles(job.status)}>{formatStatusLabel(job.status)}</Badge>
                      </div>
                      {job.source === "customer_portal" && (
                        <div className="mt-3">
                          <Badge className="border-lime-300 bg-lime-100 text-lime-950">
                            Customer Scheduled
                          </Badge>
                        </div>
                      )}
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="flex gap-2">
                          <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{formatJobTime(job)}</span>
                        </div>
                        <div className="flex gap-2">
                          <UserRound className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{getTechName(job.assigned_tech)}</span>
                        </div>
                        <div className="flex gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{getVehicleLabel(job)}</span>
                        </div>
                        {(job.service_address || job.service_location_name) && (
                          <div className="flex gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                            <span>{getServiceLocationLabel(job)}</span>
                          </div>
                        )}
                        {(job.service_duration_minutes || job.travel_time_minutes) && (
                          <div className="flex gap-2">
                            <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                            <span>
                              {job.service_duration_minutes ?? 0} min service
                              {job.travel_time_minutes
                                ? ` + ${job.travel_time_minutes} min travel`
                                : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}

                  {selectedJobs.length === 0 && selectedBlocks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                      Pick a date with a count badge, schedule a job, or manage employee availability.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-0 bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Unscheduled Queue</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Jobs with no requested date or scheduled start.
                  </p>
                </div>

                <div className="space-y-3">
                  {unscheduledJobs.slice(0, 8).map((job) => (
                    <Link
                      key={job.id}
                      href={`/manager/jobs/${job.id}`}
                      className="block rounded-2xl border border-slate-200 p-4 transition hover:border-lime-400 hover:bg-lime-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-950">
                            #{job.business_job_number || job.id.slice(0, 8)}
                          </div>
                          <div className="text-sm text-slate-600">{getCustomerName(job)}</div>
                        </div>
                        <Badge className={getStatusStyles(job.status)}>{formatStatusLabel(job.status)}</Badge>
                      </div>
                    </Link>
                  ))}

                  {unscheduledJobs.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Every filtered job has a date.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
