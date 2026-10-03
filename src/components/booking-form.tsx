"use client";
import { useState } from "react";
import type { DashboardData } from "@/lib/models";
import { bookingPeriod, calendarDate } from "@/lib/recurring-bookings";
import { BookingRatesEditor } from "./booking-rates";
import { ratesFromForm } from "@/lib/finances";
import { OperationForm, Field } from "./operation-form";

export function BookingForm({
  data,
  onSaved,
  customerId,
}: {
  data: DashboardData;
  onSaved: () => Promise<void>;
  customerId?: string;
}) {
  const [interval, setInterval] = useState<0 | 1 | 2>(0);
  const [weeks, setWeeks] = useState("8");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState(180);
  let period: ReturnType<typeof bookingPeriod> | null = null;
  if (
    interval &&
    date &&
    Number.isInteger(Number(weeks)) &&
    Number(weeks) >= 1 &&
    Number(weeks) <= 52
  ) {
    try {
      period = bookingPeriod(date, Number(weeks), interval);
    } catch {
      /* The date input may still be incomplete. */
    }
  }
  return (
    <OperationForm
      action="booking"
      label="Create booking"
      onSaved={onSaved}
      map={(form) => ({
        ...ratesFromForm(form),
        customer_id: form.get("customer_id"),
        cleaner_id: form.get("cleaner_id"),
        date: form.get("date"),
        time: form.get("time"),
        duration_minutes: Number(form.get("duration_minutes")),
        interval_weeks: interval,
        occurrences: interval ? Math.ceil(Number(weeks) / interval) : 1,
        ...(interval ? { duration_weeks: Number(weeks) } : {}),
        instructions: form.get("instructions"),
      })}
    >
      <div className="form-grid">
        <label>
          Customer
          <select
            className="person-input-customer"
            name="customer_id"
            required
            defaultValue={customerId ?? ""}
          >
            <option value="">Select customer</option>
            {data.customers
              .filter(
                (c) => !c.deleted_at && (!customerId || c.id === customerId),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Cleaner
          <select className="person-input-cleaner" name="cleaner_id" required>
            <option value="">Select cleaner</option>
            {data.cleaners
              .filter((c) => c.active && !c.deleted_at)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          First date
          <input
            name="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <Field
          name="time"
          label="Local start time"
          type="time"
          value="09:00"
          required
        />
        <label>
          Duration
          <select
            name="duration_minutes"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {[60, 90, 120, 180, 240, 300, 360, 480].map((n) => (
              <option key={n} value={n}>
                {n / 60} {n === 60 ? "hour" : "hours"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repeat
          <select
            name="interval_weeks"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value) as 0 | 1 | 2)}
          >
            <option value="0">One-off</option>
            <option value="1">Weekly</option>
            <option value="2">Fortnightly</option>
          </select>
        </label>
        {!!interval && (
          <label>
            Booking period (1–52 weeks)
            <input
              name="duration_weeks"
              type="number"
              min={1}
              max={52}
              step={1}
              required
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
            />
          </label>
        )}
      </div>
      {period && (
        <div
          className="booking-period-preview"
          aria-label="Booking period preview"
        >
          <strong>
            {period.occurrences} {interval === 1 ? "weekly" : "fortnightly"}{" "}
            {period.occurrences === 1 ? "visit" : "visits"} over {weeks}{" "}
            {Number(weeks) === 1 ? "week" : "weeks"}
          </strong>
          <span>Booking ends {calendarDate(period.ends_on)}</span>
          <small>
            Last regular visit: {calendarDate(period.last_visit_on)}
          </small>
        </div>
      )}
      <BookingRatesEditor minutes={minutes} recurring={!!interval} />
      <label>
        Instructions for the cleaner
        <textarea name="instructions" />
      </label>
      <p className="form-small">
        All times are London time. Recurring visits keep the same local start
        time through clock changes. Bookings ending within a month appear in
        Recurring bookings for follow-up.
      </p>
    </OperationForm>
  );
}
