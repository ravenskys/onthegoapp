/**
 * Shared helpers for customer and manager scheduling UIs (availability RPC + fallbacks).
 */

export type AvailableSlot = {
  technician_user_id: string;
  starts_at: string;
  ends_at: string;
  travel_time_minutes: number | null;
};

export type ScheduleBlock = {
  technician_user_id: string;
  starts_at: string;
  ends_at: string;
};

/** Extra on-site staging / customer handoff time before wrench time. */
export const PRE_SERVICE_STAGING_MINUTES = 20;

export const padDatePart = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const parseDateOnly = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

export const formatDayLabel = (dateKey: string) =>
  parseDateOnly(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const formatSlotTime = (slot: AvailableSlot) => {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);

  return `${start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

export const getSlotKey = (slot: AvailableSlot) =>
  `${slot.technician_user_id}-${slot.starts_at}-${slot.ends_at}`;

/** Rolling 21-day window starting today (local midnight). */
export const getSchedulerDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 21);

  return { start, end };
};

export const buildSlotsFromScheduleBlocks = (
  blocks: ScheduleBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  slotMinutes: number,
  defaultTravelMinutes = 30,
): AvailableSlot[] => {
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
        travel_time_minutes: defaultTravelMinutes,
      });

      slotStart.setTime(slotStart.getTime() + slotMs);
    }
  });

  return nextSlots.sort(
    (first, second) =>
      new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
  );
};
