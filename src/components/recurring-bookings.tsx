"use client";
import { PersonName } from "./person-name";
import { useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/models";
import { recurringSummaries, calendarDate } from "@/lib/recurring-bookings";
import { FinanceSummary } from "./booking-rates";
import { Button } from "./ui/button";
import { OperationForm, Field, useConfirmedOperation } from "./operation-form";
import { ActionCancelled, adminConfirmation } from "@/lib/admin-confirmation";

const labels = {
  "ending-soon": "Ending soon",
  active: "Active",
  upcoming: "Upcoming",
  ended: "Ended",
  cancelled: "Cancelled",
};
export function RecurringBookings({
  data,
  today,
  onSaved,
}: {
  data: DashboardData;
  today: string;
  onSaved: () => Promise<void>;
}) {
  const [filter, setFilter] = useState("all");
  const sendOperation = useConfirmedOperation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const summaries = recurringSummaries(data, today);
  const displayed = summaries.filter(({ series, status }) => {
    const customer = data.customers.find((c) => c.id === series.customer_id);
    const cleaner = data.cleaners.find((c) => c.id === series.cleaner_id);
    return (
      (filter === "all" ||
        (filter === "active"
          ? ["active", "upcoming", "ending-soon"].includes(status)
          : status === filter)) &&
      [customer?.name, customer?.postcode, customer?.email, cleaner?.name]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );
  });
  return (
    <>
      <div className="metric-grid recurring-metrics">
        <div className="metric-card">
          <span>Active & upcoming</span>
          <strong>
            {
              summaries.filter(
                (s) => !["ended", "cancelled"].includes(s.status),
              ).length
            }
          </strong>
        </div>
        <div className="metric-card">
          <span>Ending within a month</span>
          <strong>
            {summaries.filter((s) => s.status === "ending-soon").length}
          </strong>
        </div>
        <div className="metric-card">
          <span>Ended bookings</span>
          <strong>
            {summaries.filter((s) => s.status === "ended").length}
          </strong>
        </div>
      </div>
      <section
        className="panel recurring-list"
        aria-label="Recurring bookings list"
      >
        <div className="recurring-list-heading">
          <div>
            <h2>Your recurring bookings</h2>
            <p>
              Follow up from one calendar month before the end date. The booking
              period stays fixed when individual visits change.
            </p>
          </div>
          <Link
            className="button button-outline button-sm"
            href="/admin/calendar/"
          >
            Create a booking
          </Link>
        </div>
        <div className="search-row recurring-filters">
          <label>
            Search recurring bookings
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, cleaner, postcode…"
            />
          </label>
          <label>
            Booking status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All bookings</option>
              <option value="ending-soon">Ending within a month</option>
              <option value="active">Active & upcoming</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-small" role="status">
          {displayed.length} recurring{" "}
          {displayed.length === 1 ? "booking" : "bookings"}
        </p>
        {displayed.map(
          ({
            series,
            status,
            followUpOn,
            daysLeft,
            visitCount,
            remainingVisits,
          }) => {
            const customer = data.customers.find(
              (c) => c.id === series.customer_id,
            );
            const cleaner = data.cleaners.find(
              (c) => c.id === series.cleaner_id,
            );
            const title = `Follow up: ${customer?.name || "Customer"} recurring cleaning ends ${series.ends_on}`;
            const existingTask = data.tasks.find(
              (task) => task.title === title && !task.done,
            );
            return (
              <article
                className={`recurring-booking recurring-${status}`}
                key={series.id}
                data-series-id={series.id}
                aria-label={`${customer?.name || "Customer"} recurring booking`}
              >
                <div className="recurring-booking-heading">
                  <div>
                    <h3>
                      <PersonName kind="customer">
                        {customer?.name || "Customer"}
                      </PersonName>
                    </h3>
                    <p>
                      {customer?.postcode} ·{" "}
                      <PersonName kind="cleaner">
                        {cleaner?.name || "Cleaner"}
                      </PersonName>{" "}
                      · {series.local_time.slice(0, 5)} London time
                    </p>
                  </div>
                  <span className={`badge badge-${status}`}>
                    {labels[status]}
                  </span>
                </div>
                <dl className="recurring-booking-dates">
                  <div>
                    <dt>Start date</dt>
                    <dd>{calendarDate(series.anchor_date)}</dd>
                  </div>
                  <div>
                    <dt>End date</dt>
                    <dd>{calendarDate(series.ends_on)}</dd>
                  </div>
                  <div>
                    <dt>Frequency & period</dt>
                    <dd>
                      {series.interval_weeks === 1 ? "Weekly" : "Fortnightly"} ·{" "}
                      {series.duration_weeks}{" "}
                      {series.duration_weeks === 1 ? "week" : "weeks"}
                    </dd>
                  </div>
                  <div>
                    <dt>Visits</dt>
                    <dd>
                      {visitCount} booked · {remainingVisits} remaining
                    </dd>
                  </div>
                </dl>
                <FinanceSummary
                  rates={data.series_finances.find((f) => f.id === series.id)}
                  minutes={series.duration_minutes}
                  label="Agreed rates per regular visit"
                />
                <div className="recurring-followup-row">
                  <p>
                    {status === "ended"
                      ? `Ended ${Math.abs(daysLeft)} ${daysLeft === -1 ? "day" : "days"} ago`
                      : status === "cancelled"
                        ? "This booking has no active visits."
                        : status === "ending-soon"
                          ? daysLeft === 0
                            ? "Booking ends today"
                            : `Ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`
                          : `Follow up from ${calendarDate(followUpOn)}`}
                    {existingTask && (
                      <span className="recurring-task-note">
                        Follow-up task due {calendarDate(existingTask.due_on)}
                      </span>
                    )}
                  </p>
                  <div className="inline-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFollowUpId(
                          followUpId === series.id ? null : series.id,
                        )
                      }
                    >
                      {followUpId === series.id
                        ? "Close follow-up"
                        : "Follow up"}
                      <span className="sr-only">
                        {" "}
                        for {customer?.name || "Customer"}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="delete-series"
                      disabled={deletingId !== null}
                      onClick={async () => {
                        setError("");
                        setDeletingId(series.id);
                        const related = data.visits.filter(
                          (visit) => visit.series_id === series.id,
                        );
                        const removable = related.filter(
                          (visit) =>
                            Date.parse(visit.starts_at) > Date.now() &&
                            ["scheduled", "cancelled"].includes(visit.status),
                        ).length;
                        try {
                          await sendOperation(
                            "delete_series",
                            { id: series.id },
                            {
                              ...adminConfirmation("delete_series", {}),
                              customerName: customer?.name || "Customer",
                              cleanerName: cleaner?.name || "Cleaner",
                              description: `Booking period: ${calendarDate(series.anchor_date)} to ${calendarDate(series.ends_on)}, ${series.interval_weeks === 1 ? "weekly" : "fortnightly"} at ${series.local_time.slice(0, 5)}. Remove this series from recurring bookings and permanently delete ${removable} upcoming unstarted ${removable === 1 ? "visit" : "visits"}. Keep ${related.length - removable} past, completed or in-progress ${related.length - removable === 1 ? "visit" : "visits"} and their financial history. Other series and one-off visits stay unchanged. This cannot be undone.`,
                            },
                          );
                          await onSaved();
                        } catch (error) {
                          if (!(error instanceof ActionCancelled))
                            setError(
                              error instanceof Error
                                ? error.message
                                : "Could not delete the series.",
                            );
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      {deletingId === series.id ? "Deleting…" : "Delete series"}
                      <span className="sr-only">
                        {" "}
                        for {customer?.name || "Customer"}
                      </span>
                    </Button>
                  </div>
                </div>
                {followUpId === series.id && (
                  <div
                    className="recurring-followup"
                    aria-label={`Follow up with ${customer?.name || "customer"}`}
                  >
                    <p>
                      Contact{" "}
                      <PersonName kind="customer">
                        {customer?.name || "the customer"}
                      </PersonName>{" "}
                      to discuss continuing their regular cleaning.
                    </p>
                    <div className="recurring-contact-links">
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
                        >
                          {customer.phone}
                        </a>
                      )}
                      {customer?.email && (
                        <a href={`mailto:${customer.email}`}>
                          {customer.email}
                        </a>
                      )}
                    </div>
                    {existingTask ? (
                      <p className="alert">
                        A follow-up task is already open. Manage it on the{" "}
                        <Link className="text-link" href="/admin/">
                          overview
                        </Link>
                        .
                      </p>
                    ) : (
                      <OperationForm
                        action="task"
                        label="Add renewal follow-up"
                        onSaved={onSaved}
                        map={(form) => ({
                          customer_id: series.customer_id,
                          title,
                          due_on: form.get("due_on"),
                          done: false,
                        })}
                      >
                        <Field
                          name="due_on"
                          label="Follow-up date"
                          type="date"
                          value={today > followUpOn ? today : followUpOn}
                          required
                        />
                      </OperationForm>
                    )}
                  </div>
                )}
              </article>
            );
          },
        )}
        {!displayed.length && (
          <p className="empty-state">
            {summaries.length
              ? "No recurring bookings match your filters."
              : "No recurring bookings yet. Create a weekly or fortnightly booking in the calendar."}
          </p>
        )}
      </section>
    </>
  );
}
