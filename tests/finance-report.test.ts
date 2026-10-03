import { describe, expect, it } from "vitest";
import type {
  BookingFinance,
  Customer,
  DashboardData,
  Visit,
} from "@/lib/models";
import {
  financeReport,
  financePeriod,
  financeCsv,
  validateFinanceDates,
  monthName,
} from "@/lib/finance-report";
const now = "2026-10-03T12:00:00Z";
const all = { from: "", to: "", customerId: "", cleanerId: "" };
const rates = {
  customer_rate_pence: 1800,
  admin_rate_pence: 300,
  cleaner_rate_pence: 1500,
};
const customer = (id: string, name: string): Customer => ({
  id,
  name,
  email: "",
  phone: "",
  address: "Synthetic",
  postcode: "ME14 1AA",
  preferences: "",
  internal_notes: "",
});
const visit = (
  id: string,
  starts_at: string,
  minutes: number,
  status = "scheduled",
  customer_id = "customer-a",
  cleaner_id = "cleaner-a",
  series_id: string | null = null,
): Visit => ({
  id,
  starts_at,
  ends_at: new Date(Date.parse(starts_at) + minutes * 60000).toISOString(),
  status,
  customer_id,
  cleaner_id,
  series_id,
  instructions: "",
});
const price = (id: string, override = {}): BookingFinance => ({
  id,
  ...rates,
  ...override,
});
function fixture(): Pick<
  DashboardData,
  "visits" | "visit_finances" | "customers" | "cleaners"
