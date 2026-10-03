import { describe, expect, it } from "vitest";
import {
  freeAvailabilityBands,
  londonWorkingIntervals,
  availabilityColour,
} from "@/lib/availability";
import {
  cleanerInviteSchema,
  weeklyAvailabilitySchema,
} from "@/lib/validation";
import type { CleanerAvailability, DashboardData, Visit } from "@/lib/models";
const cleaners = [
  { id: "a", name: "Cleaner A", active: true },
  { id: "b", name: "Cleaner B", active: true },
  { id: "c", name: "Inactive", active: false },
];
const slot = (
  cleaner_id: string,
  start_time: string,
  end_time: string,
  weekday = 1,
): CleanerAvailability => ({ cleaner_id, weekday, start_time, end_time });
const visit = (
  cleaner_id: string,
  starts_at: string,
  ends_at: string,
  status = "scheduled",
): Visit => ({
  id: "visit",
  cleaner_id,
  starts_at,
  ends_at,
  status,
  customer_id: "customer",
  instructions: "",
  series_id: null,
});
const base = (): Pick<
  DashboardData,
  "cleaners" | "availability" | "visits" | "leave_requests"
> => ({
  cleaners,
  availability: [slot("a", "08:00", "17:00"), slot("b", "09:00", "18:00")],
  visits: [],
  leave_requests: [],
});
const range = { start: "2026-10-05T00:00:00Z", end: "2026-10-06T00:00:00Z" };
const simplify = (data: ReturnType<typeof base>, ids = ["a", "b"]) =>
  freeAvailabilityBands(data, ids, range).map((band) => [
    band.start.slice(11, 16),
    band.end.slice(11, 16),
    band.cleanerIds,
  ]);
describe("free cleaner capacity", () => {
  it("counts simultaneous cleaners, rather than their number of weekly periods", () => {
    const data = base();
    data.availability.push(slot("a", "08:00", "17:00"));
    expect(simplify(data)).toEqual([
      ["07:00", "08:00", ["a"]],
      ["08:00", "16:00", ["a", "b"]],
      ["16:00", "17:00", ["b"]],
    ]);
    expect(availabilityColour(2)).not.toEqual(availabilityColour(1));
  });
  it("removes visits from only their assigned cleaner and releases cancelled visits", () => {
    const data = base();
    data.visits = [
      visit("a", "2026-10-05T09:00:00Z", "2026-10-05T11:00:00Z"),
      visit("b", "2026-10-05T12:00:00Z", "2026-10-05T14:00:00Z", "cancelled"),
    ];
    expect(simplify(data)).toEqual([
      ["07:00", "08:00", ["a"]],
      ["08:00", "09:00", ["a", "b"]],
      ["09:00", "11:00", ["b"]],
      ["11:00", "16:00", ["a", "b"]],
      ["16:00", "17:00", ["b"]],
    ]);
  });
  it.each(["scheduled", "started", "completed"])(
    "subtracts %s visits, including visits spanning a slot boundary",
    (status) => {
      const data = base();
      data.visits = [
        visit("a", "2026-10-05T06:00:00Z", "2026-10-05T09:00:00Z", status),
        visit("a", "2026-10-05T15:00:00Z", "2026-10-05T18:00:00Z", status),
      ];
      expect(simplify(data, ["a"])).toEqual([["09:00", "15:00", ["a"]]]);
    },
  );
  it("subtracts consecutive and overlapping bookings without losing free boundaries", () => {
    const data = base();
    data.visits = [
      visit("a", "2026-10-05T08:00:00Z", "2026-10-05T10:00:00Z"),
      visit("a", "2026-10-05T09:00:00Z", "2026-10-05T11:00:00Z"),
      visit("a", "2026-10-05T11:00:00Z", "2026-10-05T12:00:00Z"),
    ];
    expect(simplify(data, ["a"])).toEqual([
      ["07:00", "08:00", ["a"]],
      ["12:00", "16:00", ["a"]],
    ]);
  });
  it("removes approved leave inclusively but keeps pending and declined requests free", () => {
    const data = base();
    data.leave_requests = [
      {
        id: "leave",
        cleaner_id: "a",
        starts_on: "2026-10-04",
        ends_on: "2026-10-05",
        status: "approved",
      },
      {
        id: "pending",
        cleaner_id: "b",
        starts_on: "2026-10-05",
        ends_on: "2026-10-05",
        status: "pending",
      },
    ];
    expect(simplify(data)).toEqual([["08:00", "17:00", ["b"]]]);
    data.leave_requests[0].status = "declined";
    expect(simplify(data)[1][2]).toEqual(["a", "b"]);
  });
  it("uses only selected active cleaners and leaves breaks unshaded", () => {
    const data = base();
    data.availability = [
      slot("a", "08:00", "12:00"),
      slot("a", "13:00", "17:00"),
      slot("c", "08:00", "20:00"),
    ];
    expect(simplify(data, ["a", "c"])).toEqual([
      ["07:00", "11:00", ["a"]],
      ["12:00", "16:00", ["a"]],
    ]);
    expect(simplify(data, [])).toEqual([]);
  });
  it("clips to the visible range and uses London weekdays near UTC midnight", () => {
    const data = base();
    data.availability = [slot("a", "00:00", "02:00")];
    const bands = freeAvailabilityBands(data, ["a"], {
      start: "2026-10-04T23:15:00Z",
      end: "2026-10-05T00:30:00Z",
    });
    expect(bands).toMatchObject([
      {
        date: "2026-10-05",
        start: "2026-10-04T23:15:00.000Z",
        end: "2026-10-05T00:30:00.000Z",
        count: 1,
      },
    ]);
  });
});
describe("London weekly hours across clock changes", () => {
  const instants = (date: string, start_time: string, end_time: string) =>
    londonWorkingIntervals(date, { weekday: 0, start_time, end_time }).map(
      (v) => [new Date(v.start).toISOString(), new Date(v.end).toISOString()],
    );
  it("omits nonexistent spring hours and resumes at the correct instant", () => {
    expect(instants("2027-03-28", "01:00", "01:30")).toEqual([]);
    expect(instants("2027-03-28", "01:00", "03:00")).toEqual([
      ["2027-03-28T01:00:00.000Z", "2027-03-28T02:00:00.000Z"],
    ]);
  });
  it("includes both repeated autumn hours without filling a nonworking gap", () => {
    expect(instants("2026-10-25", "01:00", "01:30")).toEqual([
      ["2026-10-25T00:00:00.000Z", "2026-10-25T00:30:00.000Z"],
      ["2026-10-25T01:00:00.000Z", "2026-10-25T01:30:00.000Z"],
    ]);
  });
});
describe("weekly hours validation", () => {
  it("requires hours on creation and accepts adjacent periods", () => {
    expect(
      cleanerInviteSchema.safeParse({
        name: "Test Cleaner",
        email: "test@example.test",
        availability: [],
      }).success,
    ).toBe(false);
    expect(
      weeklyAvailabilitySchema.safeParse([
        slot("a", "08:00", "12:00"),
        slot("a", "12:00", "17:00"),
      ]).success,
    ).toBe(true);
  });
  it.each([
    { slots: [slot("a", "08:00", "12:00"), slot("a", "11:00", "17:00")] },
    { slots: [slot("a", "17:00", "08:00")] },
    { slots: [slot("a", "24:00", "25:00")] },
    { slots: [slot("a", "08:00", "17:00", 7)] },
  ])("rejects overlapping or invalid periods %#", ({ slots }) => {
    expect(weeklyAvailabilitySchema.safeParse(slots).success).toBe(false);
  });
});
