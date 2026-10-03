import { Temporal } from "@js-temporal/polyfill";
import type { BookingSeries, DashboardData } from "./models";

export function bookingPeriod(start: string, weeks: number, interval: 1 | 2) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)
    throw new Error("Choose a booking period between 1 and 52 weeks");
  const date = Temporal.PlainDate.from(start);
  const occurrences = Math.ceil(weeks / interval);
  return {
    occurrences,
    ends_on: date.add({ weeks }).subtract({ days: 1 }).toString(),
    last_visit_on: date.add({ weeks: (occurrences - 1) * interval }).toString(),
  };
}
export const londonToday = () =>
  Temporal.Now.plainDateISO("Europe/London").toString();
export const calendarDate = (date: string) =>
  Temporal.PlainDate.from(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export type RecurringStatus =
  "ending-soon" | "active" | "upcoming" | "ended" | "cancelled";
export function recurringSummary(
  series: BookingSeries,
  visits: DashboardData["visits"],
  today: string,
) {
  const end = Temporal.PlainDate.from(series.ends_on);
  const followUpOn = end.subtract({ months: 1 }).toString();
  const assigned = visits.filter((v) => v.series_id === series.id);
  const cancelled =
    !series.active ||
    (assigned.length > 0 && assigned.every((v) => v.status === "cancelled"));
  const daysLeft = Temporal.PlainDate.from(today).until(end, {
    largestUnit: "days",
  }).days;
  const status: RecurringStatus = cancelled
    ? "cancelled"
    : daysLeft < 0
      ? "ended"
      : today >= followUpOn
        ? "ending-soon"
        : series.anchor_date > today
          ? "upcoming"
          : "active";
  return {
    series,
    status,
    followUpOn,
    daysLeft,
    visitCount: assigned.length,
    remainingVisits: assigned.filter(
      (v) =>
        (v.status === "scheduled" || v.status === "started") &&
        Temporal.Instant.from(v.ends_at)
          .toZonedDateTimeISO("Europe/London")
          .toPlainDate()
          .toString() >= today,
    ).length,
  };
}
export function recurringSummaries(
  data: Pick<DashboardData, "booking_series" | "visits">,
  today: string,
) {
  return data.booking_series
    .map((series) => recurringSummary(series, data.visits, today))
    .sort((a, b) => a.series.ends_on.localeCompare(b.series.ends_on));
}
