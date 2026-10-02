"use client";
import { useState, useCallback } from "react";
import type { CleanerJob, RequestRecord } from "@/lib/models";
import { londonDate } from "@/lib/scheduling";
import { Button } from "./ui/button";
import { useLiveWorkspace } from "./use-live-workspace";
import { OperationForm, Field, sendOperation } from "./operation-form";
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
  const refresh = useCallback(async () => {
    const r = await fetch("/api/operations/");
    if (!r.ok) throw new Error("Could not refresh your rota");
    setData(await r.json());
  }, []);
  useLiveWorkspace(!demo, refresh, true);
  return (
    <div className="cleaner-container">
      <h1>Your rota.</h1>
      <p>A clear view of your assigned work. Times are Europe/London.</p>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {data.jobs
        .filter((j) => j.status !== "completed")
        .map((job) => (
          <article className="job-card" key={job.id}>
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
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await sendOperation("transition", {
                    id: job.id,
                    status:
                      job.status === "scheduled" ? "started" : "completed",
                  });
                  await refresh();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not update visit.",
                  );
                }
              }}
            >
              {job.status === "scheduled"
                ? "Mark as started"
                : "Mark as completed"}
            </Button>
          </article>
        ))}
      {!data.jobs.filter((j) => j.status !== "completed").length && (
        <p className="empty-state">No upcoming assigned jobs.</p>
      )}
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
    </div>
  );
}
