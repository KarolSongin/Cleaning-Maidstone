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
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  preferences: string;
  internal_notes: string;
};
export type Cleaner = { id: string; name: string; active: boolean };
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
export type CleanerJob = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  instructions: string;
  customer_name: string;
  address: string;
  postcode: string;
};
export type Enquiry = {
  id: string;
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
  customers: Customer[];
  cleaners: Cleaner[];
  visits: Visit[];
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
