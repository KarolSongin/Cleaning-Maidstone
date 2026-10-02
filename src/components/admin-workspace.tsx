"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  DashboardData,
  Customer,
  Visit,
  Content,
  Conversation,
} from "@/lib/models";
import { londonDate, londonInstant } from "@/lib/scheduling";
import { Button } from "./ui/button";
import { OperationForm, Field, sendOperation } from "./operation-form";
import { useLiveWorkspace } from "./use-live-workspace";
const CalendarBoard = dynamic(() => import("./calendar-board"), {
  ssr: false,
  loading: () => <p className="empty-state">Loading calendar…</p>,
});
const ContentEditor = dynamic(() => import("./content-editor"), {
  ssr: false,
  loading: () => <p className="empty-state">Loading editor…</p>,
});
const names: Record<string, string> = {
  overview: "Your business, at a glance.",
  customers: "People & their homes.",
  calendar: "A well-organised week.",
  cleaners: "The people behind the care.",
  conversations: "Every conversation, together.",
  content: "Words that feel like you.",
};
const dateTime = (value: string) =>
  londonDate(value, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const localParts = (value: string) => {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (t: string) => d.find((p) => p.type === t)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};
export function AdminWorkspace({
  initialData,
  section,
  demo,
}: {
  initialData: DashboardData;
  section: string;
  demo: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selectedCustomer, setCustomer] = useState<Customer | undefined>();
  const [selectedVisit, setVisit] = useState<Visit | undefined>();
  const [filter, setFilter] = useState("");
  const [selectedContent, setContent] = useState<Content | undefined>();
  const [selectedConversation, setConversation] = useState<
    Conversation | undefined
  >();
  const refresh = useCallback(async () => {
    const r = await fetch("/api/operations/");
    if (!r.ok) throw new Error("Could not refresh the workspace");
    setData(await r.json());
  }, []);
  useLiveWorkspace(!demo, refresh);
  const run = async (action: string, value: unknown) => {
    setError("");
    try {
      await sendOperation(action, value);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };
  const customerName = (id: string | null) =>
    data.customers.find((c) => c.id === id)?.name || "Unmatched";
  const cleanerName = (id: string) =>
    data.cleaners.find((c) => c.id === id)?.name || "Cleaner";
  const upcoming = data.visits
    .filter((v) => v.status === "scheduled" || v.status === "started")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const enquiryList = data.enquiries
    .filter((e) =>
      [e.name, e.email, e.postcode, e.status]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>{names[section]}</h1>
          <p>
            {section === "calendar"
              ? "Day, week and month views. All times are Europe/London."
              : "A clear place to look after the details."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh().catch((e) => setError(e.message))}
        >
          Refresh
        </Button>
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {section === "overview" && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <span>Upcoming cleans</span>
              <strong>{upcoming.length}</strong>
            </div>
            <div className="metric-card">
              <span>New enquiries</span>
              <strong>
                {data.enquiries.filter((e) => e.status === "new").length}
              </strong>
            </div>
            <div className="metric-card">
              <span>Open follow-ups</span>
              <strong>{data.tasks.filter((t) => !t.done).length}</strong>
            </div>
          </div>
          <div className="ops-columns">
            <section className="panel">
              <h2>Coming up</h2>
              <ul className="data-list">
                {upcoming.slice(0, 8).map((v) => (
                  <li key={v.id}>
                    <div>
                      <strong>{customerName(v.customer_id)}</strong>
                      <small>
                        {dateTime(v.starts_at)} · {cleanerName(v.cleaner_id)}
                      </small>
                    </div>
                    <span className="badge">{v.status}</span>
                  </li>
                ))}
              </ul>
              {!upcoming.length && (
                <p className="empty-state">
                  No upcoming cleans. Create a visit in the calendar.
                </p>
              )}
              <Link className="text-link" href="/admin/calendar/">
                Open calendar ↗
              </Link>
            </section>
            <section className="panel">
              <h2>Follow-up tasks</h2>
              <ul className="data-list">
                {data.tasks.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <small>Due {t.due_on}</small>
                    </div>
                    <button
                      className="button button-outline button-sm"
                      onClick={() =>
                        run("task", {
                          id: t.id,
                          title: t.title,
                          due_on: t.due_on,
                          done: !t.done,
                        })
                      }
                    >
                      {t.done ? "Reopen" : "Complete"}
                    </button>
                  </li>
                ))}
              </ul>
              <OperationForm
                action="task"
                onSaved={refresh}
                label="Add follow-up"
                map={(f) => ({
                  title: f.get("title"),
                  due_on: f.get("due_on"),
                  done: false,
                })}
              >
                <Field label="Task" name="title" required />
                <Field label="Due date" name="due_on" type="date" required />
              </OperationForm>
            </section>
          </div>
        </>
      )}
      {section === "customers" && (
        <>
          <div className="search-row">
            <input
              aria-label="Search customers and enquiries"
              placeholder="Search names, postcodes, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button size="sm" onClick={() => setCustomer(undefined)}>
              New customer
            </Button>
          </div>
          <div className="ops-columns">
            <section className="panel">
              <h2>Customers</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Home</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers
                      .filter((c) =>
                        [c.name, c.email, c.postcode]
                          .join(" ")
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>
                            {c.phone}
                            <small>{c.email}</small>
                          </td>
                          <td>{c.postcode}</td>
                          <td>
                            <button
                              className="button button-outline button-sm"
                              onClick={() => setCustomer(c)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <h2 style={{ marginTop: 30 }}>Enquiries & leads</h2>
              <ul className="data-list">
                {enquiryList.map((e) => (
                  <li key={e.id}>
                    <div>
                      <strong>
                        {e.name} · {e.postcode}
                      </strong>
                      <small>
                        {e.frequency} · {e.home_size} ·{" "}
                        {e.preferred_days.join(", ")}
                      </small>
                      <small>
                        {e.email} · {e.phone}
                      </small>
                      <p>{e.notes}</p>
                      <label>
                        Status
                        <select
                          value={e.status}
                          onChange={(event) =>
                            run("enquiry", {
                              id: e.id,
                              status: event.target.value,
                            })
                          }
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                      <button
                        className="button button-ghost button-sm"
                        onClick={() =>
                          setCustomer({
                            id: "",
                            name: e.name,
                            email: e.email,
                            phone: e.phone,
                            address: "",
                            postcode: e.postcode,
                            preferences: e.notes,
                            internal_notes: "",
                          })
                        }
                      >
                        Use details for a customer →
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!enquiryList.length && (
                <p className="empty-state">No matching enquiries.</p>
              )}
            </section>
            <section className="panel">
              <h2>{selectedCustomer?.id ? "Edit customer" : "Add customer"}</h2>
              <OperationForm
                key={selectedCustomer?.id || selectedCustomer?.email || "new"}
                action="customer"
                onSaved={refresh}
                label="Save customer"
                map={(f) => ({
                  ...Object.fromEntries(f),
                  ...(selectedCustomer?.id ? { id: selectedCustomer.id } : {}),
                })}
              >
                <Field
                  name="name"
                  label="Customer name"
                  value={selectedCustomer?.name}
                  required
                />
                <div className="form-grid">
                  <Field
                    name="email"
                    label="Email"
                    type="email"
                    value={selectedCustomer?.email}
                  />
                  <Field
                    name="phone"
                    label="Phone"
                    value={selectedCustomer?.phone}
                  />
                </div>
                <Field
                  name="address"
                  label="Home address"
                  value={selectedCustomer?.address}
                  required
                />
                <Field
                  name="postcode"
                  label="Postcode"
                  value={selectedCustomer?.postcode}
                  required
                />
                <label>
                  Cleaning preferences
                  <textarea
                    name="preferences"
                    defaultValue={selectedCustomer?.preferences}
                  />
                </label>
                <label>
                  Internal notes (admin only)
                  <textarea
                    name="internal_notes"
                    defaultValue={selectedCustomer?.internal_notes}
                  />
                </label>
              </OperationForm>
            </section>
          </div>
        </>
      )}
      {section === "calendar" && (
        <>
          <div className="search-row">
            <label>
              Cleaner filter
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All cleaners</option>
                {data.cleaners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CalendarBoard
            data={data}
            cleaner={filter}
            onSelect={setVisit}
            onSaved={refresh}
            onError={setError}
          />
          <div className="ops-columns">
            <section className="panel">
              <h2>Create a visit or recurring booking</h2>
              <OperationForm
                action="booking"
                label="Create booking"
                onSaved={refresh}
                map={(f) => ({
                  customer_id: f.get("customer_id"),
                  cleaner_id: f.get("cleaner_id"),
                  date: f.get("date"),
                  time: f.get("time"),
                  duration_minutes: Number(f.get("duration_minutes")),
                  interval_weeks: Number(f.get("interval_weeks")),
                  occurrences:
                    Number(f.get("interval_weeks")) === 0
                      ? 1
                      : Number(f.get("occurrences")),
                  instructions: f.get("instructions"),
                })}
              >
                <div className="form-grid">
                  <label>
                    Customer
                    <select name="customer_id" required>
                      <option value="">Select customer</option>
                      {data.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cleaner
                    <select name="cleaner_id" required>
                      <option value="">Select cleaner</option>
                      {data.cleaners
                        .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Field name="date" label="First date" type="date" required />
                  <Field
                    name="time"
                    label="Local start time"
                    type="time"
                    value="09:00"
                    required
                  />
                  <label>
                    Duration
                    <select name="duration_minutes" defaultValue="180">
                      {[60, 90, 120, 180, 240, 300, 360, 480].map((n) => (
                        <option key={n} value={n}>
                          {n / 60} hours
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Repeat
                    <select name="interval_weeks">
                      <option value="0">One-off</option>
                      <option value="1">Weekly</option>
                      <option value="2">Fortnightly</option>
                    </select>
                  </label>
                  <Field
                    name="occurrences"
                    label="Number of recurring visits (1–26)"
                    type="number"
                    value={8}
                  />
                </div>
                <label>
                  Instructions for the cleaner
                  <textarea name="instructions" />
                </label>
                <p className="form-small">
                  Visits are materialised for this horizon. Recurring
                  appointments preserve the local start time through clock
                  changes. This version does not automatically extend a series.
                </p>
              </OperationForm>
            </section>
            <section className="panel">
              <h2>
                {selectedVisit
                  ? "Selected visit"
                  : "Select a visit to manage it"}
              </h2>
              {selectedVisit ? (
                <>
                  <p>
                    {customerName(selectedVisit.customer_id)} ·{" "}
                    {cleanerName(selectedVisit.cleaner_id)}
                    <br />
                    {dateTime(selectedVisit.starts_at)}
                  </p>
                  <OperationForm
                    key={selectedVisit.id}
                    action="visit"
                    label="Reschedule this visit"
                    onSaved={refresh}
                    map={(f) => ({
                      id: selectedVisit.id,
                      starts_at: londonInstant(
                        String(f.get("date")),
                        String(f.get("time")),
                      ),
                      cleaner_id: f.get("cleaner_id"),
                    })}
                  >
                    <div className="form-grid">
                      <Field
                        name="date"
                        label="New date"
                        type="date"
                        value={localParts(selectedVisit.starts_at).date}
                      />
                      <Field
                        name="time"
                        label="Local start time"
                        type="time"
                        value={localParts(selectedVisit.starts_at).time}
                      />
                    </div>
                    <label>
                      Assigned cleaner
                      <select
                        name="cleaner_id"
                        defaultValue={selectedVisit.cleaner_id}
                      >
                        {data.cleaners.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </OperationForm>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      run("visit", {
                        id: selectedVisit.id,
                        status: "cancelled",
                      })
                    }
                  >
                    Cancel this occurrence
                  </Button>
                  <p className="form-small">
                    Other visits in the series are unaffected.
                  </p>
                </>
              ) : (
                <p className="empty-state">
                  Click an appointment in the calendar. You can also drag it to
                  reschedule.
                </p>
              )}
              <h3 style={{ marginTop: 25 }}>Recent visits</h3>
              <ul className="data-list">
                {[...data.visits]
                  .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                  .slice(0, 12)
                  .map((v) => (
                    <li key={v.id}>
                      <button
                        className="button button-ghost button-sm"
                        onClick={() => setVisit(v)}
                      >
                        {customerName(v.customer_id)} · {dateTime(v.starts_at)}
                      </button>
                      <span className={"badge badge-" + v.status}>
                        {v.status}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </>
      )}
      {section === "cleaners" && (
        <>
          <div className="ops-columns">
            <section className="panel">
              <h2>Cleaner profiles</h2>
              <ul className="data-list">
                {data.cleaners.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.active ? "Active" : "Inactive"}</small>
                      {data.availability
                        .filter((a) => a.cleaner_id === c.id)
                        .map((a) => (
                          <small key={a.weekday}>
                            {
                              ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                                a.weekday
                              ]
                            }{" "}
                            {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                          </small>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2>Invite a cleaner</h2>
              <InviteForm demo={demo} refresh={refresh} />
              <p className="form-small">
                Live accounts are created only by an admin invitation. The
                initial availability is Monday–Friday, 8am–8pm. Staff can
                request changes in their portal.
              </p>
            </section>
          </div>
          <section className="panel">
            <h2>Availability & leave for review</h2>
            <ul className="data-list">
              {[
                ...data.leave_requests.map((r) => ({ ...r, kind: "leave" })),
                ...data.availability_requests.map((r) => ({
                  ...r,
                  kind: "availability",
                })),
              ].map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>
                      {cleanerName(r.cleaner_id)} · {r.kind}
                    </strong>
                    <small>
                      {r.kind === "leave"
                        ? `${r.starts_on} to ${r.ends_on} · ${r.reason}`
                        : `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][r.weekday!]} ${r.start_time}–${r.end_time}`}
                    </small>
                    <span className={"badge badge-" + r.status}>
                      {r.status}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <div className="inline-actions">
                      <Button
                        size="sm"
                        onClick={() =>
                          run("review", {
                            id: r.id,
                            kind: r.kind,
                            status: "approved",
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run("review", {
                            id: r.id,
                            kind: r.kind,
                            status: "declined",
                          })
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!data.leave_requests.length &&
              !data.availability_requests.length && (
                <p className="empty-state">
                  No requests to review. Conflicting visits must be moved before
                  changes can be approved.
                </p>
              )}
          </section>
        </>
      )}
      {section === "content" && (
        <div className="ops-columns">
          <section className="panel">
            <div className="workspace-heading">
              <h2>Pages & articles</h2>
              <Button size="sm" onClick={() => setContent(undefined)}>
                New content
              </Button>
            </div>
            <ul className="data-list">
              {data.content.map((c) => (
                <li key={c.id}>
                  <button
                    className="button button-ghost button-sm"
                    onClick={() => setContent(c)}
                  >
                    {c.title}
                  </button>
                  <span className={"badge badge-" + c.status}>{c.status}</span>
                </li>
              ))}
            </ul>
            <p className="form-small">
              Use the existing page slugs to add edited copy. Use “home” for an
              additional homepage copy before the enquiry form. New area pages
              should describe verified coverage and contain useful, distinct
              information.
            </p>
          </section>
          <section className="panel">
            <h2>{selectedContent ? "Edit content" : "New page or article"}</h2>
            <ContentEditor
              key={selectedContent?.id || "new"}
              content={selectedContent}
              onSaved={refresh}
            />
          </section>
        </div>
      )}
      {section === "conversations" && (
        <>
          <div className="workspace-heading">
            <p>
              {demo
                ? "Local sample calls are labelled."
                : "Call metadata appears when a signed provider integration is connected."}{" "}
              Recording & transcription are disabled by default.
            </p>
            {demo && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await fetch("/api/demo/calls/", { method: "POST" });
                  if (r.ok) await refresh();
                  else setError("Could not load sample event.");
                }}
              >
                Load sample call
              </Button>
            )}
          </div>
          <div className="ops-columns">
            <section className="panel">
              <h2>Call history</h2>
              <ul className="data-list">
                {data.conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      className="button button-ghost button-sm"
                      onClick={() => setConversation(c)}
                    >
                      {c.caller} ·{" "}
                      {c.provider === "sample" ? "LOCAL SAMPLE" : c.provider}
                    </button>
                    <div>
                      <span className={"badge badge-" + c.status}>
                        {c.status}
                      </span>
                      <small>{dateTime(c.started_at)}</small>
                    </div>
                  </li>
                ))}
              </ul>
              {!data.conversations.length && (
                <p className="empty-state">
                  No conversations yet. The public phone number and routing have
                  not been changed.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Conversation details</h2>
              {selectedConversation ? (
                (() => {
                  const c = data.conversations.find(
                    (x) => x.id === selectedConversation.id,
                  )!;
                  return (
                    <>
                      <p>
                        <strong>{c.caller}</strong>
                        <br />
                        {c.direction} · {c.status} · {c.duration_seconds}s<br />
                        {dateTime(c.started_at)}
                      </p>
                      <p>
                        Suggested customer:{" "}
                        {customerName(c.suggested_customer_id)}
                        <br />
                        Confirmed customer: {customerName(c.customer_id)}
                      </p>
                      <OperationForm
                        action="conversation"
                        label="Save association / note"
                        onSaved={refresh}
                        map={(f) => ({
                          id: c.id,
                          customer_id: f.get("customer_id"),
                          note: f.get("note"),
                        })}
                      >
                        <label>
                          Confirm customer
                          <select
                            name="customer_id"
                            defaultValue={c.customer_id || ""}
                          >
                            <option value="">Unmatched / shared number</option>
                            {data.customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Admin note
                          <textarea name="note" />
                        </label>
                      </OperationForm>
                      <h3 style={{ marginTop: 25 }}>Recording</h3>
                      <p>{c.recording_status}</p>
                      {data.recordings
                        .filter((r) => r.conversation_id === c.id)
                        .map((r) => (
                          <div key={r.id}>
                            <audio
                              controls
                              preload="none"
                              src={"/api/recordings/" + r.id + "/"}
                              aria-label="Authorised call recording"
                            />
                            <small>
                              Retention expires {londonDate(r.expires_at)}
                            </small>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const response = await fetch(
                                  "/api/recordings/" + r.id + "/",
                                  { method: "DELETE" },
                                );
                                if (response.ok) await refresh();
                                else {
                                  const result = await response.json();
                                  setError(result.error);
                                }
                              }}
                            >
                              Delete recording & transcript
                            </Button>
                          </div>
                        ))}
                      <h3 style={{ marginTop: 25 }}>Transcription</h3>
                      <p>{c.transcript_status}</p>
                      {data.transcripts
                        .filter((t) => t.conversation_id === c.id)
                        .map((t) => (
                          <p key={t.id}>
                            {t.is_ai_summary
                              ? "AI-generated summary — human review required. "
                              : ""}
                            {t.text ||
                              `Unavailable (${t.error_code || t.status}).`}
                          </p>
                        ))}
                      <h3>Notes</h3>
                      {data.conversation_notes
                        .filter((n) => n.conversation_id === c.id)
                        .map((n) => (
                          <p key={n.id}>{n.body}</p>
                        ))}
                      <OperationForm
                        action="task"
                        onSaved={refresh}
                        label="Add call follow-up"
                        map={(f) => ({
                          conversation_id: c.id,
                          title: f.get("title"),
                          due_on: f.get("due_on"),
                          done: false,
                        })}
                      >
                        <Field name="title" label="Follow-up" required />
                        <Field
                          name="due_on"
                          label="Due date"
                          type="date"
                          required
                        />
                      </OperationForm>
                    </>
                  );
                })()
              ) : (
                <p className="empty-state">
                  Choose a conversation to see its history and follow-up.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function InviteForm({
  demo,
  refresh,
}: {
  demo: boolean;
  refresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);
        try {
          const response = await fetch("/api/cleaners/invite/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(form)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          setMessage(
            demo
              ? "Synthetic cleaner profile created; no invitation was sent."
              : "Invitation sent.",
          );
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Invitation failed.");
        }
      }}
    >
      <Field name="name" label="Name" required />
      <Field name="email" label="Email" type="email" required />
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit">
        {demo ? "Create synthetic profile" : "Send invitation"}
      </Button>
    </form>
  );
}
