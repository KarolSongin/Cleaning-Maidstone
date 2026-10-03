// Generated from applied migrations by npm run db:types:demo. Do not edit.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      acquisition_history: {
        Row: {
          id: string;
          lead_id: string;
          from_stage: string | null;
          to_stage: string;
          reason: string;
          note: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          from_stage?: string | null;
          to_stage: string;
          reason: string;
          note?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          from_stage?: string | null;
          to_stage?: string;
          reason?: string;
          note?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      acquisition_leads: {
        Row: {
          id: string;
          customer_id: string | null;
          name: string;
          email: string;
          phone: string;
          postcode: string;
          source: string;
          stage: string;
          stage_before_booking: string | null;
          first_visit_id: string | null;
          first_clean_on: string | null;
          follow_up_due_on: string | null;
          next_contact_on: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          name: string;
          email?: string;
          phone?: string;
          postcode?: string;
          source: string;
          stage?: string;
          stage_before_booking?: string | null;
          first_visit_id?: string | null;
          first_clean_on?: string | null;
          follow_up_due_on?: string | null;
          next_contact_on?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          name?: string;
          email?: string;
          phone?: string;
          postcode?: string;
          source?: string;
          stage?: string;
          stage_before_booking?: string | null;
          first_visit_id?: string | null;
          first_clean_on?: string | null;
          follow_up_due_on?: string | null;
          next_contact_on?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_records: {
        Row: {
          id: number;
          actor_id: string | null;
          entity: string;
          entity_id: string;
          operation: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          entity: string;
          entity_id: string;
          operation: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          entity?: string;
          entity_id?: string;
          operation?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          cleaner_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          cleaner_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          id?: string;
          cleaner_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      availability_requests: {
        Row: {
          id: string;
          cleaner_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          status: string;
        };
        Insert: {
          id?: string;
          cleaner_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          status?: string;
        };
        Update: {
          id?: string;
          cleaner_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          status?: string;
        };
        Relationships: [];
      };
      booking_series: {
        Row: {
          id: string;
          customer_id: string;
          cleaner_id: string;
          anchor_date: string;
          local_time: string;
          duration_minutes: number;
          interval_weeks: number;
          timezone: string;
          active: boolean;
          duration_weeks: number;
          ends_on: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          cleaner_id: string;
          anchor_date: string;
          local_time: string;
          duration_minutes: number;
          interval_weeks: number;
          timezone?: string;
          active?: boolean;
          duration_weeks: number;
          ends_on: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          cleaner_id?: string;
          anchor_date?: string;
          local_time?: string;
          duration_minutes?: number;
          interval_weeks?: number;
          timezone?: string;
          active?: boolean;
          duration_weeks?: number;
          ends_on?: string;
        };
        Relationships: [];
      };
      call_events: {
        Row: {
          id: string;
          conversation_id: string;
          provider: string;
          event_key: string;
          call_leg_id: string;
          status: string;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          provider: string;
          event_key: string;
          call_leg_id: string;
          status: string;
          occurred_at: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          provider?: string;
          event_key?: string;
          call_leg_id?: string;
          status?: string;
          occurred_at?: string;
        };
        Relationships: [];
      };
      cleaners: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          availability_updated_at: string;
          pay_updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          availability_updated_at?: string;
          pay_updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          availability_updated_at?: string;
          pay_updated_at?: string;
        };
        Relationships: [];
      };
      content: {
        Row: {
          id: string;
          kind: string;
          slug: string;
          title: string;
          excerpt: string;
          seo_title: string;
          seo_description: string;
          body: Json;
          sections: Json;
          image_path: string | null;
          image_alt: string;
          author: string;
          category: string;
          status: string;
          published_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          slug: string;
          title: string;
          excerpt?: string;
          seo_title?: string;
          seo_description?: string;
          body?: Json;
          sections?: Json;
          image_path?: string | null;
          image_alt?: string;
          author?: string;
          category?: string;
          status?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          slug?: string;
          title?: string;
          excerpt?: string;
          seo_title?: string;
          seo_description?: string;
          body?: Json;
          sections?: Json;
          image_path?: string | null;
          image_alt?: string;
          author?: string;
          category?: string;
          status?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_notes: {
        Row: {
          id: string;
          conversation_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          provider: string;
          root_call_id: string;
          caller: string;
          direction: string;
          status: string;
          status_rank: number;
          started_at: string;
          duration_seconds: number;
          suggested_customer_id: string | null;
          customer_id: string | null;
          recording_status: string;
          transcript_status: string;
        };
        Insert: {
          id?: string;
          provider: string;
          root_call_id: string;
          caller: string;
          direction?: string;
          status?: string;
          status_rank?: number;
          started_at?: string;
          duration_seconds?: number;
          suggested_customer_id?: string | null;
          customer_id?: string | null;
          recording_status?: string;
          transcript_status?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          root_call_id?: string;
          caller?: string;
          direction?: string;
          status?: string;
          status_rank?: number;
          started_at?: string;
          duration_seconds?: number;
          suggested_customer_id?: string | null;
          customer_id?: string | null;
          recording_status?: string;
          transcript_status?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string;
          postcode: string;
          preferences: string;
          internal_notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string;
          postcode?: string;
          preferences?: string;
          internal_notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string;
          postcode?: string;
          preferences?: string;
          internal_notes?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      enquiries: {
        Row: {
          id: string;
          customer_id: string | null;
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
          pipeline_id: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          name: string;
          email: string;
          phone: string;
          postcode: string;
          frequency: string;
          home_size: string;
          preferred_days?: string[];
          notes?: string;
          status?: string;
          created_at?: string;
          pipeline_id: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          name?: string;
          email?: string;
          phone?: string;
          postcode?: string;
          frequency?: string;
          home_size?: string;
          preferred_days?: string[];
          notes?: string;
          status?: string;
          created_at?: string;
          pipeline_id?: string;
        };
        Relationships: [];
      };
      enquiry_throttle: {
        Row: {
          key: string;
          window_start: string;
          attempts: number;
        };
        Insert: {
          key: string;
          window_start?: string;
          attempts?: number;
        };
        Update: {
          key?: string;
          window_start?: string;
          attempts?: number;
        };
        Relationships: [];
      };
      follow_up_tasks: {
        Row: {
          id: string;
          customer_id: string | null;
          conversation_id: string | null;
          title: string;
          due_on: string;
          done: boolean;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          conversation_id?: string | null;
          title: string;
          due_on: string;
          done?: boolean;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          conversation_id?: string | null;
          title?: string;
          due_on?: string;
          done?: boolean;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          cleaner_id: string;
          starts_on: string;
          ends_on: string;
          reason: string;
          status: string;
        };
        Insert: {
          id?: string;
          cleaner_id: string;
          starts_on: string;
          ends_on: string;
          reason?: string;
          status?: string;
        };
        Update: {
          id?: string;
          cleaner_id?: string;
          starts_on?: string;
          ends_on?: string;
          reason?: string;
          status?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          display_name?: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      recordings: {
        Row: {
          id: string;
          conversation_id: string;
          provider_sid: string;
          private_path: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          provider_sid: string;
          private_path?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          provider_sid?: string;
          private_path?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      series_finances: {
        Row: {
          id: string;
          customer_rate_pence: number;
          admin_rate_pence: number;
          cleaner_rate_pence: number;
        };
        Insert: {
          id?: string;
          customer_rate_pence: number;
          admin_rate_pence: number;
          cleaner_rate_pence: number;
        };
        Update: {
          id?: string;
          customer_rate_pence?: number;
          admin_rate_pence?: number;
          cleaner_rate_pence?: number;
        };
        Relationships: [];
      };
      transcription_jobs: {
        Row: {
          id: string;
          recording_id: string;
          provider_job_id: string | null;
          status: string;
          attempts: number;
          lease_at: string | null;
          error_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recording_id: string;
          provider_job_id?: string | null;
          status?: string;
          attempts?: number;
          lease_at?: string | null;
          error_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recording_id?: string;
          provider_job_id?: string | null;
          status?: string;
          attempts?: number;
          lease_at?: string | null;
          error_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transcripts: {
        Row: {
          id: string;
          conversation_id: string;
          status: string;
          text: string | null;
          error_code: string | null;
          is_ai_summary: boolean;
          human_reviewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          status: string;
          text?: string | null;
          error_code?: string | null;
          is_ai_summary?: boolean;
          human_reviewed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          status?: string;
          text?: string | null;
          error_code?: string | null;
          is_ai_summary?: boolean;
          human_reviewed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      visit_finances: {
        Row: {
          id: string;
          customer_rate_pence: number;
          admin_rate_pence: number;
          cleaner_rate_pence: number;
        };
        Insert: {
          id?: string;
          customer_rate_pence: number;
          admin_rate_pence: number;
          cleaner_rate_pence: number;
        };
        Update: {
          id?: string;
          customer_rate_pence?: number;
          admin_rate_pence?: number;
          cleaner_rate_pence?: number;
        };
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          series_id: string | null;
          customer_id: string;
          cleaner_id: string;
          starts_at: string;
          ends_at: string;
          instructions: string;
          status: string;
          is_exception: boolean;
        };
        Insert: {
          id?: string;
          series_id?: string | null;
          customer_id: string;
          cleaner_id: string;
          starts_at: string;
          ends_at: string;
          instructions?: string;
          status?: string;
          is_exception?: boolean;
        };
        Update: {
          id?: string;
          series_id?: string | null;
          customer_id?: string;
          cleaner_id?: string;
          starts_at?: string;
          ends_at?: string;
          instructions?: string;
          status?: string;
          is_exception?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      annotate_conversation: { Args: { p: Json }; Returns: undefined };
      change_visit: { Args: { p: Json }; Returns: undefined };
      claim_transcription_jobs: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          recording_id: string;
          provider_sid: string;
          private_path: string;
          conversation_id: string;
        }[];
      };
      cleaner_jobs: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          instructions: string;
          customer_name: string;
          address: string;
          postcode: string;
          cleaner_rate_pence: number;
          cleaner_total_pence: number;
        }[];
      };
      create_booking: { Args: { p: Json }; Returns: string };
      enqueue_transcription: { Args: { rid: string }; Returns: undefined };
      ingest_call_event: { Args: { p: Json }; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      pipeline_booking_stage: {
        Args: { first_start: string; as_of: string };
        Returns: string;
      };
      purge_expired_recording: { Args: { rid: string }; Returns: undefined };
      record_pipeline_change: {
        Args: {
          lid: string;
          previous: string;
          current_stage: string;
          why: string;
          description: string;
        };
        Returns: undefined;
      };
      refresh_customer_pipeline: { Args: { cid: string }; Returns: boolean };
      register_cleaner: { Args: { p: Json }; Returns: undefined };
      remove_recording: { Args: { rid: string }; Returns: undefined };
      request_availability: { Args: { p: Json }; Returns: string };
      request_leave: { Args: { p: Json }; Returns: string };
      require_admin: { Args: Record<string, never>; Returns: undefined };
      review_request: { Args: { p: Json }; Returns: undefined };
      run_customer_pipeline_job: {
        Args: Record<string, never>;
        Returns: number;
      };
      save_cleaner_availability: { Args: { p: Json }; Returns: undefined };
      save_content: { Args: { p: Json }; Returns: string };
      save_customer: { Args: { p: Json }; Returns: string };
      save_opportunity: { Args: { p: Json }; Returns: string };
      save_task: { Args: { p: Json }; Returns: string };
      save_visit_finances: { Args: { p: Json }; Returns: undefined };
      set_pipeline_stage: { Args: { p: Json }; Returns: undefined };
      set_transcript: { Args: { p: Json }; Returns: undefined };
      submit_enquiry: {
        Args: { p: Json; throttle_key: string };
        Returns: string;
      };
      sync_customer_pipeline: { Args: Record<string, never>; Returns: number };
      sync_pipeline_internal: { Args: Record<string, never>; Returns: number };
      transition_visit: {
        Args: { vid: string; new_status: string };
        Returns: undefined;
      };
      update_enquiry: {
        Args: { eid: string; new_status: string };
        Returns: undefined;
      };
      update_transcription_job: { Args: { p: Json }; Returns: undefined };
      validate_booking_rates: { Args: { p: Json }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
