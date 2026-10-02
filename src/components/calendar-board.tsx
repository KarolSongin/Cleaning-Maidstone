"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import type { DashboardData, Visit } from "@/lib/models";
import { sendOperation } from "./operation-form";
export default function CalendarBoard({
  data,
  cleaner,
  onSelect,
  onSaved,
  onError,
}: {
  data: DashboardData;
  cleaner: string;
  onSelect: (v: Visit) => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="calendar-wrap">
      <FullCalendar
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin,
          luxonPlugin,
        ]}
        initialView="timeGridWeek"
        timeZone="Europe/London"
        locale="en-gb"
        firstDay={1}
        height="auto"
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
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
        events={data.visits
          .filter(
            (v) =>
              (!cleaner || v.cleaner_id === cleaner) &&
              v.status !== "cancelled",
          )
          .map((v) => ({
            id: v.id,
            title:
              data.customers.find((c) => c.id === v.customer_id)?.name ||
              "Customer",
            start: v.starts_at,
            end: v.ends_at,
            backgroundColor: v.status === "completed" ? "#6d8b72" : "#37687b",
          }))}
        eventClick={(info) => {
          const visit = data.visits.find((v) => v.id === info.event.id);
          if (visit) onSelect(visit);
        }}
        editable
        eventDrop={async (info) => {
          try {
            await sendOperation("visit", {
              id: info.event.id,
              starts_at: info.event.start?.toISOString(),
            });
            await onSaved();
          } catch (e) {
            info.revert();
            onError(
              e instanceof Error ? e.message : "Could not reschedule visit.",
            );
          }
        }}
        eventResizableFromStart={false}
        eventDurationEditable={false}
      />
    </div>
  );
}
