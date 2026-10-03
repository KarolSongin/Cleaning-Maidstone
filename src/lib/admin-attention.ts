import { Temporal } from "@js-temporal/polyfill";
import type { DashboardData } from "./models";
import { contactIsDue } from "./acquisition";
import { recurringSummaries } from "./recurring-bookings";

export const attentionReasons = {
  overview: "follow-ups due",
  pipeline: "new enquiries or contacts due",
  customers: "customer records missing an address or postcode",
  calendar: "past visits awaiting completion",
  recurring: "recurring bookings ending within a month",
  finances: "visits needing rates",
  cleaners: "time-off or availability requests awaiting review",
  conversations: "suggested customer matches awaiting confirmation",
  content: "drafts awaiting review",
} as const;
export type AdminSection = keyof typeof attentionReasons;
export type AdminAttention = Record<AdminSection, number>;

/** Counts outstanding work, rather than page views or unread records. */
export function adminAttention(
  data: DashboardData,
  now: string,
): AdminAttention {
  const instant = Temporal.Instant.from(now);
  const today = instant
    .toZonedDateTimeISO("Europe/London")
    .toPlainDate()
    .toString();
  const priced = new Set(data.visit_finances.map((finance) => finance.id));
  return {
    overview: data.tasks.filter((task) => !task.done && task.due_on <= today)
      .length,
    pipeline: data.acquisition_leads.filter(
      (lead) => lead.stage === "opportunity" || contactIsDue(lead, today),
    ).length,
    customers: data.customers.filter(
      (customer) => !customer.address.trim() || !customer.postcode.trim(),
    ).length,
    calendar: data.visits.filter(
      (visit) =>
        ["scheduled", "started"].includes(visit.status) &&
        Temporal.Instant.compare(
          Temporal.Instant.from(visit.ends_at),
          instant,
        ) <= 0,
    ).length,
    recurring: recurringSummaries(data, today).filter(
      (summary) => summary.status === "ending-soon",
    ).length,
    finances: data.visits.filter(
      (visit) => visit.status !== "cancelled" && !priced.has(visit.id),
    ).length,
    cleaners: [...data.leave_requests, ...data.availability_requests].filter(
      (request) => request.status === "pending",
    ).length,
    conversations: data.conversations.filter(
      (conversation) =>
        !conversation.customer_id && !!conversation.suggested_customer_id,
    ).length,
    content: data.content.filter((item) => item.status === "draft").length,
  };
}
