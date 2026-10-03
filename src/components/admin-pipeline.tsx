"use client";
import { PersonName } from "./person-name";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import type {
  AcquisitionLead,
  AcquisitionStage,
  DashboardData,
} from "@/lib/models";
import {
  acquisitionStages,
  stageLabel,
  sourceLabel,
  contactDueOn,
  contactIsDue,
  acquisitionDate,
} from "@/lib/acquisition";
import { londonDate } from "@/lib/scheduling";
import { OperationForm, Field } from "./operation-form";
import { BookingForm } from "./booking-form";
import { Button } from "./ui/button";

export function AdminPipeline({
  data,
  today,
  onSaved,
  initialLeadId,
  initialDueOnly = false,
}: {
  data: DashboardData;
  today: string;
  onSaved: () => Promise<void>;
  initialLeadId?: string;
  initialDueOnly?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeadId ?? null,
  );
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [dueOnly, setDueOnly] = useState(initialDueOnly);
  const lead = data.acquisition_leads.find((l) => l.id === selectedId);
  const due = data.acquisition_leads.filter((l) => contactIsDue(l, today));
  const visible = data.acquisition_leads
    .filter(
      (l) =>
        (stage === "all" ? l.stage !== "closed" : l.stage === stage) &&
        (source === "all" || l.source === source) &&
        (!dueOnly || contactIsDue(l, today)) &&
        [l.name, l.email, l.phone, l.postcode]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const dueOrder =
        Number(contactIsDue(b, today)) - Number(contactIsDue(a, today));
      return (
        dueOrder ||
        b.created_at.localeCompare(a.created_at) ||
        a.id.localeCompare(b.id)
      );
    });
  const selectRecord = (id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id && id !== "new") url.searchParams.set("lead", id);
    else url.searchParams.delete("lead");
    window.history.replaceState(null, "", url);
  };
  const choose = (id: string) => {
    selectRecord(id);
    requestAnimationFrame(() => {
      document
        .getElementById("pipeline-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .getElementById("pipeline-detail-title")
        ?.focus({ preventScroll: true });
    });
  };
  const card = (item: AcquisitionLead) => (
    <button
      key={item.id}
      className={`pipeline-card${selectedId === item.id ? " is-selected" : ""}`}
      onClick={() => choose(item.id)}
      aria-label={`Open ${item.name}`}
      aria-pressed={selectedId === item.id}
    >
      <span className="pipeline-card-name">
        <PersonName kind="customer">{item.name}</PersonName>
        <ArrowUpRight size={14} aria-hidden="true" />
      </span>
      <span className="pipeline-card-source">
        {sourceLabel(item.source)}
        {item.postcode ? ` · ${item.postcode}` : ""}
      </span>
      <span className={`pipeline-stage stage-${item.stage}`}>
        {stageLabel(item.stage)}
      </span>
      {item.first_clean_on && (
        <span className="pipeline-card-date">
          First clean · {acquisitionDate(item.first_clean_on)}
        </span>
      )}
      {contactDueOn(item) && (
        <span
          className={`pipeline-card-date${contactIsDue(item, today) ? " contact-due" : ""}`}
        >
          Contact {contactIsDue(item, today) ? "due" : "on"} ·{" "}
          {acquisitionDate(contactDueOn(item)!)}
        </span>
      )}
    </button>
  );
  return (
    <>
      <div className="pipeline-summary">
        <div>
          <span>Open opportunities</span>
          <strong>
            {
              data.acquisition_leads.filter(
                (l) => !["onboarded", "closed"].includes(l.stage),
              ).length
            }
          </strong>
        </div>
        <button
          onClick={() => {
            setDueOnly(true);
            setStage("all");
            setSource("all");
            setSearch("");
          }}
        >
          <span>Contacts due</span>
          <strong>{due.length}</strong>
          <small>View follow-ups ↗</small>
        </button>
        <div>
          <span>Onboarded regular clients</span>
          <strong>
            {
              data.acquisition_leads.filter((l) => l.stage === "onboarded")
                .length
            }
          </strong>
        </div>
      </div>
      <div className="pipeline-toolbar">
        <label>
          Search pipeline
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, email or postcode"
          />
        </label>
        <label>
          Stage
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All active stages</option>
            {acquisitionStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="website">Website enquiry</option>
            <option value="manual">Manual entry</option>
            <option value="existing">Existing record</option>
          </select>
        </label>
        <Button size="sm" onClick={() => choose("new")}>
          <Plus size={15} />
          Add opportunity
        </Button>
      </div>
      <div className="pipeline-filter-row">
        <label>
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
          />
          Only contacts due
        </label>
        <span>
          {visible.length} {visible.length === 1 ? "record" : "records"} · UK
          dates
        </span>
      </div>
      {stage === "all" && (
        <p className="pipeline-board-hint">
          Follow the stages from left to right. Scroll across the board or use
          the stage filter to focus on one.
        </p>
      )}
      {stage === "all" ? (
        <>
          <div
            className="pipeline-board"
            role="region"
            aria-label="Customer acquisition stages"
            tabIndex={0}
          >
            {acquisitionStages.map((s) => {
              const items = visible.filter((l) => l.stage === s.id);
              return (
                <section
                  key={s.id}
                  className={`pipeline-column stage-${s.id}`}
                  aria-label={s.label}
                >
                  <div className="pipeline-column-heading">
                    <h2>{s.short}</h2>
                    <span>{items.length}</span>
                  </div>
                  <p>{s.description}</p>
                  <div className="pipeline-column-cards">
                    {items.map(card)}
                    {!items.length && (
                      <p className="pipeline-empty">
                        No records in this stage.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="pipeline-mobile-list">{visible.map(card)}</div>
        </>
      ) : (
        <div className="pipeline-filtered-list">{visible.map(card)}</div>
      )}
      {!visible.length && (
        <p className="empty-state">
          No records match these filters. New website enquiries and manual
          entries appear as opportunities.
        </p>
      )}
      <p className="pipeline-rule">
        <CalendarDays size={17} aria-hidden="true" />
        First cleaning and recurring follow-up stages update automatically.
        Follow-up starts the next UK calendar day. Confirm onboarding once the
        regular agreement is agreed.
      </p>
      <div id="pipeline-detail" className="pipeline-detail">
        {selectedId === "new" ? (
          <section className="panel pipeline-new">
            <div className="pipeline-detail-heading">
              <h2 id="pipeline-detail-title" tabIndex={-1}>
                Add an opportunity
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectRecord(null)}
              >
                Close
              </Button>
            </div>
            <p>
              Capture a phone call, referral or other enquiry. You can add the
              home address when they are ready to book.
            </p>
            <OpportunityForm
              onSaved={async (result) => {
                await onSaved();
                selectRecord(result?.id ?? null);
              }}
            />
          </section>
        ) : lead ? (
          <>
            <div className="pipeline-detail-heading">
              <div>
                <span className={`pipeline-stage stage-${lead.stage}`}>
                  {stageLabel(lead.stage)}
                </span>
                <h2 id="pipeline-detail-title" tabIndex={-1}>
                  <PersonName kind="customer">{lead.name}</PersonName>
                </h2>
                <p>
                  {sourceLabel(lead.source)} · Added{" "}
                  {londonDate(lead.created_at, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectRecord(null)}
              >
                Close details
              </Button>
            </div>
            <div className="ops-columns">
              <section className="panel">
                <div className="pipeline-contact-links">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}>
                      <Phone size={15} aria-hidden="true" />
                      {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}>
                      <Mail size={15} aria-hidden="true" />
                      {lead.email}
                    </a>
                  )}
                </div>
                {(lead.first_clean_on || contactDueOn(lead)) && (
                  <div className="pipeline-dates">
                    {lead.first_clean_on && (
                      <p>
                        <span>First cleaning</span>
                        <strong>{acquisitionDate(lead.first_clean_on)}</strong>
                      </p>
                    )}
                    {contactDueOn(lead) && (
                      <p>
                        <span>
                          {contactIsDue(lead, today)
                            ? "Contact due"
                            : "Next contact"}
                        </span>
                        <strong>{acquisitionDate(contactDueOn(lead)!)}</strong>
                      </p>
                    )}
                  </div>
                )}
                {lead.stage === "recurring_follow_up" &&
                  data.visits.find((v) => v.id === lead.first_visit_id)
                    ?.status !== "completed" && (
                    <p className="alert">
                      The first cleaning date has passed. Confirm the visit took
                      place before agreeing regular visits.
                    </p>
                  )}
                <h3>Move the opportunity forward</h3>
                <StageForm
                  key={`${lead.id}-${lead.stage}`}
                  lead={lead}
                  onSaved={onSaved}
                />
                <details className="pipeline-edit">
                  <summary>Edit contact details & follow-up</summary>
                  <OpportunityForm
                    key={lead.id}
                    lead={lead}
                    onSaved={onSaved}
                  />
                </details>
              </section>
              <section className="panel">
                {lead.customer_id ? (
                  <>
                    <h3>Customer profile</h3>
                    <p>
                      {
                        data.customers.find((c) => c.id === lead.customer_id)
                          ?.address
                      }{" "}
                      · {lead.postcode}
                    </p>
                    <Link
                      className="text-link"
                      href={`/admin/customers/?customer=${lead.customer_id}`}
                    >
                      Edit home details ↗
                    </Link>
                    <details className="pipeline-edit">
                      <summary>
                        {lead.stage === "onboarded"
                          ? "Book a cleaning"
                          : "Book first cleaning"}
                      </summary>
                      <BookingForm
                        key={lead.id}
                        data={data}
                        customerId={lead.customer_id}
                        onSaved={onSaved}
                      />
                    </details>
                  </>
                ) : (
                  <CustomerLink
                    key={lead.id}
                    lead={lead}
                    data={data}
                    onSaved={async (customerId) => {
                      const existingLead = data.acquisition_leads.find(
                        (l) => l.customer_id === customerId,
                      );
                      await onSaved();
                      if (existingLead) selectRecord(existingLead.id);
                    }}
                  />
                )}
                {data.enquiries
                  .filter((e) => e.pipeline_id === lead.id)
                  .map((e) => (
                    <div className="pipeline-enquiry" key={e.id}>
                      <h3>Website enquiry</h3>
                      <p>
                        {e.frequency} · {e.home_size}
                      </p>
                      <p>
                        Preferred days:{" "}
                        {e.preferred_days.join(", ") || "To be discussed"}
                      </p>
                      <p className="preserve-lines">
                        {e.notes || "No additional message."}
                      </p>
                    </div>
                  ))}
                <h3>Stage history</h3>
                <ol className="pipeline-history">
                  {data.acquisition_history
                    .filter((h) => h.lead_id === lead.id)
                    .sort(
                      (a, b) =>
                        b.created_at.localeCompare(a.created_at) ||
                        b.id.localeCompare(a.id),
                    )
                    .map((h) => (
                      <li key={h.id}>
                        <span className="pipeline-history-dot">
                          <Check size={12} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>
                            {h.from_stage && h.from_stage !== h.to_stage
                              ? `${stageLabel(h.from_stage)} → `
                              : ""}
                            {stageLabel(h.to_stage)}
                          </strong>
                          <small>
                            {londonDate(h.created_at, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            ·{" "}
                            {h.reason === "manual"
                              ? "Admin update"
                              : h.reason === "date" ||
                                  h.reason === "booking" ||
                                  h.reason === "cancelled"
                                ? "Automatic"
                                : h.reason === "linked"
                                  ? "Customer linked"
                                  : h.reason === "import"
                                    ? "Imported"
                                    : "Enquiry received"}
                          </small>
                          {h.note && <p className="preserve-lines">{h.note}</p>}
                        </div>
                      </li>
                    ))}
                </ol>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function OpportunityForm({
  lead,
  onSaved,
}: {
  lead?: AcquisitionLead;
  onSaved: (result?: { id?: string }) => Promise<void>;
}) {
  return (
    <OperationForm
      action="opportunity"
      label={lead ? "Save contact & follow-up" : "Save opportunity"}
      onSaved={onSaved}
      map={(f) => ({
        ...Object.fromEntries(f),
        ...(lead ? { id: lead.id } : {}),
      })}
    >
      <Field
        name="name"
        label="Opportunity name"
        value={lead?.name}
        personKind="customer"
        required
      />
      <div className="form-grid">
        <Field name="email" label="Email" type="email" value={lead?.email} />
        <Field name="phone" label="Phone" value={lead?.phone} />
      </div>
      <Field
        name="postcode"
        label="Postcode (if known)"
        value={lead?.postcode}
      />
      <Field
        name="next_contact_on"
        label="Next contact date (optional)"
        type="date"
        value={lead?.next_contact_on ?? ""}
      />
      <p className="form-small">
        Add an email or phone number. A next contact date sets the reminder;
        leaving it blank uses the automatic recurring follow-up date.
      </p>
      <label>
        Private pipeline notes
        <textarea
          name="notes"
          defaultValue={lead?.notes}
          maxLength={10000}
          rows={4}
        />
      </label>
    </OperationForm>
  );
}

function StageForm({
  lead,
  onSaved,
}: {
  lead: AcquisitionLead;
  onSaved: () => Promise<void>;
}) {
  const [stage, setStage] = useState<AcquisitionStage>(lead.stage);
  const automatic = ["first_clean_booked", "recurring_follow_up"].includes(
    stage,
  );
  return (
    <OperationForm
      action="pipeline_stage"
      label="Save stage"
      disabled={automatic || stage === lead.stage}
      onSaved={onSaved}
      map={(f) => ({
        id: lead.id,
        expected_stage: lead.stage,
        stage,
        note: f.get("note"),
      })}
    >
      <label>
        Pipeline stage
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as AcquisitionStage)}
        >
          {acquisitionStages.map((s) => (
            <option
              key={s.id}
              value={s.id}
              disabled={
                ["first_clean_booked", "recurring_follow_up"].includes(s.id) ||
                (s.id === "onboarded" && !lead.customer_id) ||
                (["opportunity", "contacted", "quoted"].includes(s.id) &&
                  !!lead.first_visit_id &&
                  !["closed", "onboarded"].includes(lead.stage))
              }
            >
              {s.label}
              {["first_clean_booked", "recurring_follow_up"].includes(s.id)
                ? " (automatic)"
                : ""}
            </option>
          ))}
          <option value="closed">Closed</option>
        </select>
      </label>
      <label>
        Stage change note (optional)
        <textarea name="note" maxLength={2000} rows={2} />
      </label>
      <p className="form-small">
        {automatic
          ? "Booking dates control this stage. You can confirm onboarding or close the opportunity."
          : stage === "onboarded"
            ? "Confirm this only after agreeing their recurring arrangement. A recurring booking alone does not confirm onboarding."
            : stage === "closed"
              ? "Closing removes this record from the active pipeline. It does not cancel any visits."
              : "Record your progress after contacting the customer or sending a quote."}
      </p>
    </OperationForm>
  );
}

function CustomerLink({
  lead,
  data,
  onSaved,
}: {
  lead: AcquisitionLead;
  data: DashboardData;
  onSaved: (customerId?: string) => Promise<void>;
}) {
  const [existingId, setExistingId] = useState("");
  const existing = data.customers.find((c) => c.id === existingId);
  const enquiry = data.enquiries.find((e) => e.pipeline_id === lead.id);
  return (
    <>
      <h3>Prepare for their first booking</h3>
      <p>
        Add their home details or choose an existing customer to keep the
        enquiry and bookings together.
      </p>
      <label className="pipeline-link-choice">
        Customer profile
        <select
          value={existingId}
          className="person-input-customer"
          onChange={(e) => setExistingId(e.target.value)}
        >
          <option value="">Create a new customer profile</option>
          {data.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.postcode}
            </option>
          ))}
        </select>
      </label>
      <OperationForm
        key={existingId || "new"}
        action="customer"
        label={existing ? "Link existing customer" : "Create customer profile"}
        onSaved={(result) => onSaved(result?.id)}
        map={(f) => ({
          ...(existing ?? Object.fromEntries(f)),
          pipeline_id: lead.id,
        })}
      >
        {existing ? (
          <p>
            <PersonName kind="customer">{existing.name}</PersonName> ·{" "}
            {existing.address} · {existing.postcode}. Their existing pipeline
            stage and home details will be kept.
          </p>
        ) : (
          <>
            <Field
              name="name"
              label="Customer name"
              personKind="customer"
              value={lead.name}
              required
            />
            <div className="form-grid">
              <Field
                name="email"
                label="Customer email"
                type="email"
                value={lead.email}
              />
              <Field name="phone" label="Customer phone" value={lead.phone} />
            </div>
            <Field name="address" label="Home address" required />
            <Field
              name="postcode"
              label="Home postcode"
              value={lead.postcode}
              required
            />
            <label>
              Cleaning preferences
              <textarea
                name="preferences"
                defaultValue={enquiry?.notes ?? ""}
                maxLength={2000}
              />
            </label>
            <label>
              Internal notes (admin only)
              <textarea name="internal_notes" maxLength={4000} />
            </label>
          </>
        )}
      </OperationForm>
    </>
  );
}
