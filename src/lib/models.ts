export type Role = "admin" | "cleaner";
export type Actor = { id: string; role: Role; name: string; demo: boolean };
export type Content = {
  id: string;
  kind: "page" | "blog";
  slug: string;
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  body: Record<string, unknown>;
  sections: { heading: string; text: string }[];
  image_path: string | null;
  image_alt: string;
  author: string;
  category: string;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
};
export type Customer = {
  id: string;
  deleted_at?: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  preferences: string;
  internal_notes: string;
};
export type Cleaner = {
  id: string;
  name: string;
  active: boolean;
  deleted_at?: string | null;
};
export type WeeklyAvailability = {
  weekday: number;
  start_time: string;
  end_time: string;
};
export type CleanerAvailability = WeeklyAvailability & { cleaner_id: string };
export type Visit = {
  id: string;
  customer_id: string;
  cleaner_id: string;
  starts_at: string;
  ends_at: string;
  instructions: string;
  status: string;
  series_id: string | null;
};
export type BookingSeries = {
  id: string;
  deleted_at?: string | null;
  customer_id: string;
  cleaner_id: string;
  anchor_date: string;
  ends_on: string;
  duration_weeks: number;
  local_time: string;
  duration_minutes: number;
  interval_weeks: 1 | 2;
  active: boolean;
};
export type BookingRates = {
  customer_rate_pence: number;
  admin_rate_pence: number;
  cleaner_rate_pence: number;
};
export type BookingFinance = BookingRates & { id: string };
export type CleanerJob = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  instructions: string;
  customer_name: string;
  cleaner_rate_pence: number | null;
  cleaner_total_pence: number | null;
  address: string;
  postcode: string;
};
export type Enquiry = {
  id: string;
  customer_id: string | null;
  pipeline_id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  frequency: string;
  home_size: string;
  preferred_days: string[];
  notes: string;
  status: string;
  created_at: string;
};
export type Task = {
  id: string;
  customer_id?: string | null;
  title: string;
  due_on: string;
  done: boolean;
  conversation_id: string | null;
};
export type Conversation = {
  id: string;
  provider: string;
  root_call_id: string;
  caller: string;
  direction: string;
  status: string;
  started_at: string;
  duration_seconds: number;
  customer_id: string | null;
  suggested_customer_id: string | null;
  recording_status: string;
  transcript_status: string;
};
export type RequestRecord = {
  id: string;
  cleaner_id: string;
  status: string;
  starts_on?: string;
  ends_on?: string;
  reason?: string;
  weekday?: number;
  start_time?: string;
  end_time?: string;
};
export type DashboardData = {
  acquisition_leads: AcquisitionLead[];
  acquisition_history: AcquisitionHistory[];
  customers: Customer[];
  cleaners: Cleaner[];
  visits: Visit[];
  booking_series: BookingSeries[];
  visit_finances: BookingFinance[];
  series_finances: BookingFinance[];
  enquiries: Enquiry[];
  tasks: Task[];
  conversations: Conversation[];
  content: Content[];
  leave_requests: RequestRecord[];
  availability_requests: RequestRecord[];
  availability: CleanerAvailability[];
  recordings: {
    id: string;
    conversation_id: string;
    provider_sid: string;
    expires_at: string;
  }[];
  transcripts: {
    id: string;
    conversation_id: string;
    status: string;
    text: string | null;
    error_code: string | null;
    is_ai_summary: boolean;
    human_reviewed: boolean;
  }[];
  conversation_notes: {
    id: string;
    conversation_id: string;
    body: string;
    created_at: string;
  }[];
};

export type AcquisitionStage =
  | "opportunity"
  | "contacted"
  | "quoted"
  | "first_clean_booked"
  | "recurring_follow_up"
  | "onboarded"
  | "closed";
export type AcquisitionLead = {
  id: string;
  customer_id: string | null;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  source: "website" | "manual" | "existing";
  stage: AcquisitionStage;
  stage_before_booking: "opportunity" | "contacted" | "quoted" | null;
  first_visit_id: string | null;
  first_clean_on: string | null;
  follow_up_due_on: string | null;
  next_contact_on: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type AcquisitionHistory = {
  id: string;
  lead_id: string;
  from_stage: AcquisitionStage | null;
  to_stage: AcquisitionStage;
  reason:
    | "intake"
    | "manual"
    | "booking"
    | "date"
    | "cancelled"
    | "linked"
    | "import";
  note: string;
  actor_id: string | null;
  created_at: string;
};
