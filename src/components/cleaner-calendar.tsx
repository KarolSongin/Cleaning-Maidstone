"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";
import { useState } from "react";
import type { CleanerJob } from "@/lib/models";
import { londonDate } from "@/lib/scheduling";
import { PersonName } from "./person-name";
export default function CleanerCalendar({
  jobs,
  onSelect,
}: {
  jobs: CleanerJob[];
  onSelect: (job: CleanerJob) => void;
}) {
  const [compact] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [now] = useState(Date.now);
  const upcoming = [...jobs]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .find((job) => Date.parse(job.ends_at) >= now);
  return (
    <div className="calendar-wrap cleaner-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]}
        initialView={compact ? "timeGridDay" : "timeGridWeek"}
        initialDate={upcoming?.starts_at}
        timeZone="Europe/London"
        locale="en-gb"
        firstDay={1}
        height="auto"
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        nowIndicator
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        droppable={false}
        selectable={false}
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
        events={jobs
          .filter((job) => job.status !== "cancelled")
          .map((job) => ({
            id: job.id,
            title: job.customer_name,
            start: job.starts_at,
            end: job.ends_at,
            url: "#assigned-visit",
            backgroundColor:
              job.status === "completed"
                ? "#6d8b72"
                : job.status === "started"
                  ? "#a17838"
                  : "#37687b",
          }))}
        eventDidMount={(info) => {
          const job = jobs.find((j) => j.id === info.event.id);
          if (job)
            info.el.setAttribute(
              "aria-label",
              "View assigned visit: " +
                job.customer_name +
                ", " +
                londonDate(job.starts_at, {
                  hour: "2-digit",
                  minute: "2-digit",
                }) +
                ", " +
                job.status,
            );
        }}
        eventContent={(info) => (
          <div className="calendar-event-names">
            {info.timeText && (
              <span className="calendar-event-time">{info.timeText}</span>
            )}
            <PersonName kind="customer">{info.event.title}</PersonName>
          </div>
        )}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const job = jobs.find((j) => j.id === info.event.id);
          if (job) onSelect(job);
        }}
      />
    </div>
  );
}
