// Generated from 202610020001_foundation.sql by npm run db:types:demo. Do not edit.
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
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
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
        }[];
      };
      create_booking: { Args: { p: Json }; Returns: string };
      enqueue_transcription: { Args: { rid: string }; Returns: undefined };
      ingest_call_event: { Args: { p: Json }; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      purge_expired_recording: { Args: { rid: string }; Returns: undefined };
      register_cleaner: { Args: { p: Json }; Returns: undefined };
      remove_recording: { Args: { rid: string }; Returns: undefined };
      request_availability: { Args: { p: Json }; Returns: string };
      request_leave: { Args: { p: Json }; Returns: string };
      require_admin: { Args: Record<string, never>; Returns: undefined };
      review_request: { Args: { p: Json }; Returns: undefined };
      save_content: { Args: { p: Json }; Returns: string };
      save_customer: { Args: { p: Json }; Returns: string };
      save_task: { Args: { p: Json }; Returns: string };
      set_transcript: { Args: { p: Json }; Returns: undefined };
      submit_enquiry: {
        Args: { p: Json; throttle_key: string };
        Returns: string;
      };
      transition_visit: {
        Args: { vid: string; new_status: string };
        Returns: undefined;
      };
      update_enquiry: {
        Args: { eid: string; new_status: string };
        Returns: undefined;
      };
      update_transcription_job: { Args: { p: Json }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
