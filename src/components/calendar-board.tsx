"use client";
import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import { Temporal } from "@js-temporal/polyfill";
import type { DashboardData, Visit } from "@/lib/models";
import { freeAvailabilityBands, availabilityColour } from "@/lib/availability";
import { londonDate } from "@/lib/scheduling";
import { useConfirmedOperation } from "./operation-form";
import { ActionCancelled, adminConfirmation } from "@/lib/admin-confirmation";
import { PersonName } from "./person-name";

type CalendarRange = { start: string; end: string; view: string };
export default function CalendarBoard({
  data,
  initialDate,
  cleanerIds,
  onSelect,
  onSaved,
  onError,
}: {
  data: DashboardData;
  initialDate?: string;
  cleanerIds: string[];
  onSelect: (v: Visit) => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const sendOperation = useConfirmedOperation();
  const bands = useMemo(
    () => (range ? freeAvailabilityBands(data, cleanerIds, range) : []),
    [data, cleanerIds, range],
  );
  const cleanerNames = (ids: string[]) =>
    ids
      .map((id) => data.cleaners.find((c) => c.id === id)?.name || "Cleaner")
      .join(", ");
  const background: EventInput[] =
    range?.view === "dayGridMonth"
      ? [...new Set(bands.map((band) => band.date))].map((date) => {
          const count = Math.max(
            ...bands
              .filter((band) => band.date === date)
              .map((band) => band.count),
          );
          return {
            id: `availability-${date}-${count}`,
            start: date,
            end: Temporal.PlainDate.from(date).add({ days: 1 }).toString(),
            allDay: true,
            title: `Up to ${count} cleaners free. Open Day or Week for exact hours.`,
            extendedProps: { count },
            backgroundColor: availabilityColour(count),
          };
        })
      : bands.map((band) => ({
          id: `availability-${band.start}-${band.end}-${band.cleanerIds.join("-")}`,
          start: band.start,
          end: band.end,
          title: `${band.count} ${band.count === 1 ? "cleaner" : "cleaners"} free: ${cleanerNames(band.cleanerIds)}`,
          extendedProps: { count: band.count },
          backgroundColor: availabilityColour(band.count),
        }));
  const events: EventInput[] = [
    ...background.map((event) => ({
      ...event,
      display: "background",
      classNames: ["availability-band"],
      editable: false,
      startEditable: false,
      durationEditable: false,
    })),
    ...data.visits
      .filter(
        (v) => cleanerIds.includes(v.cleaner_id) && v.status !== "cancelled",
      )
      .map((v) => ({
        id: v.id,
        title: `${data.customers.find((c) => c.id === v.customer_id)?.name || "Customer"}${cleanerIds.length > 1 ? ` · ${cleanerNames([v.cleaner_id])}` : ""}`,
        start: v.starts_at,
        end: v.ends_at,
        backgroundColor: v.status === "completed" ? "#6d8b72" : "#37687b",
        extendedProps: {
          customerName:
            data.customers.find((c) => c.id === v.customer_id)?.name ||
            "Customer",
          cleanerName: cleanerNames([v.cleaner_id]),
        },
      })),
  ];
  const selectedHours = data.availability.filter((slot) =>
    cleanerIds.includes(slot.cleaner_id),
  );
  const firstHour = Math.min(
    7,
    ...selectedHours.map((slot) => Number(slot.start_time.slice(0, 2))),
  );
  const lastHour = Math.max(
    21,
    ...selectedHours.map((slot) =>
      Math.ceil(
        (Number(slot.end_time.slice(0, 2)) * 60 +
          Number(slot.end_time.slice(3, 5))) /
          60,
      ),
    ),
  );
  return (
    <div className="calendar-wrap">
      <div
        className="availability-legend"
        aria-label="Free cleaner availability legend"
      >
        <strong>Free availability</strong>
        {[1, 2, 3].map((count) => (
          <span key={count}>
            <i
              style={{ backgroundColor: availabilityColour(count) }}
              aria-hidden="true"
            />
            {count === 3 ? "3+" : count} {count === 1 ? "cleaner" : "cleaners"}
          </span>
        ))}
      </div>
      <p className="form-small calendar-availability-note">
        Green shows selected cleaners’ free hours after bookings and approved
        leave. A deeper shade means more cleaners are free together.
        {range?.view === "dayGridMonth" &&
          " Month shows the highest number free together each day; use Day or Week for exact times."}
      </p>
      <FullCalendar
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin,
          luxonPlugin,
        ]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        timeZone="Europe/London"
        locale="en-gb"
        firstDay={1}
        height="auto"
        allDaySlot={false}
        slotMinTime={`${String(firstHour).padStart(2, "0")}:00:00`}
        slotMaxTime={`${lastHour}:00:00`}
        scrollTime="07:00:00"
        nowIndicator
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek,dayGridMonth",
        }}
        buttonText={{
          today: "Today",
          day: "Day",
          week: "Week",
          month: "Month",
        }}
        datesSet={(info) => {
          const next = {
            start: info.start.toISOString(),
            end: info.end.toISOString(),
            view: info.view.type,
          };
          setRange((previous) =>
            previous?.start === next.start &&
            previous.end === next.end &&
            previous.view === next.view
              ? previous
              : next,
          );
        }}
        events={events}
        eventContent={(info) =>
          info.event.display === "background" ? null : (
            <div className="calendar-event-names">
              {info.timeText && (
                <span className="calendar-event-time">{info.timeText}</span>
              )}
              <PersonName kind="customer">
                {info.event.extendedProps.customerName}
              </PersonName>
              {cleanerIds.length > 1 && (
                <PersonName kind="cleaner">
                  {info.event.extendedProps.cleanerName}
                </PersonName>
              )}
            </div>
          )
        }
        eventDidMount={(info) => {
          info.el.title = info.event.title;
          if (info.event.display === "background")
            info.el.dataset.freeCount = String(info.event.extendedProps.count);
        }}
        eventClick={(info) => {
          const visit = data.visits.find((v) => v.id === info.event.id);
          if (visit) onSelect(visit);
        }}
        editable
        eventDrop={async (info) => {
          try {
            await sendOperation(
              "visit",
              {
                id: info.event.id,
                starts_at: info.event.start?.toISOString(),
              },
              {
                ...adminConfirmation("visit", {}),
                customerName: info.event.extendedProps.customerName,
                cleanerName: info.event.extendedProps.cleanerName,
              },
            );
            await onSaved();
          } catch (e) {
            info.revert();
            if (!(e instanceof ActionCancelled))
              onError(
                e instanceof Error ? e.message : "Could not reschedule visit.",
              );
          }
        }}
        eventResizableFromStart={false}
        eventDurationEditable={false}
      />
      <details className="availability-slots">
        <summary>Available time slots ({bands.length})</summary>
        {!bands.length && (
          <p>No free hours for the selected cleaners in this view.</p>
        )}
        <ul className="data-list">
          {bands.map((band) => (
            <li key={band.start}>
              <div>
                <strong>
                  {londonDate(band.start, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  –
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/London",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(band.end))}
                </strong>
                <small className="person-names">
                  {band.cleanerIds.map((id) => (
                    <PersonName key={id} kind="cleaner">
                      {cleanerNames([id])}
                    </PersonName>
                  ))}
                </small>
              </div>
              <span className="free-count">{band.count} free</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
