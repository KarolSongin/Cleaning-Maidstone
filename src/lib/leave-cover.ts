import { Temporal } from "@js-temporal/polyfill";
import type { RequestRecord, Visit } from "./models";

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
