import { describe, expect, it } from "vitest";
import { adminAttention } from "@/lib/admin-attention";
import type {
  AcquisitionLead,
  BookingSeries,
  Conversation,
  DashboardData,
  Visit,
} from "@/lib/models";

const empty = (): DashboardData => ({
  acquisition_leads: [],
  acquisition_history: [],
  customers: [],
  cleaners: [],
  visits: [],
  booking_series: [],
  visit_finances: [],
  series_finances: [],
  enquiries: [],
  tasks: [],
  conversations: [],
  content: [],
  leave_requests: [],
  availability_requests: [],
  availability: [],
  recordings: [],
  transcripts: [],
  conversation_notes: [],
});
const now = "2026-10-03T10:00:00Z";
const lead = (
  id: string,
  stage: AcquisitionLead["stage"],
  date: string | null = null,
): AcquisitionLead => ({
  id,
  stage,
  next_contact_on: date,
  name: "Contact",
  customer_id: null,
  email: "",
  phone: "",
  postcode: "",
  source: "manual",
  stage_before_booking: null,
  first_visit_id: null,
  first_clean_on: null,
  follow_up_due_on: null,
  notes: "",
  created_at: now,
  updated_at: now,
});
const visit = (id: string, status = "scheduled", ends_at = now): Visit => ({
  id,
  status,
  ends_at,
  starts_at: "2026-10-03T08:00:00Z",
  cleaner_id: "cleaner",
  customer_id: "customer",
  instructions: "",
  series_id: null,
});
const series = (id: string, ends_on: string, active = true): BookingSeries => ({
  id,
  ends_on,
  active,
  customer_id: "customer",
  cleaner_id: "cleaner",
  anchor_date: "2026-01-01",
  duration_weeks: 52,
  local_time: "09:00",
  duration_minutes: 120,
  interval_weeks: 1,
});
const conversation = (
  id: string,
  customer_id: string | null,
  suggested_customer_id: string | null,
): Conversation => ({
  id,
  customer_id,
  suggested_customer_id,
  provider: "demo",
  root_call_id: id,
  caller: "",
  direction: "inbound",
  status: "completed",
  started_at: now,
  duration_seconds: 10,
  recording_status: "none",
  transcript_status: "none",
});

describe("admin navigation attention", () => {
  it("has no badges when nothing needs action", () => {
    expect(Object.values(adminAttention(empty(), now))).toEqual(
      Array(9).fill(0),
    );
  });
  it("counts pending time off and hours changes once per request, clearing on review", () => {
    const data = empty();
    data.leave_requests = [
      {
        id: "leave",
        cleaner_id: "cleaner",
        status: "pending",
        starts_on: "2027-01-01",
        ends_on: "2027-01-10",
      },
      { id: "approved", cleaner_id: "cleaner", status: "approved" },
    ];
    data.availability_requests = [
      { id: "hours", cleaner_id: "cleaner", status: "pending" },
      { id: "declined", cleaner_id: "cleaner", status: "declined" },
    ];
    expect(adminAttention(data, now).cleaners).toBe(2);
    data.leave_requests[0].status = "approved";
    data.availability_requests[0].status = "declined";
    expect(adminAttention(data, now).cleaners).toBe(0);
  });
  it("deduplicates new enquiries that also have a contact due and ignores closed clients", () => {
    const data = empty();
    data.acquisition_leads = [
      lead("new", "opportunity", "2026-10-01"),
      lead("due", "quoted", "2026-10-03"),
      lead("future", "contacted", "2026-10-04"),
      lead("closed", "closed", "2026-10-01"),
      lead("onboarded", "onboarded", "2026-10-01"),
    ];
    expect(adminAttention(data, now).pipeline).toBe(2);
    data.acquisition_leads[0].stage = "contacted";
    data.acquisition_leads[0].next_contact_on = "2026-10-04";
    expect(adminAttention(data, now).pipeline).toBe(1);
  });
  it("uses London midnight for due contacts and unfinished tasks", () => {
    const data = empty();
    data.tasks = [
      {
        id: "due",
        title: "Call",
        due_on: "2026-07-02",
        done: false,
        conversation_id: null,
      },
      {
        id: "done",
        title: "Done",
        due_on: "2026-07-01",
        done: true,
        conversation_id: null,
      },
      {
        id: "future",
        title: "Later",
        due_on: "2026-07-03",
        done: false,
        conversation_id: null,
      },
    ];
    data.acquisition_leads = [lead("due", "quoted", "2026-07-02")];
    expect(adminAttention(data, "2026-07-01T22:59:59Z").overview).toBe(0);
    const counts = adminAttention(data, "2026-07-01T23:00:00Z");
    expect(counts.overview).toBe(1);
    expect(counts.pipeline).toBe(1);
  });
  it("only flags visits that have ended and still await completion", () => {
    const data = empty();
    data.visits = [
      visit("ended"),
      visit("started", "started"),
      visit("future", "scheduled", "2026-10-03T11:00:00Z"),
      visit("completed", "completed"),
      visit("cancelled", "cancelled"),
    ];
    expect(adminAttention(data, now).calendar).toBe(2);
  });
  it("counts unpriced visits but treats agreed zero rates as priced and excludes cancellations", () => {
    const data = empty();
    data.visits = [
      visit("missing"),
      visit("zero"),
      visit("cancelled", "cancelled"),
    ];
    data.visit_finances = [
      {
        id: "zero",
        customer_rate_pence: 0,
        admin_rate_pence: 0,
        cleaner_rate_pence: 0,
      },
    ];
    expect(adminAttention(data, now).finances).toBe(1);
  });
  it("flags renewal from one calendar month before expiry without keeping old terms flagged", () => {
    const data = empty();
    data.booking_series = [
      series("boundary", "2026-11-03"),
      series("later", "2026-11-04"),
      series("ended", "2026-10-02"),
      series("inactive", "2026-10-10", false),
      series("cancelled", "2026-10-10"),
    ];
    data.visits = [
      { ...visit("cancelled", "cancelled"), series_id: "cancelled" },
    ];
    expect(adminAttention(data, now).recurring).toBe(1);
  });
  it("only counts customer matches that remain unconfirmed", () => {
    const data = empty();
    data.conversations = [
      conversation("suggested", null, "customer"),
      conversation("confirmed", "customer", "customer"),
      conversation("unmatched", null, null),
    ];
    expect(adminAttention(data, now).conversations).toBe(1);
    data.conversations[0].customer_id = "customer";
    expect(adminAttention(data, now).conversations).toBe(0);
  });
  it("flags incomplete customer home details and content drafts", () => {
    const data = empty();
    const customer = {
      id: "complete",
      name: "Client",
      email: "",
      phone: "",
      address: "1 High Street",
      postcode: "ME14 1AA",
      preferences: "",
      internal_notes: "",
    };
    data.customers = [customer, { ...customer, id: "missing", address: " " }];
    const content = {
      id: "draft",
      kind: "page" as const,
      slug: "test",
      title: "Test",
      excerpt: "",
      seo_title: "",
      seo_description: "",
      body: {},
      sections: [],
      image_path: null,
      image_alt: "",
      author: "Admin",
      category: "",
      status: "draft" as const,
      published_at: null,
      updated_at: now,
    };
    data.content = [
      content,
      { ...content, id: "published", status: "published" },
    ];
    const counts = adminAttention(data, now);
    expect(counts.customers).toBe(1);
    expect(counts.content).toBe(1);
  });
});
