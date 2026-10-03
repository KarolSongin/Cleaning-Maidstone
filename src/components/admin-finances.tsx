"use client";
import { PersonName } from "./person-name";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CirclePoundSterling,
  CalendarClock,
  CircleCheck,
  Clock3,
} from "lucide-react";
import type { DashboardData } from "@/lib/models";
import { money } from "@/lib/finances";
import { londonDate } from "@/lib/scheduling";
import { calendarDate } from "@/lib/recurring-bookings";
import {
  financeReport,
  financePeriod,
  financeCsv,
  monthName,
  phaseLabels,
  type FinancePreset,
  type FinancePhase,
  type IncomeTotals,
} from "@/lib/finance-report";
import { Button } from "./ui/button";
import { VisitFinances } from "./booking-rates";

const hours = (minutes: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(
    minutes / 60,
  );
const pageSize = 25;
export function AdminFinances({
  data,
  today,
  asOf,
  onSaved,
}: {
  data: DashboardData;
  today: string;
  asOf: string;
  onSaved: () => Promise<void>;
}) {
  const [preset, setPreset] = useState<FinancePreset>("all");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [customerId, setCustomer] = useState(""),
    [cleanerId, setCleaner] = useState("");
  const [groupBy, setGroupBy] = useState<"customer" | "cleaner">("customer");
  const [ledgerPhase, setLedgerPhase] = useState<
    FinancePhase | "all" | "unpriced"
  >("all");
  const [page, setPage] = useState(1),
    [editingId, setEditing] = useState<string | null>(null);
  const result = useMemo(() => {
    try {
      return {
        report: financeReport(data, { from, to, customerId, cleanerId }, asOf),
        error: "",
      };
    } catch (error) {
      return {
        report: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare the report.",
      };
    }
  }, [data, from, to, customerId, cleanerId, asOf]);
  const { report, error } = result;
  const rows =
    report?.rows.filter(
      (row) =>
        ledgerPhase === "all" ||
        (ledgerPhase === "unpriced"
          ? !row.rates && row.phase !== "cancelled"
          : row.phase === ledgerPhase),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)),
    currentPage = Math.min(page, pages);
  const displayed = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const edited = report?.rows.find((row) => row.visit.id === editingId);
  const groups = report
    ? groupBy === "customer"
      ? report.byCustomer
      : report.byCleaner
    : [];
  const selectPeriod = (next: FinancePreset) => {
    setPreset(next);
    if (next !== "custom") {
      const period = financePeriod(next, today);
      setFrom(period.from);
      setTo(period.to);
    }
    setPage(1);
  };
  const clear = () => {
    selectPeriod("all");
    setCustomer("");
    setCleaner("");
    setLedgerPhase("all");
    setEditing(null);
  };
  const focusLedger = (phase: FinancePhase | "unpriced") => {
    setLedgerPhase(phase);
    setPage(1);
    document
      .getElementById("finance-visits")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const exportCsv = () => {
    const blob = new Blob(["\ufeff", financeCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `cleaning-maidstone-finances-${from || "all"}-${to || "dates"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="admin-finances">
      <section className="panel financial-filters" aria-label="Finance filters">
        <div className="financial-panel-heading">
          <div>
            <h2>Choose your view</h2>
            <p>Amounts follow each visit’s scheduled start date in London.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>
            Reset filters
          </Button>
        </div>
        <div className="financial-filter-fields">
          <label>
            Date range
            <select
              value={preset}
              onChange={(event) =>
                selectPeriod(event.target.value as FinancePreset)
              }
            >
              <option value="all">All dates</option>
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="next-month">Next month</option>
              <option value="next-30">Next 30 days</option>
              <option value="this-year">This year</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <label>
            From date
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPreset("custom");
                setPage(1);
              }}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPreset("custom");
                setPage(1);
              }}
            />
          </label>
          <label>
            Customer
            <select
              value={customerId}
              className="person-input-customer"
              onChange={(event) => {
                setCustomer(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All customers</option>
              {[...data.customers]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Cleaner
            <select
              value={cleanerId}
              className="person-input-cleaner"
              onChange={(event) => {
                setCleaner(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All cleaners</option>
              {[...data.cleaners]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cleaner) => (
                  <option key={cleaner.id} value={cleaner.id}>
                    {cleaner.name}
                    {!cleaner.active ? " (inactive)" : ""}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <p className="financial-period" aria-live="polite">
          {from && to
            ? `${calendarDateSafe(from)} – ${calendarDateSafe(to)}`
            : from
              ? `From ${calendarDateSafe(from)}`
              : to
                ? `Through ${calendarDateSafe(to)}`
                : "All recorded and currently booked visits"}{" "}
          · GBP
        </p>
      </section>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <p className="financial-basis">
            Completed visits count as earned. Booked forecast covers future and
            ongoing visits. Past visits awaiting completion stay separate.
            Payment receipt and subscription billing will be tracked later.
          </p>
          {report.total.unpricedVisits > 0 && (
            <div className="financial-warning" role="status">
              <div>
                <strong>
                  Rates missing for {report.total.unpricedVisits}{" "}
                  {report.total.unpricedVisits === 1 ? "visit" : "visits"}
                </strong>
                <p>
                  Totals include {report.total.pricedVisits} of{" "}
                  {report.total.visits} active visits. Add rates to complete the
                  picture.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => focusLedger("unpriced")}
              >
                Review missing rates
              </Button>
            </div>
          )}
          <div className="financial-metrics">
            <Metric
              title="Earned admin share"
              totals={report.earned}
              icon={<CircleCheck size={19} />}
              className="income-earned"
              onClick={() => focusLedger("earned")}
              description="From completed visits"
            />
            <Metric
              title="Booked admin forecast"
              totals={report.forecast}
              icon={<CalendarClock size={19} />}
              className="income-forecast"
              onClick={() => focusLedger("forecast")}
              description="Future and ongoing visits"
            />
            <Metric
              title="Awaiting completion"
              totals={report.awaiting}
              icon={<Clock3 size={19} />}
              className="income-awaiting"
              onClick={() => focusLedger("awaiting")}
              description="Past visits still to confirm"
            />
            <Metric
              title="Total admin value"
              totals={report.total}
              icon={<CirclePoundSterling size={19} />}
              className="income-total"
              description="Earned + forecast + awaiting"
            />
          </div>
          <div className="financial-summary-grid">
            <section className="panel" aria-label="Income split">
              <h2>Where the money goes</h2>
              <p>Customer charges, your share and cash due to cleaners.</p>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Income split table"
              >
                <table className="financial-split">
                  <thead>
                    <tr>
                      <th scope="col">Visits</th>
                      <th scope="col">Customer charge</th>
                      <th scope="col">Admin share</th>
                      <th scope="col">Cleaner cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["earned", "forecast", "awaiting"] as const).map(
                      (phase) => (
                        <tr key={phase}>
                          <th scope="row">
                            {phaseLabels[phase]}
                            <small>
                              {report[phase].visits}{" "}
                              {report[phase].visits === 1 ? "visit" : "visits"}{" "}
                              · {hours(report[phase].minutes)} hours
                            </small>
                          </th>
                          <td>{money(report[phase].customer)}</td>
                          <td>{money(report[phase].admin)}</td>
                          <td>{money(report[phase].cleaner)}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total visit value</th>
                      <td>{money(report.total.customer)}</td>
                      <td>{money(report.total.admin)}</td>
                      <td>{money(report.total.cleaner)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="financial-footnote">
                {report.cancelled.visits} cancelled{" "}
                {report.cancelled.visits === 1 ? "visit" : "visits"} excluded
                from income. {report.total.visits} active visits ·{" "}
                {hours(report.total.minutes)} booked hours.
              </p>
            </section>
            <section
              className="panel financial-monthly"
              aria-label="Monthly admin income"
            >
              <h2>Your income over time</h2>
              <p>Select a month to explore its visits.</p>
              <div className="financial-legend">
                <span className="legend-earned">Earned</span>
                <span className="legend-forecast">Booked forecast</span>
                <span className="legend-awaiting">Awaiting completion</span>
              </div>
              <div className="financial-month-list">
                {report.months.map((month) => {
                  const maximum = Math.max(
                    ...report.months.map((m) => m.total.admin),
                    1,
                  );
                  return (
                    <button
                      type="button"
                      className="financial-month"
                      key={month.id}
                      aria-label={`${monthName(month.id)}: earned ${money(month.earned.admin)}, forecast ${money(month.forecast.admin)}, awaiting ${money(month.awaiting.admin)}`}
                      onClick={() => {
                        const range = financePeriod(
                          "this-month",
                          `${month.id}-01`,
                        );
                        setFrom(range.from);
                        setTo(range.to);
                        setPreset("custom");
                        setPage(1);
                      }}
                    >
                      <span>{monthName(month.id)}</span>
                      <span className="financial-month-bar" aria-hidden="true">
                        {(["earned", "forecast", "awaiting"] as const).map(
                          (phase) => (
                            <i
                              key={phase}
                              className={`bar-${phase}`}
                              style={{
                                width: `${(month[phase].admin / maximum) * 100}%`,
                              }}
                            />
                          ),
                        )}
                      </span>
                      <strong>{money(month.total.admin)}</strong>
                    </button>
                  );
                })}
              </div>
              {!report.months.length && (
                <p className="empty-state">No active visits in this view.</p>
              )}
              <p className="financial-footnote">
                Monthly admin value from priced visits. Months with visits are
                shown.
              </p>
            </section>
          </div>
          <section className="panel" aria-label="Finance breakdown">
            <div className="financial-panel-heading">
              <div>
                <h2>By customer & cleaner</h2>
                <p>Compare visit value, earned share and future work.</p>
              </div>
              <div
                className="financial-tabs"
                role="group"
                aria-label="Group finances"
              >
                <Button
                  variant={groupBy === "customer" ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={groupBy === "customer"}
                  onClick={() => setGroupBy("customer")}
                >
                  By customer
                </Button>
                <Button
                  variant={groupBy === "cleaner" ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={groupBy === "cleaner"}
                  onClick={() => setGroupBy("cleaner")}
                >
                  By cleaner
                </Button>
              </div>
            </div>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label={
                groupBy === "customer"
                  ? "Customer finance breakdown"
                  : "Cleaner finance breakdown"
              }
            >
              <table className="financial-breakdown">
                <thead>
                  <tr>
                    <th scope="col">
                      {groupBy === "customer" ? "Customer" : "Cleaner"}
                    </th>
                    <th scope="col">Visits / hours</th>
                    <th scope="col">Customer value</th>
                    <th scope="col">Admin earned</th>
                    <th scope="col">Admin forecast</th>
                    <th scope="col">Awaiting completion</th>
                    <th scope="col">Cleaner cash</th>
                    <th scope="col">Missing rates</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="financial-name"
                          onClick={() => {
                            if (groupBy === "customer") setCustomer(group.id);
                            else setCleaner(group.id);
                            setPage(1);
                          }}
                        >
                          <PersonName kind={groupBy}>{group.name}</PersonName>
                          <ArrowUpRight size={12} />
                        </button>
                      </th>
                      <td>
                        {group.total.visits}
                        <small>{hours(group.total.minutes)} hours</small>
                      </td>
                      <td>{money(group.total.customer)}</td>
                      <td>{money(group.earned.admin)}</td>
                      <td>{money(group.forecast.admin)}</td>
                      <td>{money(group.awaiting.admin)}</td>
                      <td>{money(group.total.cleaner)}</td>
                      <td>{group.total.unpricedVisits || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!groups.length && (
              <p className="empty-state">
                No active visits match these filters.
              </p>
            )}
            <p className="financial-footnote">
              Values include completed, booked and awaiting completion visits.
              Select a name to filter the report.
            </p>
          </section>
          <section
            className="panel financial-ledger"
            id="finance-visits"
            aria-label="Financial visit list"
          >
            <div className="financial-panel-heading">
              <div>
                <h2>Every visit, accounted for</h2>
                <p>
                  Review the rates and value of each one-off or recurring visit.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <ArrowDownToLine size={14} />
                Export CSV
              </Button>
            </div>
            <div className="financial-ledger-controls">
              <label>
                Show visits
                <select
                  value={ledgerPhase}
                  onChange={(event) => {
                    setLedgerPhase(event.target.value as typeof ledgerPhase);
                    setPage(1);
                  }}
                >
                  <option value="all">All visits</option>
                  <option value="earned">Completed</option>
                  <option value="forecast">Booked forecast</option>
                  <option value="awaiting">Awaiting completion</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="unpriced">Missing rates</option>
                </select>
              </label>
              <p aria-live="polite">
                {rows.length
                  ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} visits`
                  : "0 visits"}
              </p>
            </div>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Financial visits table"
            >
              <table className="financial-visits">
                <thead>
                  <tr>
                    <th scope="col">Visit</th>
                    <th scope="col">Customer / cleaner</th>
                    <th scope="col">Income category</th>
                    <th scope="col">Customer charge</th>
                    <th scope="col">Admin share</th>
                    <th scope="col">Cleaner cash</th>
                    <th scope="col">Rates</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row) => (
                    <tr
                      key={row.visit.id}
                      data-visit-id={row.visit.id}
                      className={
                        row.phase === "cancelled" ? "financial-cancelled" : ""
                      }
                    >
                      <td>
                        {calendarDate(row.date)}
                        <small>
                          {londonDate(row.visit.starts_at, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                            .split(", ")
                            .pop()}{" "}
                          · {hours(row.minutes)} hours
                        </small>
                        <small>
                          {row.visit.series_id ? "Recurring" : "One-off"}
                        </small>
                      </td>
                      <td>
                        <strong>
                          <PersonName kind="customer">
                            {row.customer}
                          </PersonName>
                        </strong>
                        <small>
                          <PersonName kind="cleaner">{row.cleaner}</PersonName>
                        </small>
                      </td>
                      <td>
                        <span className={`badge badge-finance-${row.phase}`}>
                          {phaseLabels[row.phase]}
                        </span>
                        <small>{row.visit.status}</small>
                      </td>
                      {(["customer", "admin", "cleaner"] as const).map(
                        (kind) => (
                          <td key={kind}>
                            {row.amounts ? money(row.amounts[kind]) : "Not set"}
                            {row.rates && (
                              <small>
                                {money(row.rates[`${kind}_rate_pence`])} / hour
                              </small>
                            )}
                          </td>
                        ),
                      )}
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(
                              editingId === row.visit.id ? null : row.visit.id,
                            );
                          }}
                          aria-label={`${row.rates ? "Edit" : "Set"} rates for ${row.customer} on ${calendarDate(row.date)}`}
                        >
                          {row.rates ? "Edit rates" : "Set rates"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="empty-state">No visits match these filters.</p>
            )}
            {pages > 1 && (
              <div className="financial-pagination">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous visits
                </Button>
                <span>
                  Page {currentPage} of {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next visits
                </Button>
              </div>
            )}
            <p className="financial-footnote">
              CSV exports every visit matching the filters and “Show visits”,
              across all pages. Cancelled quotes remain visible for reference.
            </p>
            {edited && (
              <div
                className="financial-rate-editor"
                aria-label="Edit financial visit"
              >
                <div className="financial-panel-heading">
                  <p>
                    <strong>
                      <PersonName kind="customer">{edited.customer}</PersonName>
                    </strong>{" "}
                    · {calendarDate(edited.date)} ·{" "}
                    <PersonName kind="cleaner">{edited.cleaner}</PersonName>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(null)}
                  >
                    Close rate editor
                  </Button>
                </div>
                <VisitFinances
                  visit={edited.visit}
                  rates={edited.rates}
                  onSaved={onSaved}
                />
              </div>
            )}
          </section>
          <p className="financial-as-of">
            Figures as of{" "}
            {londonDate(asOf, {
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            London time. Use Refresh to load the latest visit changes.
          </p>
        </>
      )}
    </div>
  );
}
function calendarDateSafe(date: string) {
  try {
    return calendarDate(date);
  } catch {
    return date;
  }
}
function Metric({
  title,
  totals,
  icon,
  className,
  description,
  onClick,
}: {
  title: string;
  totals: IncomeTotals;
  icon: React.ReactNode;
  className: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <div className={`financial-metric ${className}`} aria-label={title}>
      <div className="financial-metric-title">
        <span>{title}</span>
        {icon}
      </div>
      <strong>{money(totals.admin)}</strong>
      <p>{description}</p>
      <small>
        {totals.visits} {totals.visits === 1 ? "visit" : "visits"} ·{" "}
        {hours(totals.minutes)} {totals.minutes === 60 ? "hour" : "hours"}
        {totals.unpricedVisits > 0
          ? ` · ${totals.unpricedVisits} unpriced`
          : ""}
      </small>
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`View ${title.toLowerCase()} visits`}
        >
          View visits <ArrowUpRight size={12} />
        </button>
      )}
    </div>
  );
}
