import { describe, expect, it } from "vitest";
import {
  bookingPeriod,
  recurringSummary,
  recurringSummaries,
} from "@/lib/recurring-bookings";
import { bookingSchema } from "@/lib/validation";
import type { BookingSeries, Visit } from "@/lib/models";
const series: BookingSeries = {
  id: "series",
  customer_id: "customer",
  cleaner_id: "cleaner",
  anchor_date: "2026-01-01",
  ends_on: "2026-10-31",
  duration_weeks: 43,
  local_time: "09:00:00",
  duration_minutes: 180,
  interval_weeks: 1,
  active: true,
};
const visit = (status: string, starts_at = "2026-10-31T09:00:00Z"): Visit => ({
  id: "visit",
  series_id: series.id,
  customer_id: series.customer_id,
  cleaner_id: series.cleaner_id,
  starts_at,
  ends_at: starts_at.replace("09:00", "12:00"),
  instructions: "",
  status,
});
const booking = {
  customer_id: "44444444-4444-4444-8444-444444444444",
  cleaner_id: "22222222-2222-4222-8222-222222222222",
  date: "2027-01-04",
  time: "09:00",
  duration_minutes: 180,
  interval_weeks: 1,
  occurrences: 52,
  duration_weeks: 52,
};
describe("recurring booking periods", () => {
  it("covers 52 weeks with 52 weekly or 26 fortnightly visits and one shared end date", () => {
    expect(bookingPeriod("2027-01-04", 52, 1)).toEqual({
      occurrences: 52,
      ends_on: "2028-01-02",
      last_visit_on: "2027-12-27",
    });
    expect(bookingPeriod("2027-01-04", 52, 2)).toEqual({
      occurrences: 26,
      ends_on: "2028-01-02",
      last_visit_on: "2027-12-20",
    });
  });
  it("includes the first visit in short and odd fortnightly periods", () => {
    expect(bookingPeriod("2027-01-04", 1, 2)).toEqual({
      occurrences: 1,
      ends_on: "2027-01-10",
      last_visit_on: "2027-01-04",
    });
    expect(bookingPeriod("2027-01-04", 3, 2)).toEqual({
      occurrences: 2,
      ends_on: "2027-01-24",
      last_visit_on: "2027-01-18",
    });
  });
  it("validates the maximum in weeks for old visit-count requests and new period requests", () => {
    expect(bookingSchema.safeParse(booking).success).toBe(true);
    expect(
      bookingSchema.safeParse({
        ...booking,
        interval_weeks: 2,
        occurrences: 26,
      }).success,
    ).toBe(true);
    expect(
      bookingSchema.safeParse({
        ...booking,
        interval_weeks: 2,
        occurrences: 27,
        duration_weeks: undefined,
      }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({
        ...booking,
        interval_weeks: 2,
        occurrences: 52,
      }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({ ...booking, duration_weeks: 53 }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({ ...booking, duration_weeks: 51 }).success,
    ).toBe(false);
  });
});
describe("renewal timing", () => {
  it("flags one calendar month before expiry, including month-end clamping", () => {
    expect(recurringSummary(series, [], "2026-09-29").status).toBe("active");
    expect(recurringSummary(series, [], "2026-09-30")).toMatchObject({
      status: "ending-soon",
      followUpOn: "2026-09-30",
      daysLeft: 31,
    });
    expect(
      recurringSummary({ ...series, ends_on: "2027-03-31" }, [], "2027-02-28"),
    ).toMatchObject({ status: "ending-soon", followUpOn: "2027-02-28" });
  });
  it("keeps the expiry day due and marks the following day ended", () => {
    expect(recurringSummary(series, [], "2026-10-31")).toMatchObject({
      status: "ending-soon",
      daysLeft: 0,
    });
    expect(recurringSummary(series, [], "2026-11-01")).toMatchObject({
      status: "ended",
      daysLeft: -1,
    });
  });
  it("does not shorten expiry when the last visit is cancelled or moved", () => {
    const visits = [visit("completed"), visit("cancelled")];
    expect(recurringSummary(series, visits, "2026-10-01").series.ends_on).toBe(
      "2026-10-31",
    );
    expect(
      recurringSummary(
        series,
        [visit("scheduled", "2026-11-05T09:00:00Z")],
        "2026-10-01",
      ),
    ).toMatchObject({
      status: "ending-soon",
      remainingVisits: 1,
      followUpOn: "2026-09-30",
    });
  });
  it("excludes inactive and fully cancelled bookings from renewal reminders", () => {
    expect(
      recurringSummary({ ...series, active: false }, [], "2026-10-01").status,
    ).toBe("cancelled");
    expect(
      recurringSummary(series, [visit("cancelled")], "2026-10-01").status,
    ).toBe("cancelled");
  });
  it("counts only remaining assigned visits and puts earliest end dates first", () => {
    const summaries = recurringSummaries(
      {
        booking_series: [
          {
            ...series,
            id: "later",
            ends_on: "2027-12-31",
            anchor_date: "2027-01-01",
          },
          series,
        ],
        visits: [
          visit("completed"),
          visit("scheduled", "2026-09-01T09:00:00Z"),
          visit("cancelled"),
          visit("scheduled"),
        ],
      },
      "2026-10-01",
    );
    expect(summaries[0]).toMatchObject({
      remainingVisits: 1,
      visitCount: 4,
      status: "ending-soon",
    });
    expect(summaries[1].status).toBe("upcoming");
  });
});
