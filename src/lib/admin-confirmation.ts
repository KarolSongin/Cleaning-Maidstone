import { stageLabel } from "./acquisition";
import type { AcquisitionStage } from "./models";

export type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  customerName?: string;
  cleanerName?: string;
};
export class ActionCancelled extends Error {
  constructor() {
    super("Action cancelled");
    this.name = "ActionCancelled";
  }
}

/** Every explicit admin write passes through the same confirmation gate. */
export function adminConfirmation(
  action: string,
  value: unknown,
): ConfirmationRequest {
  const data = value as Record<string, unknown>;
  const save = (title: string, description: string): ConfirmationRequest => ({
    title,
    description,
    confirmLabel: "Confirm save",
  });
  switch (action) {
    case "delete_series":
      return {
        title: "Delete this recurring series?",
        description:
          "Remove the series from recurring bookings and permanently delete its upcoming unstarted visits. Past, completed and in-progress visits and their financial history will be kept.",
        confirmLabel: "Delete series",
        danger: true,
      };
    case "visit":
      return data.status === "cancelled"
        ? {
            title: "Cancel this visit?",
            description:
              "Remove this visit from the active rota and booked income. Its record stays in visit history. Other visits in the series stay unchanged.",
            confirmLabel: "Cancel visit",
            danger: true,
          }
        : save(
            "Change this visit?",
            "Save the new time or cleaner assignment for this visit. Other visits in the series stay unchanged.",
          );
    case "booking":
      return {
        title:
          Number(data.interval_weeks) > 0
            ? "Create this recurring booking?"
            : "Book this visit?",
        description: `Add the selected customer, cleaner and agreed rates to the rota${Number(data.interval_weeks) > 0 ? ` for ${data.duration_weeks} weeks` : ""}. Check the booking details before continuing.`,
        confirmLabel: "Confirm booking",
      };
    case "customer":
      return {
        ...save(
          data.id ? "Save customer changes?" : "Create this customer?",
          "Save the contact details, home information and any notes you entered.",
        ),
        customerName: String(data.name ?? "Customer"),
      };
    case "opportunity":
      return {
        ...save(
          data.id ? "Save opportunity changes?" : "Add this opportunity?",
          "Save these contact details and follow-up information in the customer pipeline.",
        ),
        customerName: String(data.name ?? "Contact"),
      };
    case "pipeline_stage":
      if (data.stage === "closed")
        return {
          title: "Close this opportunity?",
          description:
            "Remove this contact from the active pipeline. Existing bookings stay in the calendar; you can reopen the opportunity later.",
          confirmLabel: "Close opportunity",
          danger: true,
        };
      return save(
        data.stage === "onboarded"
          ? "Confirm the regular client agreement?"
          : "Change the pipeline stage?",
        `Move this contact to “${stageLabel(data.stage as AcquisitionStage)}”.${data.stage === "onboarded" ? " Only confirm after agreeing the recurring arrangement with the customer." : ""}`,
      );
    case "visit_finances":
      return save(
        "Save these visit rates?",
        "Update the customer rate, your share and cleaner cash pay for this visit. Other visits and the original recurring agreement keep their current rates.",
      );
    case "cleaner_availability":
      return save(
        "Update weekly availability?",
        "Replace this cleaner’s recurring working days and hours with the schedule you entered. Existing assigned work must still fit these hours.",
      );
    case "review":
      return {
        title: `${data.status === "approved" ? "Approve" : "Decline"} this ${data.kind === "leave" ? "time-off" : "availability"} request?`,
        description:
          data.status === "approved"
            ? data.kind === "leave"
              ? "Approve the requested leave dates. All affected cleans must have cover arranged first."
              : "Apply the requested working hours to the cleaner’s recurring availability."
            : "Mark this request as declined. The cleaner’s approved leave and working hours stay unchanged.",
        confirmLabel:
          data.status === "approved" ? "Approve request" : "Decline request",
        danger: data.status === "declined",
      };
    case "task":
      return save(
        data.id
          ? data.done
            ? "Complete this follow-up?"
            : "Reopen this follow-up?"
          : "Add this follow-up?",
        String(data.title ?? "Save the follow-up task and due date."),
      );
    case "conversation":
      return save(
        "Save conversation changes?",
        "Save the chosen customer association and any admin note. Check that the selected customer is correct.",
      );
    case "content":
      return data.status === "published"
        ? {
            title: "Publish these changes?",
            description: `Publish “${data.title}” on the public website and update its search metadata.`,
            confirmLabel: "Publish changes",
          }
        : save(
            "Save this draft?",
            `Save “${data.title}” as a draft, inaccessible to public visitors.`,
          );
    case "enquiry":
      return save(
        "Update this enquiry?",
        `Set this enquiry to “${data.status}”.`,
      );
    default:
      return save(
        "Save these changes?",
        "Check the details before saving this change.",
      );
  }
}
