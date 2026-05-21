export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_status_log: {
        Row: {
          action_id: string
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["action_status"] | null
          id: string
          organisation_id: string
          to_status: Database["public"]["Enums"]["action_status"]
        }
        Insert: {
          action_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["action_status"] | null
          id?: string
          organisation_id: string
          to_status: Database["public"]["Enums"]["action_status"]
        }
        Update: {
          action_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["action_status"] | null
          id?: string
          organisation_id?: string
          to_status?: Database["public"]["Enums"]["action_status"]
        }
        Relationships: [
          {
            foreignKeyName: "action_status_log_organisation_id_action_id_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "action_status_log_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          labels: string[]
          not_started_since: string | null
          notes: string
          organisation_id: string
          priority: Database["public"]["Enums"]["action_priority"]
          start_date: string | null
          status: Database["public"]["Enums"]["action_status"]
          task: string
          updated_at: string
          wbs_node_id: string | null
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          labels?: string[]
          not_started_since?: string | null
          notes?: string
          organisation_id: string
          priority?: Database["public"]["Enums"]["action_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          task: string
          updated_at?: string
          wbs_node_id?: string | null
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          labels?: string[]
          not_started_since?: string | null
          notes?: string
          organisation_id?: string
          priority?: Database["public"]["Enums"]["action_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          task?: string
          updated_at?: string
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      attachments: {
        Row: {
          action_id: string | null
          created_at: string
          id: string
          mime_type: string
          organisation_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploader_id: string | null
          waiting_item_id: string | null
          wbs_node_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          id?: string
          mime_type: string
          organisation_id: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploader_id?: string | null
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          organisation_id?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          uploader_id?: string | null
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organisation_id_action_id_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "attachments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_organisation_id_waiting_item_id_fkey"
            columns: ["organisation_id", "waiting_item_id"]
            isOneToOne: false
            referencedRelation: "waiting_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "attachments_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      comments: {
        Row: {
          action_id: string | null
          author_id: string | null
          content: string
          created_at: string
          edited: boolean
          id: string
          organisation_id: string
          parent_comment_id: string | null
          updated_at: string
          waiting_item_id: string | null
          wbs_node_id: string | null
        }
        Insert: {
          action_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string
          edited?: boolean
          id?: string
          organisation_id: string
          parent_comment_id?: string | null
          updated_at?: string
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Update: {
          action_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          edited?: boolean
          id?: string
          organisation_id?: string
          parent_comment_id?: string | null
          updated_at?: string
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_organisation_id_action_id_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "comments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organisation_id_waiting_item_id_fkey"
            columns: ["organisation_id", "waiting_item_id"]
            isOneToOne: false
            referencedRelation: "waiting_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "comments_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          created_at: string
          description: string
          github_issue_url: string | null
          id: string
          organisation_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          github_issue_url?: string | null
          id?: string
          organisation_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          github_issue_url?: string | null
          id?: string
          organisation_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_suggestions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      gathered_state: {
        Row: {
          created_at: string
          durations: Json
          id: string
          order_ids: string[]
          organisation_id: string
          schedule: Json
          task_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          durations?: Json
          id?: string
          order_ids?: string[]
          organisation_id: string
          schedule?: Json
          task_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          durations?: Json
          id?: string
          order_ids?: string[]
          organisation_id?: string
          schedule?: Json
          task_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gathered_state_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_score_history: {
        Row: {
          components: Json
          created_at: string
          id: string
          organisation_id: string
          recorded_week: string
          score: number
          user_id: string
        }
        Insert: {
          components?: Json
          created_at?: string
          id?: string
          organisation_id: string
          recorded_week: string
          score: number
          user_id: string
        }
        Update: {
          components?: Json
          created_at?: string
          id?: string
          organisation_id?: string
          recorded_week?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_score_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_item_events: {
        Row: {
          event_at: string
          event_type: Database["public"]["Enums"]["inbox_event_type"]
          id: string
          inbox_item_id: string | null
          organisation_id: string
          snapshot_created_at: string | null
          snapshot_source_id: string | null
          snapshot_task: string | null
          user_id: string | null
        }
        Insert: {
          event_at?: string
          event_type: Database["public"]["Enums"]["inbox_event_type"]
          id?: string
          inbox_item_id?: string | null
          organisation_id: string
          snapshot_created_at?: string | null
          snapshot_source_id?: string | null
          snapshot_task?: string | null
          user_id?: string | null
        }
        Update: {
          event_at?: string
          event_type?: Database["public"]["Enums"]["inbox_event_type"]
          id?: string
          inbox_item_id?: string | null
          organisation_id?: string
          snapshot_created_at?: string | null
          snapshot_source_id?: string | null
          snapshot_task?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_item_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          external_id: string | null
          external_url: string | null
          id: string
          notes: string
          organisation_id: string
          priority: Database["public"]["Enums"]["action_priority"]
          promoted_at: string | null
          promoted_to_action_id: string | null
          source_id: string | null
          task: string
          updated_at: string
          wbs_node_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          notes?: string
          organisation_id: string
          priority?: Database["public"]["Enums"]["action_priority"]
          promoted_at?: string | null
          promoted_to_action_id?: string | null
          source_id?: string | null
          task: string
          updated_at?: string
          wbs_node_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          notes?: string
          organisation_id?: string
          priority?: Database["public"]["Enums"]["action_priority"]
          promoted_at?: string | null
          promoted_to_action_id?: string | null
          source_id?: string | null
          task?: string
          updated_at?: string
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_organisation_id_promoted_to_action_id_fkey"
            columns: ["organisation_id", "promoted_to_action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "inbox_items_organisation_id_source_id_fkey"
            columns: ["organisation_id", "source_id"]
            isOneToOne: false
            referencedRelation: "webhook_sources"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "inbox_items_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organisation_id: string
          revoked_at: string | null
          revoked_by: string | null
          source_id: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_id: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_id?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_tokens_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_tokens_organisation_id_source_id_fkey"
            columns: ["organisation_id", "source_id"]
            isOneToOne: false
            referencedRelation: "webhook_sources"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      kb_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["kb_chat_role"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organisation_id: string
          role: Database["public"]["Enums"]["kb_chat_role"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["kb_chat_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chat_messages_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string
          organisation_id: string
          role: Database["public"]["Enums"]["membership_role"]
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organisation_id_unit_id_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_units: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          organisation_id: string
          parent_unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          organisation_id: string
          parent_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          organisation_id?: string
          parent_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_units_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_units_organisation_id_parent_unit_id_fkey"
            columns: ["organisation_id", "parent_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rag_status_history: {
        Row: {
          from_status: Database["public"]["Enums"]["rag_status"] | null
          id: string
          organisation_id: string
          recorded_at: string
          recorded_by: string | null
          to_status: Database["public"]["Enums"]["rag_status"] | null
          wbs_node_id: string
        }
        Insert: {
          from_status?: Database["public"]["Enums"]["rag_status"] | null
          id?: string
          organisation_id: string
          recorded_at?: string
          recorded_by?: string | null
          to_status?: Database["public"]["Enums"]["rag_status"] | null
          wbs_node_id: string
        }
        Update: {
          from_status?: Database["public"]["Enums"]["rag_status"] | null
          id?: string
          organisation_id?: string
          recorded_at?: string
          recorded_by?: string | null
          to_status?: Database["public"]["Enums"]["rag_status"] | null
          wbs_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_status_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_status_history_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      routine_completions: {
        Row: {
          completed_date: string
          created_at: string
          id: string
          organisation_id: string
          routine_id: string
          user_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          id?: string
          organisation_id: string
          routine_id: string
          user_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          id?: string
          organisation_id?: string
          routine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_completions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_completions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string
          frequency_config: Json
          frequency_type: Database["public"]["Enums"]["routine_frequency"]
          id: string
          name: string
          organisation_id: string
          owner_user_id: string
          time_of_day: Database["public"]["Enums"]["routine_time_of_day"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string
          frequency_config?: Json
          frequency_type?: Database["public"]["Enums"]["routine_frequency"]
          id?: string
          name: string
          organisation_id: string
          owner_user_id: string
          time_of_day?: Database["public"]["Enums"]["routine_time_of_day"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string
          frequency_config?: Json
          frequency_type?: Database["public"]["Enums"]["routine_frequency"]
          id?: string
          name?: string
          organisation_id?: string
          owner_user_id?: string
          time_of_day?: Database["public"]["Enums"]["routine_time_of_day"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_items: {
        Row: {
          created_at: string
          id: string
          instruction: string
          organisation_id: string
          owner_user_id: string
          position: number
          trigger_when: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          organisation_id: string
          owner_user_id: string
          position?: number
          trigger_when: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          organisation_id?: string
          owner_user_id?: string
          position?: number
          trigger_when?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_links: {
        Row: {
          action_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          organisation_id: string
          position: number
          updated_at: string
          url: string
          waiting_item_id: string | null
          wbs_node_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          organisation_id: string
          position?: number
          updated_at?: string
          url: string
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          organisation_id?: string
          position?: number
          updated_at?: string
          url?: string
          waiting_item_id?: string | null
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_links_organisation_id_action_id_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "task_links_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_organisation_id_waiting_item_id_fkey"
            columns: ["organisation_id", "waiting_item_id"]
            isOneToOne: false
            referencedRelation: "waiting_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "task_links_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      waiting_items: {
        Row: {
          asked_on: string | null
          created_at: string
          created_by: string | null
          description: string
          due_by: string | null
          from_user_id: string | null
          from_whom_text: string | null
          id: string
          notes: string
          organisation_id: string
          status: Database["public"]["Enums"]["waiting_status"]
          updated_at: string
          wbs_node_id: string | null
        }
        Insert: {
          asked_on?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_by?: string | null
          from_user_id?: string | null
          from_whom_text?: string | null
          id?: string
          notes?: string
          organisation_id: string
          status?: Database["public"]["Enums"]["waiting_status"]
          updated_at?: string
          wbs_node_id?: string | null
        }
        Update: {
          asked_on?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_by?: string | null
          from_user_id?: string | null
          from_whom_text?: string | null
          id?: string
          notes?: string
          organisation_id?: string
          status?: Database["public"]["Enums"]["waiting_status"]
          updated_at?: string
          wbs_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_items_organisation_id_wbs_node_id_fkey"
            columns: ["organisation_id", "wbs_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      wbs_node_dependencies: {
        Row: {
          created_at: string
          dependency_type: Database["public"]["Enums"]["dependency_type"]
          id: string
          lag_days: number
          organisation_id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          id?: string
          lag_days?: number
          organisation_id: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          id?: string
          lag_days?: number
          organisation_id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wbs_node_dependencies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_node_dependencies_organisation_id_source_node_id_fkey"
            columns: ["organisation_id", "source_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "wbs_node_dependencies_organisation_id_target_node_id_fkey"
            columns: ["organisation_id", "target_node_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      wbs_nodes: {
        Row: {
          archived_at: string | null
          blockers: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          lead_user_id: string | null
          name: string
          node_type: Database["public"]["Enums"]["node_type"]
          organisation_id: string
          parent_id: string | null
          position: number
          project_status: Database["public"]["Enums"]["project_status"] | null
          rag_status: Database["public"]["Enums"]["rag_status"] | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          blockers?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          lead_user_id?: string | null
          name: string
          node_type: Database["public"]["Enums"]["node_type"]
          organisation_id: string
          parent_id?: string | null
          position?: number
          project_status?: Database["public"]["Enums"]["project_status"] | null
          rag_status?: Database["public"]["Enums"]["rag_status"] | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          blockers?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          lead_user_id?: string | null
          name?: string
          node_type?: Database["public"]["Enums"]["node_type"]
          organisation_id?: string
          parent_id?: string | null
          position?: number
          project_status?: Database["public"]["Enums"]["project_status"] | null
          rag_status?: Database["public"]["Enums"]["rag_status"] | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wbs_nodes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_nodes_organisation_id_parent_id_fkey"
            columns: ["organisation_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      webhook_sources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          last_received_at: string | null
          name: string
          organisation_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_received_at?: string | null
          name: string
          organisation_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_received_at?: string | null
          name?: string
          organisation_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_sources_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["membership_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      action_priority: "high" | "medium" | "low"
      action_status: "not_started" | "in_progress" | "complete" | "blocked"
      dependency_type: "fs" | "ff" | "ss" | "sf"
      domain_entity_kind: "action" | "waiting_item" | "wbs_node"
      inbox_event_type: "created" | "promoted" | "deleted"
      kb_chat_role: "user" | "assistant" | "system"
      membership_role: "owner" | "admin" | "member"
      node_type: "portfolio" | "programme" | "project" | "work_package"
      project_status: "active" | "on_hold" | "complete"
      rag_status: "green" | "amber" | "red"
      routine_frequency: "daily" | "weekly_days" | "weekly_count"
      routine_time_of_day: "morning" | "afternoon" | "evening" | "anytime"
      waiting_status: "pending" | "received" | "overdue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_priority: ["high", "medium", "low"],
      action_status: ["not_started", "in_progress", "complete", "blocked"],
      dependency_type: ["fs", "ff", "ss", "sf"],
      domain_entity_kind: ["action", "waiting_item", "wbs_node"],
      inbox_event_type: ["created", "promoted", "deleted"],
      kb_chat_role: ["user", "assistant", "system"],
      membership_role: ["owner", "admin", "member"],
      node_type: ["portfolio", "programme", "project", "work_package"],
      project_status: ["active", "on_hold", "complete"],
      rag_status: ["green", "amber", "red"],
      routine_frequency: ["daily", "weekly_days", "weekly_count"],
      routine_time_of_day: ["morning", "afternoon", "evening", "anytime"],
      waiting_status: ["pending", "received", "overdue"],
    },
  },
} as const
