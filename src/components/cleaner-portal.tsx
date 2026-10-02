"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, List, LockKeyhole } from "lucide-react";
import type { CleanerJob, RequestRecord } from "@/lib/models";
import { londonDate } from "@/lib/scheduling";
import { Button } from "./ui/button";
import { useLiveWorkspace } from "./use-live-workspace";
import { OperationForm, Field, sendOperation } from "./operation-form";
const CleanerCalendar = dynamic(() => import("./cleaner-calendar"), {
  ssr: false,
  loading: () => <p role="status">Loading your calendar…</p>,
});
type Data = {
  jobs: CleanerJob[];
  leave: RequestRecord[];
  availability: RequestRecord[];
};
export function CleanerPortal({
  initialData,
  demo,
}: {
  initialData: Data;
  demo: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const selectedJob = data.jobs.find((job) => job.id === selected);
  useEffect(() => {
    if (selected) detailRef.current?.focus();
  }, [selected]);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/operations/");
    if (!r.ok) throw new Error("Could not refresh your rota");
    setData(await r.json());
  }, []);
  useLiveWorkspace(!demo, refresh, true);
  return (
    <div
      className={
        "cleaner-container" + (view === "calendar" ? " calendar-active" : "")
      }
    >
      <h1>Your rota.</h1>
      <p>A clear view of your assigned work. Times are Europe/London.</p>
      <div className="rota-view-controls" role="group" aria-label="Rota view">
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          <List size={16} />
          List view
        </button>
        <button
          type="button"
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        >
          <CalendarDays size={16} />
          Calendar view
        </button>
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {view === "calendar" && (
        <>
          <p className="rota-readonly">
            <LockKeyhole size={14} />
            Your admin manages the rota. Select a visit to see your job details.
          </p>
          <CleanerCalendar
            jobs={data.jobs}
            onSelect={(job) => setSelected(job.id)}
          />
          {selectedJob && (
            <section
              ref={detailRef}
              id="assigned-visit"
              tabIndex={-1}
              role="region"
              aria-label="Assigned visit"
            >
              <div className="rota-detail-heading">
                <h2>Assigned visit</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  Close visit details
                </Button>
              </div>
              <JobCard job={selectedJob} onSaved={refresh} onError={setError} />
            </section>
          )}
        </>
      )}
      {view === "list" &&
        data.jobs
          .filter((j) => j.status !== "completed")
          .map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSaved={refresh}
              onError={setError}
            />
          ))}
      {view === "list" &&
        !data.jobs.filter((j) => j.status !== "completed").length && (
          <p className="empty-state">No upcoming assigned jobs.</p>
        )}
      {view === "list" && (
        <details className="panel">
          <summary>
            Completed visits (
            {data.jobs.filter((j) => j.status === "completed").length})
          </summary>
          {data.jobs
            .filter((j) => j.status === "completed")
            .map((j) => (
              <p key={j.id}>
                {j.customer_name} · {londonDate(j.starts_at)}
              </p>
            ))}
        </details>
      )}
      <RequestPanels data={data} refresh={refresh} />
    </div>
  );
}
function JobCard({
  job,
  onSaved,
  onError,
}: {
  job: CleanerJob;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <article className="job-card">
      <span className="badge">{job.status}</span>
      <h2>{job.customer_name}</h2>
      <p className="job-time">
        {londonDate(job.starts_at, {
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        –{" "}
        {londonDate(job.ends_at, { hour: "2-digit", minute: "2-digit" })
          .split(", ")
          .pop()}
      </p>
      <address>
        {job.address}
        <br />
        {job.postcode}
      </address>
      <p style={{ marginTop: 18 }}>
        {job.instructions || "No additional instructions for this visit."}
      </p>
      {job.status !== "completed" && (
        <Button
          size="sm"
          onClick={async () => {
            try {
              await sendOperation("transition", {
                id: job.id,
                status: job.status === "scheduled" ? "started" : "completed",
              });
              await onSaved();
            } catch (e) {
              onError(
                e instanceof Error ? e.message : "Could not update visit.",
              );
            }
          }}
        >
          {job.status === "scheduled" ? "Mark as started" : "Mark as completed"}
        </Button>
      )}
    </article>
  );
}
function RequestPanels({
  data,
  refresh,
}: {
  data: Data;
  refresh: () => Promise<void>;
}) {
  return (
    <>
      <section className="panel">
        <h2>Request time off</h2>
        <OperationForm
          action="leave"
          onSaved={refresh}
          label="Send leave request"
          map={(f) => Object.fromEntries(f)}
        >
          <div className="form-grid">
            <Field name="starts_on" label="From" type="date" required />
            <Field name="ends_on" label="To" type="date" required />
          </div>
          <label>
            Note for your admin
            <textarea name="reason" />
          </label>
        </OperationForm>
        <ul className="data-list">
          {data.leave.map((r) => (
            <li key={r.id}>
              <small>
                {r.starts_on}–{r.ends_on}
              </small>
              <span className={"badge badge-" + r.status}>{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2>Request an availability change</h2>
        <OperationForm
          action="availability"
          onSaved={refresh}
          label="Send availability request"
          map={(f) => ({
            weekday: Number(f.get("weekday")),
            start_time: f.get("start_time"),
            end_time: f.get("end_time"),
          })}
        >
          <label>
            Day
            <select name="weekday">
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <Field
              name="start_time"
              label="Available from"
              type="time"
              required
            />
            <Field
              name="end_time"
              label="Available until"
              type="time"
              required
            />
          </div>
        </OperationForm>
        <p className="form-small">
          Your current rota stays in place until an admin approves the change.
        </p>
        <ul className="data-list">
          {data.availability.map((r) => (
            <li key={r.id}>
              <small>
                {
                  [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ][r.weekday!]
                }{" "}
                {r.start_time}–{r.end_time}
              </small>
              <span className={"badge badge-" + r.status}>{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
      <details className="panel">
        <summary>Set or change your account password</summary>
        <form className="ops-form" action="/api/auth/password/" method="post">
          <Field
            name="password"
            label="New password (at least 12 characters)"
            type="password"
            required
          />
          <Button type="submit" size="sm">
            Save password
          </Button>
        </form>
      </details>
    </>
  );
}
