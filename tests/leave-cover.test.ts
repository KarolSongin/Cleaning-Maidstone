import { describe, expect, it } from "vitest";
import {
  availableCoverCleaners,
  visitsNeedingCover,
  pendingLeaveCover,
} from "@/lib/leave-cover";
import type { DashboardData, RequestRecord, Visit } from "@/lib/models";
const request: RequestRecord = {
  id: "leave",
  cleaner_id: "a",
  status: "pending",
  starts_on: "2027-07-05",
  ends_on: "2027-07-12",
};
const visit = (
  id: string,
  starts_at: string,
  extra: Partial<Visit> = {},
): Visit => ({
  id,
  starts_at,
  ends_at: new Date(Date.parse(starts_at) + 3_600_000).toISOString(),
  cleaner_id: "a",
  customer_id: "customer",
  instructions: "",
  series_id: null,
  status: "scheduled",
  ...extra,
});

describe("cleaners available for the entire cover visit", () => {
  const target = visit("target", "2027-07-05T08:00:00Z", {
    ends_at: "2027-07-05T10:00:00Z",
  }); // Monday, 09:00–11:00 London.
  const slot = (
    cleaner_id: string,
    start_time: string,
    end_time: string,
    weekday = 1,
  ) => ({ cleaner_id, weekday, start_time, end_time });
  const data = (): Pick<
    DashboardData,
    "cleaners" | "availability" | "visits" | "leave_requests"
  > => ({
    cleaners: [
      { id: "a", name: "Original cleaner", active: true },
      { id: "b", name: "Bravo", active: true },
      { id: "c", name: "Alpha", active: true },
      { id: "inactive", name: "Inactive", active: false },
      { id: "no-hours", name: "No hours", active: true },
    ],
    availability: [
      slot("a", "08:00", "20:00"),
      slot("b", "08:00", "18:00"),
      slot("c", "09:00:00", "11:00:00"),
      slot("inactive", "08:00", "20:00"),
    ],
    visits: [target],
    leave_requests: [],
  });
  const ids = (value: ReturnType<typeof data>, v = target) =>
    availableCoverCleaners(value, v).map((c) => c.id);
  it("includes only active alternatives with hours covering the whole visit and sorts by name", () => {
    expect(ids(data())).toEqual(["c", "b"]);
  });
  it("excludes partial working hours, the wrong weekday and breaks during the visit", () => {
    const value = data();
    value.availability = [
      slot("b", "08:00", "10:00"),
      slot("b", "10:30", "18:00"),
      slot("c", "10:00", "18:00"),
      slot("c", "08:00", "18:00", 2),
    ];
    expect(ids(value)).toEqual([]);
  });
  it.each(["scheduled", "started", "completed"])(
    "excludes even a partial overlap with a %s booking",
    (status) => {
      const value = data();
      value.visits.push(
        visit("busy", "2027-07-05T09:30:00Z", {
          cleaner_id: "b",
          status,
          ends_at: "2027-07-05T10:30:00Z",
        }),
      );
      expect(ids(value)).toEqual(["c"]);
    },
  );
  it("permits back-to-back work and ignores cancelled bookings", () => {
    const value = data();
    value.visits.push(
      visit("before", "2027-07-05T07:00:00Z", { cleaner_id: "b" }),
      visit("after", "2027-07-05T10:00:00Z", { cleaner_id: "b" }),
      visit("cancelled", "2027-07-05T09:00:00Z", {
        cleaner_id: "b",
        status: "cancelled",
      }),
    );
    expect(ids(value)).toEqual(["c", "b"]);
  });
  it("excludes inclusive approved leave and retains pending/declined requests and other dates", () => {
    const value = data();
    value.leave_requests = [
      {
        ...request,
        cleaner_id: "c",
        starts_on: "2027-07-04",
        ends_on: "2027-07-05",
        status: "approved",
      },
      { ...request, cleaner_id: "b", status: "pending" },
      { ...request, cleaner_id: "b", status: "declined" },
      {
        ...request,
        cleaner_id: "b",
        starts_on: "2027-07-06",
        ends_on: "2027-07-07",
        status: "approved",
      },
    ];
    expect(ids(value)).toEqual(["b"]);
    value.leave_requests[0].ends_on = "2027-07-04";
    expect(ids(value)).toEqual(["c", "b"]);
  });
  it("keeps a fully free cleaner when other cleaners split the calendar bands", () => {
    const value = data();
    value.visits.push(
      visit("half-busy", "2027-07-05T08:00:00Z", { cleaner_id: "c" }),
    );
    expect(ids(value)).toEqual(["b"]);
  });
  it("covers spring clock changes and rejects gaps during repeated autumn hours", () => {
    const value = data();
    value.availability = [
      slot("b", "00:00", "03:00", 0),
      slot("c", "01:00", "01:45", 0),
    ];
    expect(
      ids(
        value,
        visit("spring", "2027-03-28T00:30:00Z", {
          ends_at: "2027-03-28T01:30:00Z",
        }),
      ),
    ).toEqual(["b"]);
    expect(
      ids(
        value,
        visit("autumn", "2027-10-31T00:15:00Z", {
          ends_at: "2027-10-31T01:45:00Z",
        }),
      ),
    ).toEqual(["b"]);
  });
  it("uses the London weekday and leave date near UTC midnight", () => {
    const value = data();
    value.availability = [slot("b", "00:00", "02:00")];
    const early = visit("early", "2027-07-04T23:15:00Z", {
      ends_at: "2027-07-05T00:45:00Z",
    });
    expect(ids(value, early)).toEqual(["b"]);
    value.leave_requests.push({
      ...request,
      cleaner_id: "b",
      starts_on: "2027-07-05",
      ends_on: "2027-07-05",
      status: "approved",
    });
    expect(ids(value, early)).toEqual([]);
  });
  it("returns no choices for invalid durations or a visit crossing London midnight", () => {
    expect(ids(data(), { ...target, ends_at: target.starts_at })).toEqual([]);
    expect(ids(data(), { ...target, ends_at: "2027-07-05T07:00:00Z" })).toEqual(
      [],
    );
    expect(
      ids(
        data(),
        visit("overnight", "2027-07-05T22:30:00Z", {
          ends_at: "2027-07-05T23:15:00Z",
        }),
      ),
    ).toEqual([]);
  });
  it("recalculates eligibility after bookings, cancellations and working-hour changes", () => {
    const value = data();
    value.visits.push({ ...target, id: "busy", cleaner_id: "c" });
    value.availability = value.availability.filter((s) => s.cleaner_id !== "b");
    expect(ids(value)).toEqual([]);
    value.visits[1].status = "cancelled";
    value.availability.push(slot("b", "08:00", "18:00"));
    expect(ids(value)).toEqual(["c", "b"]);
  });
});
describe("time-off cover", () => {
  it("includes both leave boundaries and each recurring occurrence in chronological order", () => {
    const visits = [
      visit("last", "2027-07-12T09:00:00Z", { series_id: "series" }),
      visit("after", "2027-07-13T09:00:00Z"),
      visit("first", "2027-07-05T09:00:00Z", { series_id: "series" }),
      visit("before", "2027-07-04T09:00:00Z"),
    ];
    expect(visitsNeedingCover(request, visits).map((v) => v.id)).toEqual([
      "first",
      "last",
    ]);
    expect(visits[0].id).toBe("last");
  });
  it("excludes other cleaners, cancellations and completed cleans but includes in-progress work", () => {
    const visits = [
      visit("other", "2027-07-05T08:00:00Z", { cleaner_id: "b" }),
      visit("cancelled", "2027-07-05T09:00:00Z", { status: "cancelled" }),
      visit("done", "2027-07-05T10:00:00Z", { status: "completed" }),
      visit("started", "2027-07-05T11:00:00Z", { status: "started" }),
    ];
    expect(visitsNeedingCover(request, visits).map((v) => v.id)).toEqual([
      "started",
    ]);
  });
  it("uses the London date when UTC midnight falls on a different day", () => {
    const oneDay = {
      ...request,
      starts_on: "2027-07-05",
      ends_on: "2027-07-05",
    };
    expect(
      visitsNeedingCover(oneDay, [
        visit("early", "2027-07-04T23:15:00Z"),
        visit("next-day", "2027-07-05T23:15:00Z"),
      ]).map((v) => v.id),
    ).toEqual(["early"]);
  });
  it("covers both repeated autumn hours and compares the actual instants", () => {
    const autumn = {
      ...request,
      starts_on: "2027-10-31",
      ends_on: "2027-10-31",
    };
    expect(
      visitsNeedingCover(autumn, [
        visit("later", "2027-10-31T01:15:00Z"),
        visit("earlier", "2027-10-31T01:15:00+01:00"),
      ]).map((v) => v.id),
    ).toEqual(["earlier", "later"]);
  });
  it("recalculates after reassignment, rescheduling and cancellation", () => {
    const visits = [
      visit("covered", "2027-07-05T09:00:00Z"),
      visit("moved", "2027-07-06T09:00:00Z"),
      visit("cancelled", "2027-07-07T09:00:00Z"),
    ];
    expect(visitsNeedingCover(request, visits)).toHaveLength(3);
    visits[0].cleaner_id = "b";
    visits[1].starts_at = "2027-07-15T09:00:00Z";
    visits[2].status = "cancelled";
    expect(visitsNeedingCover(request, visits)).toEqual([]);
    expect(
      visitsNeedingCover({ ...request, starts_on: undefined }, visits),
    ).toEqual([]);
  });
  it("counts a clean once across overlapping pending requests and ignores reviewed requests", () => {
    const requests = [
      request,
      { ...request, id: "overlap" },
      { ...request, id: "approved", status: "approved" },
      { ...request, id: "declined", status: "declined" },
    ];
    expect(
      pendingLeaveCover(requests, [visit("one", "2027-07-05T09:00:00Z")]),
    ).toEqual({ requests: 2, visits: 1 });
  });
});
