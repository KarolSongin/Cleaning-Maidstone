import type { AcquisitionLead, AcquisitionStage } from "./models";
import { calendarDate } from "./recurring-bookings";

export const acquisitionStages: {
  id: AcquisitionStage;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    id: "opportunity",
    label: "Opportunity",
    short: "Opportunity",
    description: "New enquiries to pick up.",
  },
  {
    id: "contacted",
    label: "Contacted for details",
    short: "Contacted",
    description: "Finding out what they need.",
  },
  {
    id: "quoted",
    label: "Quote given",
    short: "Quoted",
    description: "Quote sent, awaiting a decision.",
  },
  {
    id: "first_clean_booked",
    label: "First cleaning booked",
    short: "First clean",
    description: "A first visit is in the calendar.",
  },
  {
    id: "recurring_follow_up",
    label: "Contact for recurring agreement",
    short: "Recurring follow-up",
    description: "Agree the next step after their first clean.",
  },
  {
    id: "onboarded",
    label: "Onboarded regular client",
    short: "Onboarded",
    description: "Regular agreement confirmed by you.",
  },
];
export const stageLabel = (stage: AcquisitionStage) =>
  acquisitionStages.find((s) => s.id === stage)?.label ?? "Closed";
export const sourceLabel = (source: AcquisitionLead["source"]) =>
  ({
    website: "Website enquiry",
    manual: "Manual entry",
    existing: "Existing record",
  })[source];
export function contactDueOn(lead: AcquisitionLead): string | null {
  if (lead.stage === "closed" || lead.stage === "onboarded") return null;
  // A chosen next-contact date can postpone or bring forward the recurring follow-up.
  return (
    lead.next_contact_on ??
    (lead.stage === "recurring_follow_up" ? lead.follow_up_due_on : null)
  );
}
export function contactIsDue(lead: AcquisitionLead, today: string): boolean {
  const date = contactDueOn(lead);
  return date !== null && date <= today;
}
export function acquisitionDate(value: string): string {
  return calendarDate(value);
}
