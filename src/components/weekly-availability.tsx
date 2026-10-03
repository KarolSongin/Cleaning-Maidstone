"use client";
import type { WeeklyAvailability } from "@/lib/models";
import { weekdays } from "@/lib/availability";
import { useAdminConfirmation } from "./admin-confirmation";

export function WeeklyAvailabilityEditor({
  value,
  onChange,
}: {
  value: WeeklyAvailability[];
  onChange: (slots: WeeklyAvailability[]) => void;
}) {
  const confirm = useAdminConfirmation();
  const update = (index: number, patch: Partial<WeeklyAvailability>) =>
    onChange(
      value.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );
  return (
    <fieldset className="weekly-editor">
      <legend>Recurring weekly availability</legend>
      <p className="form-small">
        Choose working days and hours in London time. You can add separate
        morning and afternoon periods.
      </p>
      {weekdays.map(({ weekday, label }) => {
        const slots = value
          .map((slot, index) => ({ ...slot, index }))
          .filter((slot) => slot.weekday === weekday);
        return (
          <div className="weekly-day" key={weekday}>
            <label className="weekly-day-toggle">
              <input
                type="checkbox"
                aria-label={label}
                checked={slots.length > 0}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [
                          ...value,
                          { weekday, start_time: "08:00", end_time: "17:00" },
                        ]
                      : value.filter((slot) => slot.weekday !== weekday),
                  )
                }
              />
              {label}
              {!slots.length && <span>Off</span>}
            </label>
            {slots.map((slot, i) => (
              <div className="weekly-period" key={slot.index}>
                <label>
                  From
                  <input
                    aria-label={`${label} start time${i ? ` ${i + 1}` : ""}`}
                    type="time"
                    required
                    value={slot.start_time}
                    onChange={(e) =>
                      update(slot.index, { start_time: e.target.value })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    aria-label={`${label} end time${i ? ` ${i + 1}` : ""}`}
                    type="time"
                    required
                    value={slot.end_time}
                    onChange={(e) =>
                      update(slot.index, { end_time: e.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="weekly-remove"
                  aria-label={`Remove ${label} period ${i + 1}`}
                  onClick={async () => {
                    if (
                      !confirm ||
                      (await confirm({
                        title: "Remove this working period?",
                        description: `Remove ${label} ${slot.start_time}–${slot.end_time} from this schedule. Approved hours change only when you save.`,
                        confirmLabel: "Remove period",
                        danger: true,
                      }))
                    )
                      onChange(
                        value.filter((_, index) => index !== slot.index),
                      );
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            {!!slots.length && value.length < 28 && (
              <button
                type="button"
                className="weekly-add"
                onClick={() =>
                  onChange([
                    ...value,
                    { weekday, start_time: "17:00", end_time: "20:00" },
                  ])
                }
              >
                + Add {label} period
              </button>
            )}
          </div>
        );
      })}
      <p className="form-small">
        Each period must start and end on the same day.
      </p>
    </fieldset>
  );
}

export function WeeklyAvailabilitySummary({
  slots,
}: {
  slots: WeeklyAvailability[];
}) {
  return (
    <dl className="weekly-summary">
      {weekdays.map(({ weekday, label }) => {
        const periods = slots
          .filter((slot) => slot.weekday === weekday)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div key={weekday}>
            <dt>{label}</dt>
            <dd>
              {periods.length
                ? periods
                    .map(
                      (slot) =>
                        `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
                    )
                    .join(", ")
                : "Off"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
