import { Temporal } from "@js-temporal/polyfill";
import type { BookingFinance, DashboardData, Visit } from "./models";
import { visitAmounts, visitMinutes } from "./finances";

export type FinancePhase = "earned" | "forecast" | "awaiting" | "cancelled";
export const phaseLabels: Record<FinancePhase, string> = {
  earned: "Completed",
  forecast: "Booked forecast",
  awaiting: "Awaiting completion",
  cancelled: "Cancelled",
};
export type FinanceFilters = {
  from: string;
  to: string;
  customerId: string;
  cleanerId: string;
};
export type FinanceRow = {
  visit: Visit;
  date: string;
  month: string;
  customer: string;
  cleaner: string;
  minutes: number;
  rates?: BookingFinance;
  amounts: ReturnType<typeof visitAmounts> | null;
  phase: FinancePhase;
};
export type IncomeTotals = {
  visits: number;
  pricedVisits: number;
  unpricedVisits: number;
  minutes: number;
  customer: number;
  admin: number;
  cleaner: number;
};
export type IncomeBreakdown = {
  id: string;
  name: string;
  total: IncomeTotals;
} & Record<FinancePhase, IncomeTotals>;
const empty = (): IncomeTotals => ({
  visits: 0,
  pricedVisits: 0,
  unpricedVisits: 0,
  minutes: 0,
  customer: 0,
  admin: 0,
  cleaner: 0,
});
function add(total: IncomeTotals, row: FinanceRow) {
  total.visits++;
  total.minutes += row.minutes;
  if (row.amounts) {
    total.pricedVisits++;
    total.customer += row.amounts.customer;
    total.admin += row.amounts.admin;
    total.cleaner += row.amounts.cleaner;
  } else total.unpricedVisits++;
}
function breakdown(id: string, name: string): IncomeBreakdown {
  return {
    id,
    name,
    total: empty(),
    earned: empty(),
    forecast: empty(),
    awaiting: empty(),
    cancelled: empty(),
  };
}
export function validateFinanceDates(from: string, to: string) {
  for (const value of [from, to])
    if (value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error("Choose valid start and end dates.");
      try {
        Temporal.PlainDate.from(value);
      } catch {
        throw new Error("Choose valid start and end dates.");
      }
    }
  if (from && to && from > to)
    throw new Error("The end date must be on or after the start date.");
}
export function financeReport(
  data: Pick<
    DashboardData,
    "visits" | "visit_finances" | "customers" | "cleaners"
  >,
  filters: FinanceFilters,
  now: string,
) {
  validateFinanceDates(filters.from, filters.to);
  const instant = Date.parse(now);
  if (!Number.isFinite(instant)) throw new Error("Invalid report time");
  const rates = new Map(data.visit_finances.map((f) => [f.id, f]));
  const customers = new Map(data.customers.map((c) => [c.id, c.name]));
  const cleaners = new Map(data.cleaners.map((c) => [c.id, c.name]));
  const rows: FinanceRow[] = [];
  const total = empty();
  const earned = empty(),
    forecast = empty(),
    awaiting = empty(),
    cancelled = empty();
  const buckets = { earned, forecast, awaiting, cancelled };
  const customerGroups = new Map<string, IncomeBreakdown>(),
    cleanerGroups = new Map<string, IncomeBreakdown>(),
    months = new Map<string, IncomeBreakdown>();
  for (const visit of data.visits) {
    if (
      (filters.customerId && visit.customer_id !== filters.customerId) ||
      (filters.cleanerId && visit.cleaner_id !== filters.cleanerId)
    )
      continue;
    const date = Temporal.Instant.from(visit.starts_at)
      .toZonedDateTimeISO("Europe/London")
      .toPlainDate()
      .toString();
    if (
      (filters.from && date < filters.from) ||
      (filters.to && date > filters.to)
    )
      continue;
    const phase: FinancePhase =
      visit.status === "cancelled"
        ? "cancelled"
        : visit.status === "completed"
          ? "earned"
          : Date.parse(visit.ends_at) <= instant
            ? "awaiting"
            : "forecast";
    const minutes = visitMinutes(visit),
      finance = rates.get(visit.id);
    const row: FinanceRow = {
      visit,
      date,
      month: date.slice(0, 7),
      customer: customers.get(visit.customer_id) || "Unknown customer",
      cleaner: cleaners.get(visit.cleaner_id) || "Unknown cleaner",
      minutes,
      rates: finance,
      amounts: finance ? visitAmounts(finance, minutes) : null,
      phase,
    };
    rows.push(row);
    add(buckets[phase], row);
    if (phase === "cancelled") continue;
    add(total, row);
    for (const [map, id, name] of [
      [customerGroups, visit.customer_id, row.customer],
      [cleanerGroups, visit.cleaner_id, row.cleaner],
      [months, row.month, row.month],
    ] as const) {
      let group = map.get(id);
      if (!group) {
        group = breakdown(id, name);
        map.set(id, group);
      }
      add(group.total, row);
      add(group[phase], row);
    }
  }
  return {
    rows: rows.sort(
      (a, b) =>
        b.visit.starts_at.localeCompare(a.visit.starts_at) ||
        a.visit.id.localeCompare(b.visit.id),
    ),
    total,
    ...buckets,
    byCustomer: [...customerGroups.values()].sort(
      (a, b) => b.total.admin - a.total.admin || a.name.localeCompare(b.name),
    ),
    byCleaner: [...cleanerGroups.values()].sort(
      (a, b) => b.total.admin - a.total.admin || a.name.localeCompare(b.name),
    ),
    months: [...months.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export type FinancePreset =
  | "all"
  | "this-month"
  | "last-month"
  | "next-month"
  | "next-30"
  | "this-year"
  | "custom";
export function financePeriod(preset: FinancePreset, today: string) {
  const day = Temporal.PlainDate.from(today);
  if (preset === "all" || preset === "custom") return { from: "", to: "" };
  if (preset === "next-30")
    return { from: day.toString(), to: day.add({ days: 29 }).toString() };
  if (preset === "this-year")
    return {
      from: day.with({ month: 1, day: 1 }).toString(),
      to: day.with({ month: 12, day: 31 }).toString(),
    };
  const start = day.with({ day: 1 }).add({
    months: preset === "last-month" ? -1 : preset === "next-month" ? 1 : 0,
  });
  return {
    from: start.toString(),
    to: start.add({ months: 1 }).subtract({ days: 1 }).toString(),
  };
}
export function monthName(month: string) {
  return Temporal.PlainDate.from(`${month}-01`).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  });
}
export function financeCsv(rows: FinanceRow[]) {
  const quote = (value: string) =>
    `"${(/^[\s]*[=+@-]|^[\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  const pounds = (pence: number | undefined) =>
    pence === undefined ? "" : (pence / 100).toFixed(2);
  const localTime = (instant: string) =>
    Temporal.Instant.from(instant)
      .toZonedDateTimeISO("Europe/London")
      .toPlainTime()
      .toString({ smallestUnit: "minute" });
  const header = [
    "Visit ID",
    "London date",
    "Start time",
    "End time",
    "Customer",
    "Cleaner",
    "Booking type",
    "Visit status",
    "Income category",
    "Hours",
    "Customer hourly rate GBP",
    "Admin hourly share GBP",
    "Cleaner hourly cash GBP",
    "Customer visit value GBP",
    "Admin visit value GBP",
    "Cleaner cash GBP",
    "Included in income",
  ];
  const values = rows.map((row) => [
    row.visit.id,
    row.date,
    localTime(row.visit.starts_at),
    localTime(row.visit.ends_at),
    row.customer,
    row.cleaner,
    row.visit.series_id ? "Recurring" : "One-off",
    row.visit.status,
    phaseLabels[row.phase],
    String(row.minutes / 60),
    pounds(row.rates?.customer_rate_pence),
    pounds(row.rates?.admin_rate_pence),
    pounds(row.rates?.cleaner_rate_pence),
    pounds(row.amounts?.customer),
    pounds(row.amounts?.admin),
    pounds(row.amounts?.cleaner),
    row.phase !== "cancelled" && row.amounts ? "Yes" : "No",
  ]);
  return [header, ...values]
    .map((record) => record.map(quote).join(","))
    .join("\r\n");
}
