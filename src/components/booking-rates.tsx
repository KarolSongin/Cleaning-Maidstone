"use client";
import { useEffect, useRef, useState } from "react";
import type { BookingRates, Visit } from "@/lib/models";
import {
  money,
  poundsToPence,
  ratesFromForm,
  visitAmounts,
  visitMinutes,
} from "@/lib/finances";
import { OperationForm } from "./operation-form";
import { Button } from "./ui/button";

export function FinanceSummary({
  rates,
  minutes,
  label = "For this visit",
}: {
  rates?: BookingRates;
  minutes: number;
  label?: string;
}) {
  if (!rates) return <p className="finance-unpriced">Rates not set</p>;
  const amounts = visitAmounts(rates, minutes);
  return (
    <div className="finance-summary" aria-label={label}>
      <p className="finance-caption">
        {label} · {minutes / 60} {minutes === 60 ? "hour" : "hours"}
      </p>
      <dl className="finance-amounts">
        {(
          [
            ["Customer charge", amounts.customer, rates.customer_rate_pence],
            ["Admin share", amounts.admin, rates.admin_rate_pence],
            ["Cleaner cash pay", amounts.cleaner, rates.cleaner_rate_pence],
          ] as const
        ).map(([title, total, rate]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>
              {money(total)}
              <small>{money(rate)} / hour</small>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function BookingRatesEditor({
  initial,
  minutes,
  recurring = false,
}: {
  initial?: BookingRates;
  minutes: number;
  recurring?: boolean;
}) {
  const [customer, setCustomer] = useState(
    initial ? (initial.customer_rate_pence / 100).toFixed(2) : "",
  );
  const [admin, setAdmin] = useState(
    initial ? (initial.admin_rate_pence / 100).toFixed(2) : "",
  );
  const [cleaner, setCleaner] = useState(
    initial ? (initial.cleaner_rate_pence / 100).toFixed(2) : "",
  );
  const cleanerInput = useRef<HTMLInputElement>(null);
  const c = poundsToPence(customer),
    a = poundsToPence(admin),
    w = poundsToPence(cleaner);
  const complete = c !== null && a !== null && w !== null;
  const balanced = complete && c > 0 && c === a + w;
  const remainder = c !== null && a !== null && c >= a ? c - a : null;
  useEffect(() => {
    cleanerInput.current?.setCustomValidity(
      complete && !balanced
        ? "Customer hourly rate must equal the admin share plus cleaner cash pay."
        : "",
    );
  }, [complete, balanced]);
  return (
    <fieldset className="booking-rates">
      <legend>
        Hourly rates <span className="badge">Admin only</span>
      </legend>
      <p className="form-small">
        The customer rate is split between your share and the cleaner’s cash
        payment.
      </p>
      <div className="finance-inputs">
        <label>
          Customer hourly rate (£)
          <input
            name="customer_rate"
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            required
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </label>
        <label>
          Admin hourly share (£)
          <input
            name="admin_rate"
            type="number"
            min="0"
            max="1000"
            step="0.01"
            required
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
          />
        </label>
        <label>
          Cleaner hourly cash pay (£)
          <input
            ref={cleanerInput}
            name="cleaner_rate"
            type="number"
            min="0"
            max="1000"
            step="0.01"
            required
            value={cleaner}
            onChange={(e) => setCleaner(e.target.value)}
          />
        </label>
      </div>
      <div className="finance-preview" aria-live="polite">
        {balanced ? (
          <FinanceSummary
            rates={{
              customer_rate_pence: c,
              admin_rate_pence: a,
              cleaner_rate_pence: w,
            }}
            minutes={minutes}
            label={recurring ? "For each regular visit" : "For this visit"}
          />
        ) : (
          <p className="form-small">
            {complete
              ? "These amounts must add up: customer rate = admin share + cleaner cash pay."
              : "Enter all three hourly amounts to preview the visit total."}
          </p>
        )}
        {remainder !== null && remainder !== w && c !== 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCleaner((remainder / 100).toFixed(2))}
          >
            Set cleaner pay to {money(remainder)} / hour
          </Button>
        )}
      </div>
      <p className="form-small">
        {recurring
          ? "The same rates apply to every visit in this booking. "
          : ""}
        Cleaners see only their own cash pay. Amounts shown are due for the
        visit; payment is not collected here.
      </p>
    </fieldset>
  );
}

export function VisitFinances({
  visit,
  rates,
  onSaved,
}: {
  visit: Visit;
  rates?: BookingRates;
  onSaved: () => Promise<void>;
}) {
  return (
    <section className="visit-finances" aria-label="Visit finances">
      <h3>Visit finances</h3>
      <OperationForm
        key={`${visit.id}:${rates?.customer_rate_pence}:${rates?.admin_rate_pence}:${rates?.cleaner_rate_pence}`}
        action="visit_finances"
        label="Save visit rates"
        onSaved={onSaved}
        map={(form) => ({ id: visit.id, ...ratesFromForm(form) })}
      >
        <BookingRatesEditor initial={rates} minutes={visitMinutes(visit)} />
        <p className="form-small">
          Save rates for this visit. Other visits keep their existing rates.
        </p>
      </OperationForm>
    </section>
  );
}
