"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Loader2, RefreshCw, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

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

type WeeklyScheduleDay = {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
};

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const parseDateOnly = (date: string) => new Date(`${date}T12:00:00`);

const toTimeInputValue = (dateValue: string) => {
  const date = new Date(dateValue);
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
};

const getDefaultRangeEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 89);
  return toDateKey(date);
};

const createDefaultWeeklySchedule = (): WeeklyScheduleDay[] =>
  weekdayOptions.map((day) => ({
    weekday: day.value,
    enabled: day.value >= 1 && day.value <= 5,
    start: "08:00",
    end: "17:00",
  }));

const getTechnicianLabel = (tech: TechnicianOption) =>
  [tech.first_name, tech.last_name].filter(Boolean).join(" ") || tech.email || "Technician";

const isBlockInRange = (block: ScheduleBlock, techId: string, startDate: Date, endExclusive: Date) => {
  const startsAt = new Date(block.starts_at);

  return (
    block.status === "active" &&
    block.technician_user_id === techId &&
    block.block_type === "available" &&
    startsAt >= startDate &&
    startsAt < endExclusive
  );
};

export default function ManagerAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [rangeStart, setRangeStart] = useState(() => toDateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState(getDefaultRangeEndDate);
  const [weeklyScheduleDays, setWeeklyScheduleDays] = useState<WeeklyScheduleDay[]>(
    createDefaultWeeklySchedule,
  );
  const [scheduleTitle, setScheduleTitle] = useState("Regular weekly schedule");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        setCurrentUserId(user.id);

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

        const technicianList = (techUsers || []) as TechnicianOption[];
        const techById = new Map(technicianList.map((tech) => [tech.id, tech]));

        const { data: blockData, error: blockError } = await supabase
          .from("technician_schedule_blocks")
          .select("*")
          .eq("status", "active")
          .order("starts_at", { ascending: true });

        if (blockError) throw blockError;

        setTechnicians(technicianList);
        setSelectedTechId((current) => current || technicianList[0]?.id || "");
        setScheduleBlocks(
          (blockData || []).map((block) => ({
            ...block,
            technician: techById.get(block.technician_user_id) || null,
          })) as ScheduleBlock[],
        );
      } catch (error) {
        console.error("Failed to load employee availability:", error);
        alert("Failed to load employee availability.");
      } finally {
        setLoading(false);
      }
    };

    void loadAvailability();
  }, []);

  const selectedTechnician = technicians.find((tech) => tech.id === selectedTechId) || null;
  const rangeDates = useMemo(() => {
    const startDate = parseDateOnly(rangeStart);
    const endDate = parseDateOnly(rangeEnd);
    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    return { startDate, endDate, endExclusive };
  }, [rangeEnd, rangeStart]);

  const selectedEmployeeBlocks = useMemo(() => {
    if (!selectedTechId || !rangeStart || !rangeEnd) return [];

    return scheduleBlocks.filter((block) =>
      isBlockInRange(block, selectedTechId, rangeDates.startDate, rangeDates.endExclusive),
    );
  }, [rangeDates, rangeEnd, rangeStart, scheduleBlocks, selectedTechId]);

  const weeklySummary = useMemo(() => {
    const grouped = new Map<number, ScheduleBlock[]>();

    selectedEmployeeBlocks.forEach((block) => {
      const weekday = new Date(block.starts_at).getDay();
      grouped.set(weekday, [...(grouped.get(weekday) || []), block]);
    });

    return weekdayOptions.map((weekday) => ({
      ...weekday,
      count: grouped.get(weekday.value)?.length || 0,
      sample: grouped.get(weekday.value)?.[0] || null,
    }));
  }, [selectedEmployeeBlocks]);

  const toggleWeeklyScheduleDay = (weekday: number) => {
    setWeeklyScheduleDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, enabled: !day.enabled } : day,
      ),
    );
  };

  const updateWeeklyScheduleDay = (
    weekday: number,
    key: "start" | "end",
    value: string,
  ) => {
    setWeeklyScheduleDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, [key]: value } : day,
      ),
    );
  };

  const applyStandardWeeklyHours = (start: string, end: string) => {
    setWeeklyScheduleDays((current) =>
      current.map((day) => (day.enabled ? { ...day, start, end } : day)),
    );
  };

  const loadExistingPattern = () => {
    setWeeklyScheduleDays((current) =>
      current.map((day) => {
        const existingDay = weeklySummary.find((summary) => summary.value === day.weekday);

        return existingDay?.sample
          ? {
              ...day,
              enabled: true,
              start: toTimeInputValue(existingDay.sample.starts_at),
              end: toTimeInputValue(existingDay.sample.ends_at),
            }
          : { ...day, enabled: false };
      }),
    );
  };

  const validateRange = () => {
    if (!selectedTechId) {
      alert("Choose an employee first.");
      return false;
    }

    if (!rangeStart || !rangeEnd) {
      alert("Choose a start date and end date.");
      return false;
    }

    if (rangeDates.endDate < rangeDates.startDate) {
      alert("The end date must be after the start date.");
      return false;
    }

    return true;
  };

  const buildRegularScheduleRows = () => {
    const enabledDays = weeklyScheduleDays.filter((day) => day.enabled);

    if (enabledDays.length === 0) {
      alert("Turn on at least one working day.");
      return null;
    }

    const rows = [];
    const cursor = new Date(rangeDates.startDate);

    while (cursor <= rangeDates.endDate) {
      const scheduleDay = enabledDays.find((day) => day.weekday === cursor.getDay());

      if (scheduleDay) {
        const dateKey = toDateKey(cursor);
        const startsAt = new Date(`${dateKey}T${scheduleDay.start}`);
        const endsAt = new Date(`${dateKey}T${scheduleDay.end}`);

        if (endsAt <= startsAt) {
          const weekdayLabel = weekdayOptions.find((day) => day.value === scheduleDay.weekday)?.label;
          alert(`${weekdayLabel || "A selected day"} end time must be after start time.`);
          return null;
        }

        rows.push({
          technician_user_id: selectedTechId,
          block_type: "available",
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          title: scheduleTitle.trim() || "Regular weekly schedule",
          notes: scheduleNotes.trim() || null,
          created_by_user_id: currentUserId,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (rows.length === 0) {
      alert("No dates match the enabled workdays in this range.");
      return null;
    }

    return rows;
  };

  const clearRegularScheduleRange = async (skipConfirm = false) => {
    if (!validateRange()) return [];

    if (selectedEmployeeBlocks.length === 0) {
      if (!skipConfirm) {
        alert("There is no regular availability to clear for that employee and date range.");
      }
      return [];
    }

    if (!skipConfirm) {
      const confirmed = window.confirm(
        `Clear ${selectedEmployeeBlocks.length} regular availability block(s) for ${selectedTechnician ? getTechnicianLabel(selectedTechnician) : "this employee"}?`,
      );

      if (!confirmed) return [];
    }

    const { data, error } = await supabase
      .from("technician_schedule_blocks")
      .update({ status: "inactive" })
      .eq("technician_user_id", selectedTechId)
      .eq("status", "active")
      .eq("block_type", "available")
      .gte("starts_at", rangeDates.startDate.toISOString())
      .lt("starts_at", rangeDates.endExclusive.toISOString())
      .select("id");

    if (error) throw error;

    const removedIds = new Set((data || []).map((block) => block.id));
    setScheduleBlocks((prev) => prev.filter((block) => !removedIds.has(block.id)));

    return [...removedIds];
  };

  const handleClearRegularSchedule = async () => {
    setClearing(true);

    try {
      const removedIds = await clearRegularScheduleRange();
      if (removedIds.length > 0) {
        alert(`Cleared ${removedIds.length} availability block(s).`);
      }
    } catch (error) {
      console.error("Failed to clear regular availability:", error);
      alert("Failed to clear employee availability.");
    } finally {
      setClearing(false);
    }
  };

  const handleSaveRegularSchedule = async () => {
    if (!validateRange()) return;

    const rows = buildRegularScheduleRows();
    if (!rows) return;

    const confirmed = selectedEmployeeBlocks.length
      ? window.confirm(
          `Replace ${selectedEmployeeBlocks.length} existing regular availability block(s) in this range with ${rows.length} new block(s)?`,
        )
      : true;

    if (!confirmed) return;

    setSaving(true);

    try {
      await clearRegularScheduleRange(true);

      const { data, error } = await supabase
        .from("technician_schedule_blocks")
        .insert(rows)
        .select();

      if (error) throw error;

      setScheduleBlocks((prev) => [
        ...prev,
        ...((data || []).map((block) => ({
          ...block,
          technician: selectedTechnician,
        })) as ScheduleBlock[]),
      ]);

      alert(`Saved ${rows.length} regular availability block(s). The schedule calendar is updated.`);
    } catch (error) {
      console.error("Failed to save regular availability:", error);
      alert("Failed to save employee availability.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                <CalendarClock className="h-4 w-4" />
                Employee Availability
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Employee Availability
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Save or update an employee&apos;s normal working hours across a date range. The scheduling calendar reads these same availability blocks.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <PortalTopNav section="manager" />
              <div className="flex flex-wrap gap-3">
                <BackToPortalButton />
                <Button
                  type="button"
                  className={headerActionButtonClassName}
                  onClick={() => window.location.href = "/manager/schedule"}
                >
                  Open Calendar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardContent className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                    Employee
                  </label>
                  <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                    <SelectTrigger className="h-12 w-full bg-white">
                      <SelectValue placeholder="Choose employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {getTechnicianLabel(tech)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="space-y-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                  Start Date
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950"
                  />
                </label>

                <label className="space-y-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                  End Date
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <input
                  type="text"
                  value={scheduleTitle}
                  onChange={(event) => setScheduleTitle(event.target.value)}
                  placeholder="Schedule title"
                  className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950"
                />
                <input
                  type="text"
                  value={scheduleNotes}
                  onChange={(event) => setScheduleNotes(event.target.value)}
                  placeholder="Optional schedule notes"
                  className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950"
                />
              </div>

              <div className="rounded-[1.5rem] border border-lime-200 bg-lime-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Weekly Hours</h2>
                    <p className="mt-1 text-sm text-slate-700">
                      Turn on the days this employee normally works, then set each day&apos;s hours.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl bg-white text-slate-950"
                      onClick={() => applyStandardWeeklyHours("08:00", "17:00")}
                    >
                      8-5
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl bg-white text-slate-950"
                      onClick={() => applyStandardWeeklyHours("09:00", "18:00")}
                    >
                      9-6
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl bg-white text-slate-950"
                      onClick={loadExistingPattern}
                      disabled={selectedEmployeeBlocks.length === 0}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Load Current
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {weeklyScheduleDays.map((day) => {
                    const weekday = weekdayOptions.find((option) => option.value === day.weekday);

                    return (
                      <div
                        key={day.weekday}
                        className={`grid gap-3 rounded-2xl border p-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)] md:items-center ${
                          day.enabled
                            ? "border-lime-300 bg-white"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleWeeklyScheduleDay(day.weekday)}
                          className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            day.enabled
                              ? "border-lime-600 bg-lime-300 text-black"
                              : "border-slate-300 bg-white text-slate-700 hover:border-lime-400"
                          }`}
                        >
                          {weekday?.label || "Day"} {day.enabled ? "Working" : "Off"}
                        </button>
                        <label className="space-y-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          Start
                          <input
                            type="time"
                            value={day.start}
                            onChange={(event) =>
                              updateWeeklyScheduleDay(day.weekday, "start", event.target.value)
                            }
                            disabled={!day.enabled}
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </label>
                        <label className="space-y-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                          End
                          <input
                            type="time"
                            value={day.end}
                            onChange={(event) =>
                              updateWeeklyScheduleDay(day.weekday, "end", event.target.value)
                            }
                            disabled={!day.enabled}
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="min-h-11 rounded-2xl bg-lime-500 px-5 text-black hover:bg-lime-400"
                  onClick={handleSaveRegularSchedule}
                  disabled={saving || clearing}
                >
                  {saving ? "Saving Schedule..." : "Save Weekly Schedule"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-2xl border-red-300 bg-white px-5 text-red-700 hover:bg-red-50"
                  onClick={handleClearRegularSchedule}
                  disabled={saving || clearing || selectedEmployeeBlocks.length === 0}
                >
                  {clearing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {clearing ? "Clearing..." : "Clear Employee Availability"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Current Range</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedTechnician
                      ? `${getTechnicianLabel(selectedTechnician)} has ${selectedEmployeeBlocks.length} regular availability block(s) in this range.`
                      : "Choose an employee to see availability."}
                  </p>
                </div>

                <div className="space-y-3">
                  {weeklySummary.map((day) => (
                    <div key={day.value} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-950">{day.label}</div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                          {day.count} block{day.count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 text-sm text-slate-600">
                        <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span>
                          {day.sample
                            ? `${toTimeInputValue(day.sample.starts_at)} - ${toTimeInputValue(day.sample.ends_at)}`
                            : "No regular availability"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/manager/schedule"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  View Calendar
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-slate-950">
                  <UserRound className="h-5 w-5" />
                  <h2 className="text-xl font-bold">How This Updates Calendar</h2>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  The schedule calendar displays rows from `technician_schedule_blocks`. Saving a weekly schedule here replaces the employee&apos;s active regular availability in the selected range, then creates fresh blocks for the new weekly hours.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