> {
  return {
    customers: [
      customer("customer-a", "A Customer"),
      customer("customer-b", "B Customer"),
    ],
    cleaners: [
      { id: "cleaner-a", name: "A Cleaner", active: true },
      { id: "cleaner-b", name: "B Cleaner", active: false },
    ],
    visits: [
      visit("completed", "2026-10-01T08:00:00Z", 90, "completed"),
      visit(
        "future",
        "2026-10-04T08:00:00Z",
        180,
        "scheduled",
        "customer-a",
        "cleaner-b",
        "series-a",
      ),
      visit("ongoing", "2026-10-03T11:30:00Z", 90, "started", "customer-b"),
      visit("past", "2026-10-02T08:00:00Z", 60, "scheduled", "customer-b"),
      visit("cancelled", "2026-10-05T08:00:00Z", 180, "cancelled"),
      visit("unpriced", "2026-10-04T14:00:00Z", 90),
    ],
    visit_finances: [
      price("completed"),
      price("future", {
        customer_rate_pence: 2200,
        admin_rate_pence: 500,
        cleaner_rate_pence: 1700,
      }),
      price("ongoing"),
      price("past"),
      price("cancelled"),
    ],
  };
}
describe("admin financial report", () => {
  it("separates completed earnings, booked forecast and past work awaiting completion, excluding cancellations", () => {
    const result = financeReport(fixture(), all, now);
    expect(result.earned).toMatchObject({
      visits: 1,
      admin: 450,
      customer: 2700,
      cleaner: 2250,
    });
    expect(result.forecast).toMatchObject({
      visits: 3,
      admin: 1950,
      customer: 9300,
      cleaner: 7350,
      unpricedVisits: 1,
    });
    expect(result.awaiting).toMatchObject({
      visits: 1,
      admin: 300,
      customer: 1800,
      cleaner: 1500,
    });
    expect(result.cancelled).toMatchObject({ visits: 1, admin: 900 });
    expect(result.total).toEqual({
      visits: 5,
      pricedVisits: 4,
      unpricedVisits: 1,
      minutes: 510,
      customer: 13800,
      admin: 2700,
      cleaner: 11100,
    });
    expect(result.rows).toHaveLength(6);
    expect(result.total.customer).toBe(
      result.total.admin + result.total.cleaner,
    );
  });
  it("keeps missing rates distinct from genuine zero shares and ignores unpriced cancellations in coverage", () => {
    const data = fixture();
    data.visit_finances.push(
      price("unpriced", { admin_rate_pence: 0, cleaner_rate_pence: 1800 }),
    );
    data.visit_finances = data.visit_finances.filter(
      (f) => f.id !== "cancelled",
    );
    const result = financeReport(data, all, now);
    expect(result.total.unpricedVisits).toBe(0);
    expect(result.total.pricedVisits).toBe(5);
    expect(result.rows.find((r) => r.visit.id === "unpriced")?.amounts).toEqual(
      { customer: 2700, admin: 0, cleaner: 2700 },
    );
    expect(result.cancelled.unpricedVisits).toBe(1);
    const unknown = financeReport(
      fixture(),
      { ...all, from: "2026-10-04", to: "2026-10-04", cleanerId: "cleaner-a" },
      now,
    );
    expect(unknown.total).toMatchObject({
      visits: 1,
      pricedVisits: 0,
      unpricedVisits: 1,
      customer: 0,
      admin: 0,
      cleaner: 0,
    });
    expect(unknown.rows[0].amounts).toBeNull();
  });
  it("combines inclusive date, customer and cleaner filters, including inactive cleaner history", () => {
    const result = financeReport(
      fixture(),
      {
        from: "2026-10-01",
        to: "2026-10-04",
        customerId: "customer-a",
        cleanerId: "cleaner-b",
      },
      now,
    );
    expect(result.rows.map((r) => r.visit.id)).toEqual(["future"]);
    expect(result.total).toMatchObject({
      visits: 1,
      minutes: 180,
      customer: 6600,
      admin: 1500,
      cleaner: 5100,
    });
    expect(result.byCleaner[0].name).toBe("B Cleaner");
    expect(
      financeReport(fixture(), { ...all, customerId: "missing" }, now).rows,
    ).toEqual([]);
    expect(
      financeReport(fixture(), { ...all, to: "2026-10-01" }, now).rows,
    ).toHaveLength(1);
  });
  it("uses London start dates and elapsed duration across midnight and clock changes", () => {
    const data = fixture();
    data.visits = [
      visit("midnight", "2026-06-30T23:30:00Z", 60),
      visit("fallback", "2026-10-25T00:30:00Z", 60),
    ];
    data.visit_finances = [price("midnight"), price("fallback")];
    const july = financeReport(
      data,
      { ...all, from: "2026-07-01", to: "2026-07-01" },
      now,
    );
    expect(july.rows[0].date).toBe("2026-07-01");
    expect(july.months[0].id).toBe("2026-07");
    expect(
      financeReport(data, { ...all, from: "2026-06-30", to: "2026-06-30" }, now)
        .rows,
    ).toEqual([]);
    const autumn = financeReport(
      data,
      { ...all, from: "2026-10-25", to: "2026-10-25" },
      now,
    );
    expect(autumn.rows[0]).toMatchObject({
      minutes: 60,
      amounts: { customer: 1800, admin: 300, cleaner: 1500 },
    });
  });
  it("classifies a visit ending exactly at the report time as awaiting completion", () => {
    const data = fixture();
    data.visits = [
      visit("boundary", "2026-10-03T11:00:00Z", 60, "started"),
      visit("current", "2026-10-03T11:00:01Z", 60, "started"),
    ];
    data.visit_finances = [];
    const result = financeReport(data, all, now);
    expect(result.rows.find((r) => r.visit.id === "boundary")?.phase).toBe(
      "awaiting",
    );
    expect(result.rows.find((r) => r.visit.id === "current")?.phase).toBe(
      "forecast",
    );
  });
  it("uses individual visit snapshots and actual assignments, with all breakdowns reconciling to totals", () => {
    const result = financeReport(fixture(), all, now);
    expect(
      result.byCustomer.find((g) => g.id === "customer-a")?.total.admin,
    ).toBe(1950);
    expect(
      result.byCleaner.find((g) => g.id === "cleaner-b")?.forecast.admin,
    ).toBe(1500);
    for (const groups of [result.byCustomer, result.byCleaner, result.months]) {
      for (const key of [
        "visits",
        "pricedVisits",
        "unpricedVisits",
        "minutes",
        "customer",
        "admin",
        "cleaner",
      ] as const)
        expect(groups.reduce((sum, g) => sum + g.total[key], 0)).toBe(
          result.total[key],
        );
      expect(groups.reduce((sum, g) => sum + g.earned.admin, 0)).toBe(
        result.earned.admin,
      );
      expect(groups.reduce((sum, g) => sum + g.forecast.admin, 0)).toBe(
        result.forecast.admin,
      );
      expect(groups.reduce((sum, g) => sum + g.awaiting.admin, 0)).toBe(
        result.awaiting.admin,
      );
    }
    const changed = fixture();
    changed.visits[1].cleaner_id = "cleaner-a";
    changed.visits[1].starts_at = "2026-11-04T08:00:00Z";
    changed.visits[1].ends_at = "2026-11-04T11:00:00Z";
    const refreshed = financeReport(changed, all, now);
    expect(
      refreshed.byCleaner.find((g) => g.id === "cleaner-b"),
    ).toBeUndefined();
    expect(refreshed.months.map((m) => m.id)).toEqual(["2026-10", "2026-11"]);
    expect(refreshed.total.admin).toBe(result.total.admin);
  });
  it("rounds every visit before adding totals, retaining the whole penny on partial-hour work", () => {
    const data = fixture();
    data.visits = [
      visit("penny-a", "2026-10-04T10:00:00Z", 30),
      visit("penny-b", "2026-10-04T11:00:00Z", 30),
    ];
    data.visit_finances = data.visits.map((v) =>
      price(v.id, {
        customer_rate_pence: 1,
        admin_rate_pence: 1,
        cleaner_rate_pence: 0,
      }),
    );
    const result = financeReport(data, all, now);
    expect(result.total).toMatchObject({ customer: 2, admin: 2, cleaner: 0 });
    expect(result.byCustomer[0].forecast.admin).toBe(2);
  });
  it("validates date order and supports calendar-month, leap-year and inclusive 30-day shortcuts", () => {
    expect(monthName("2026-10")).toBe("Oct 2026");
    expect(financePeriod("this-month", "2026-10-03")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(financePeriod("last-month", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(financePeriod("next-month", "2027-12-31")).toEqual({
      from: "2028-01-01",
      to: "2028-01-31",
    });
    expect(financePeriod("next-month", "2028-01-31")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(financePeriod("next-30", "2026-10-03")).toEqual({
      from: "2026-10-03",
      to: "2026-11-01",
    });
    expect(financePeriod("this-year", "2026-10-03")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(financePeriod("all", "2026-10-03")).toEqual({ from: "", to: "" });
    expect(() => validateFinanceDates("2026-10-04", "2026-10-03")).toThrow(
      /end date/,
    );
    expect(() => validateFinanceDates("2026-02-30", "")).toThrow(/valid/);
    expect(() =>
      financeReport(fixture(), { ...all, from: "invalid" }, now),
    ).toThrow(/valid/);
  });
  it("exports all matching visits with exact decimals, unpriced blanks and cancelled quotes marked excluded", () => {
    const rows = financeReport(fixture(), all, now).rows;
    const csv = financeCsv(rows);
    expect(csv.split("\r\n")).toHaveLength(7);
    expect(csv).toContain(
      '"22.00","5.00","17.00","66.00","15.00","51.00","Yes"',
    );
    expect(csv).toContain('"18.00","3.00","15.00","54.00","9.00","45.00","No"');
    expect(
      csv.split("\r\n").find((line) => line.startsWith('"unpriced"')),
    ).toContain('"1.5","","","","","","","No"');
    expect(
      financeCsv(rows.filter((r) => r.phase === "earned")).split("\r\n"),
    ).toHaveLength(2);
  });
  it("escapes CSV quotes and spreadsheet formulas in customer and cleaner names", () => {
    const data = fixture();
    data.customers[0].name = '=SUM(1,2) "Quoted"';
    data.cleaners[0].name = "  +Unsafe";
    const csv = financeCsv(financeReport(data, all, now).rows);
    expect(csv).toContain('"\'=SUM(1,2) ""Quoted"""');
    expect(csv).toContain('"\'  +Unsafe"');
  });
});
