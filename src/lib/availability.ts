import { Temporal } from "@js-temporal/polyfill";
import type { DashboardData, WeeklyAvailability } from "./models";

export const weekdays = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];
type Interval = { start: number; end: number };
export type AvailabilityBand = {
  date: string;
  start: string;
  end: string;
  cleanerIds: string[];
  count: number;
};
const zone = "Europe/London";
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Project wall-clock hours onto each constant-offset part of a London day.
 * Missing spring hours contribute no time; repeated autumn hours both contribute.
 */
export function londonWorkingIntervals(
  date: string,
  slot: WeeklyAvailability,
): Interval[] {
  const day = Temporal.PlainDate.from(date);
  let part = day.toZonedDateTime(zone);
  const dayEnd = day.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds;
  const midnight = Date.parse(date + "T00:00:00Z");
  const result: Interval[] = [];
  while (part.epochMilliseconds < dayEnd) {
    const transition = part.getTimeZoneTransition("next");
    const partEnd = Math.min(dayEnd, transition?.epochMilliseconds ?? dayEnd);
    const offset = part.offsetNanoseconds / 1_000_000;
    const start = Math.max(
      part.epochMilliseconds,
      midnight + minutes(slot.start_time) * 60_000 - offset,
    );
    const end = Math.min(
      partEnd,
      midnight + minutes(slot.end_time) * 60_000 - offset,
    );
    if (start < end) result.push({ start, end });
    part =
      Temporal.Instant.fromEpochMilliseconds(partEnd).toZonedDateTimeISO(zone);
  }
  return result;
}
function merge(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && interval.start <= last.end)
      last.end = Math.max(last.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}
function subtract(intervals: Interval[], busy: Interval[]): Interval[] {
  let free = intervals;
  for (const block of busy) {
    free = free.flatMap((slot) => {
      if (block.end <= slot.start || block.start >= slot.end) return [slot];
      const pieces: Interval[] = [];
      if (block.start > slot.start)
        pieces.push({ start: slot.start, end: block.start });
      if (block.end < slot.end)
        pieces.push({ start: block.end, end: slot.end });
      return pieces;
    });
  }
  return free;
}

export function freeAvailabilityBands(
  data: Pick<
    DashboardData,
    "cleaners" | "availability" | "visits" | "leave_requests"
  >,
  selectedIds: string[],
  range: { start: string; end: string },
): AvailabilityBand[] {
  const start = Temporal.Instant.from(range.start);
  const end = Temporal.Instant.from(range.end);
  if (Temporal.Instant.compare(start, end) >= 0) return [];
  const selected = new Set(selectedIds);
  const cleaners = data.cleaners.filter((c) => c.active && selected.has(c.id));
  const lastDay = end
    .subtract({ milliseconds: 1 })
    .toZonedDateTimeISO(zone)
    .toPlainDate();
  const bands: AvailabilityBand[] = [];
  for (
    let day = start.toZonedDateTimeISO(zone).toPlainDate();
    Temporal.PlainDate.compare(day, lastDay) <= 0;
    day = day.add({ days: 1 })
  ) {
    const date = day.toString();
    const weekday = day.dayOfWeek % 7;
    const freeByCleaner = cleaners.map((cleaner) => {
      if (
        data.leave_requests.some(
          (leave) =>
            leave.cleaner_id === cleaner.id &&
            leave.status === "approved" &&
            leave.starts_on! <= date &&
            leave.ends_on! >= date,
        )
      ) {
        return { id: cleaner.id, intervals: [] as Interval[] };
      }
      const working = merge(
        data.availability
          .filter(
            (slot) =>
              slot.cleaner_id === cleaner.id && slot.weekday === weekday,
          )
          .flatMap((slot) => londonWorkingIntervals(date, slot)),
      )
        .map((slot) => ({
          start: Math.max(slot.start, start.epochMilliseconds),
          end: Math.min(slot.end, end.epochMilliseconds),
        }))
        .filter((slot) => slot.start < slot.end);
      const busy = data.visits
        .filter((v) => v.cleaner_id === cleaner.id && v.status !== "cancelled")
        .map((v) => ({
          start: Date.parse(v.starts_at),
          end: Date.parse(v.ends_at),
        }));
      return { id: cleaner.id, intervals: subtract(working, busy) };
    });
    const points = [
      ...new Set(
        freeByCleaner.flatMap((c) =>
          c.intervals.flatMap((slot) => [slot.start, slot.end]),
        ),
      ),
    ].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const cleanerIds = freeByCleaner
        .filter((c) =>
          c.intervals.some(
            (slot) => slot.start <= points[i] && slot.end >= points[i + 1],
          ),
        )
        .map((c) => c.id)
        .sort();
      if (!cleanerIds.length) continue;
      const bandStart = new Date(points[i]).toISOString();
      const bandEnd = new Date(points[i + 1]).toISOString();
      const previous = bands.at(-1);
      if (
        previous?.date === date &&
        previous.end === bandStart &&
        previous.cleanerIds.join() === cleanerIds.join()
      )
        previous.end = bandEnd;
      else
        bands.push({
          date,
          start: bandStart,
          end: bandEnd,
          cleanerIds,
          count: cleanerIds.length,
        });
    }
  }
  return bands;
}
export const availabilityColour = (count: number) =>
  `rgba(34, 153, 85, ${Math.min(0.65, 1 - Math.pow(0.86, count)).toFixed(3)})`;
