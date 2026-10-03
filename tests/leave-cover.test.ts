import { describe, expect, it } from "vitest";
import { visitsNeedingCover, pendingLeaveCover } from "@/lib/leave-cover";
import type { RequestRecord, Visit } from "@/lib/models";
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
