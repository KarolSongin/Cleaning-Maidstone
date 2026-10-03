import { Temporal } from "@js-temporal/polyfill";
import type { DashboardData, RequestRecord, Visit } from "./models";
import { freeAvailabilityBands } from "./availability";

/** Leave dates are inclusive London dates, matching the booking/approval rules. */
export function visitsNeedingCover(request: RequestRecord, visits: Visit[]) {
  if (!request.starts_on || !request.ends_on) return [];
  return visits
    .filter((visit) => {
      if (
        visit.cleaner_id !== request.cleaner_id ||
        !["scheduled", "started"].includes(visit.status)
      )
        return false;
      const date = Temporal.Instant.from(visit.starts_at)
        .toZonedDateTimeISO("Europe/London")
        .toPlainDate()
        .toString();
      return date >= request.starts_on! && date <= request.ends_on!;
    })
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.id.localeCompare(b.id),
    );
}

export function pendingLeaveCover(requests: RequestRecord[], visits: Visit[]) {
  const pending = requests.filter((request) => request.status === "pending");
  return {
    requests: pending.length,
    visits: new Set(
      pending.flatMap((r) => visitsNeedingCover(r, visits).map((v) => v.id)),
    ).size,
  };
}

/** Require uninterrupted free time for the entire visit, using the calendar's
 * London/DST projection plus the working-period rule enforced by booking saves.
 */
export function availableCoverCleaners(
  data: Pick<
    DashboardData,
    "cleaners" | "availability" | "visits" | "leave_requests"
  >,
  visit: Visit,
) {
  const start = Temporal.Instant.from(visit.starts_at);
  const end = Temporal.Instant.from(visit.ends_at);
  if (Temporal.Instant.compare(start, end) >= 0) return [];
  const localStart = start.toZonedDateTimeISO("Europe/London");
  const localEnd = end.toZonedDateTimeISO("Europe/London");
  // Visits must fit a single London day and working period, as in validate_visit.
  if (!localStart.toPlainDate().equals(localEnd.toPlainDate())) return [];
  const candidates = data.cleaners.filter(
    (cleaner) =>
      cleaner.active &&
      cleaner.id !== visit.cleaner_id &&
      data.availability.some(
        (slot) =>
          slot.cleaner_id === cleaner.id &&
          slot.weekday === localStart.dayOfWeek % 7 &&
          Temporal.PlainTime.compare(
            Temporal.PlainTime.from(slot.start_time),
            localStart.toPlainTime(),
          ) <= 0 &&
          Temporal.PlainTime.compare(
            Temporal.PlainTime.from(slot.end_time),
            localEnd.toPlainTime(),
          ) >= 0,
      ),
  );
  if (!candidates.length) return [];
  const bands = freeAvailabilityBands(
    data,
    candidates.map((c) => c.id),
    { start: visit.starts_at, end: visit.ends_at },
  );
  const coveredUntil = new Map(
    candidates.map((c) => [c.id, start.epochMilliseconds]),
  );
  for (const band of bands) {
    const bandStart = Date.parse(band.start),
      bandEnd = Date.parse(band.end);
    for (const id of band.cleanerIds) {
      const covered = coveredUntil.get(id)!;
      // Do not bridge a gap. Another cleaner joining/leaving a band may split
      // the calendar shading without interrupting this cleaner's availability.
      if (bandStart <= covered)
        coveredUntil.set(id, Math.max(covered, bandEnd));
    }
  }
  return candidates
    .filter((c) => coveredUntil.get(c.id)! >= end.epochMilliseconds)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en-GB") || a.id.localeCompare(b.id),
    );
}
