"use client";
import Link from "next/link";
import { useState } from "react";
import type { DashboardData, Visit } from "@/lib/models";
import { availableCoverCleaners, visitsNeedingCover } from "@/lib/leave-cover";
import { calendarDate } from "@/lib/recurring-bookings";
import { londonDate } from "@/lib/scheduling";
import { OperationForm } from "./operation-form";
import { Button } from "./ui/button";

export function LeaveRequests({
  data,
  refresh,
  review,
}: {
  data: DashboardData;
  refresh: () => Promise<void>;
  review: (id: string, status: "approved" | "declined") => Promise<void>;
}) {
  const requests = [...data.leave_requests].sort(
    (a, b) =>
      Number(b.status === "pending") - Number(a.status === "pending") ||
      (a.starts_on ?? "").localeCompare(b.starts_on ?? "") ||
      a.id.localeCompare(b.id),
  );
  return (
    <section
      className="panel leave-requests"
      id="time-off"
      aria-label="Time-off requests"
    >
      <h2>Time-off requests & cover</h2>
      <p className="form-small">
        Review each cleaner’s dates and arrange cover for the cleans below
        before approving leave. All dates and times are UK local time.
      </p>
      {!requests.length && (
        <p className="empty-state">No time-off requests yet.</p>
      )}
      <div className="leave-request-list">
        {requests.map((request) => {
          const cleaner = data.cleaners.find(
            (c) => c.id === request.cleaner_id,
          );
          const cover = visitsNeedingCover(request, data.visits);
          const pending = request.status === "pending";
          return (
            <article
              className="leave-request"
              key={request.id}
              aria-label={`Time off for ${cleaner?.name ?? "Cleaner"}: ${request.starts_on} to ${request.ends_on}`}
            >
              <header className="leave-request-heading">
                <div>
                  <h3>{cleaner?.name ?? "Cleaner"}</h3>
                  <p>
                    {request.starts_on && calendarDate(request.starts_on)} –{" "}
                    {request.ends_on && calendarDate(request.ends_on)}
                  </p>
                  {request.reason && (
                    <p className="leave-reason">{request.reason}</p>
                  )}
                </div>
                <span className={`badge badge-${request.status}`}>
                  {request.status}
                </span>
              </header>
              {pending && (
                <>
                  <h4 className="leave-cover-count" aria-live="polite">
                    {cover.length
                      ? `${cover.length} ${cover.length === 1 ? "clean needs" : "cleans need"} cover`
                      : "No cleans need cover"}
                  </h4>
                  {cover.length ? (
                    <ul className="leave-cover-list">
                      {cover.map((visit) => (
                        <CoverVisit
                          key={visit.id}
                          visit={visit}
                          data={data}
                          refresh={refresh}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="form-small">
                      No scheduled or in-progress cleans are assigned to this
                      cleaner during these dates. You can approve the request.
                    </p>
                  )}
                  <div className="inline-actions">
                    <ReviewButton
                      requestId={request.id}
                      status="approved"
                      disabled={cover.length > 0}
                      review={review}
                    />
                    <ReviewButton
                      requestId={request.id}
                      status="declined"
                      review={review}
                    />
                  </div>
                  {cover.length > 0 && (
                    <p className="form-small">
                      Assign cover or reschedule these cleans before approving.
                      The list updates as you arrange cover.
                    </p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReviewButton({
  requestId,
  status,
  disabled,
  review,
}: {
  requestId: string;
  status: "approved" | "declined";
  disabled?: boolean;
  review: (id: string, status: "approved" | "declined") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={status === "approved" ? "default" : "outline"}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await review(requestId, status);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Saving…" : status === "approved" ? "Approve" : "Decline"}
    </Button>
  );
}

function CoverVisit({
  visit,
  data,
  refresh,
}: {
  visit: Visit;
  data: DashboardData;
  refresh: () => Promise<void>;
}) {
  const [assigning, setAssigning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const customer = data.customers.find((c) => c.id === visit.customer_id);
  const alternatives = assigning ? availableCoverCleaners(data, visit) : [];
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const hours =
    (Date.parse(visit.ends_at) - Date.parse(visit.starts_at)) / 3_600_000;
  return (
    <li
      className="leave-cover-visit"
      aria-label={`Clean for ${customer?.name ?? "Customer"} on ${londonDate(visit.starts_at, { year: "numeric" })}`}
    >
      <div className="leave-cover-details">
        <strong>{customer?.name ?? "Customer"}</strong>
        <span>
          {londonDate(visit.starts_at, { weekday: "short", year: "numeric" })} ·{" "}
          {time.format(new Date(visit.starts_at))}–
          {time.format(new Date(visit.ends_at))} ·{" "}
          {hours.toLocaleString("en-GB", { maximumFractionDigits: 2 })}{" "}
          {hours === 1 ? "hour" : "hours"}
        </span>
        <span>
          {[customer?.address, customer?.postcode].filter(Boolean).join(", ") ||
            "Address not recorded"}
        </span>
        <span className="leave-cover-tags">
          <span className="badge">
            {visit.series_id ? "Recurring visit" : "One-off visit"}
          </span>
          {visit.status === "started" && (
            <span className="badge badge-pending">In progress</span>
          )}
        </span>
      </div>
      <div className="inline-actions">
        <Button
          size="sm"
          variant="outline"
          aria-expanded={assigning}
          disabled={checking}
          onClick={async () => {
            setAvailabilityError("");
            if (assigning) {
              setAssigning(false);
              return;
            }
            setChecking(true);
            try {
              await refresh();
              setAssigning(true);
            } catch {
              setAvailabilityError(
                "Could not check cover availability. Try again.",
              );
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking
            ? "Checking availability…"
            : assigning
              ? "Close cover options"
              : "Assign cover"}
        </Button>
        <Link
          className="text-link"
          href={`/admin/calendar/?visit=${encodeURIComponent(visit.id)}`}
        >
          Open visit
        </Link>
      </div>
      {availabilityError && (
        <p className="alert alert-error" role="alert">
          {availabilityError}
        </p>
      )}
      {assigning &&
        (alternatives.length ? (
          <OperationForm
            action="visit"
            label="Save cover assignment"
            onSaved={refresh}
            map={(form) => ({
              id: visit.id,
              cleaner_id: form.get("cleaner_id"),
            })}
          >
            <label>
              Cover cleaner
              <select
                key={alternatives.map((c) => c.id).join(":")}
                name="cleaner_id"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Choose an available cleaner
                </option>
                {alternatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="form-small">
              Only cleaners free for the whole visit are shown. Availability is
              checked again when you save. This changes only this visit; its
              time and agreed rates stay the same.
            </p>
          </OperationForm>
        ) : (
          <p className="form-small">
            No cleaners are available for the whole visit. Open the visit to
            arrange another time, or update a cleaner’s working hours.
          </p>
        ))}
    </li>
  );
}
