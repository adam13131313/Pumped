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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_status_log: {
        Row: {
          action_id: string
          changed_at: string
          from_status: string | null
          id: string
          to_status: string
          user_id: string
        }
        Insert: {
          action_id: string
          changed_at?: string
          from_status?: string | null
          id?: string
          to_status: string
          user_id: string
        }
        Update: {
          action_id?: string
          changed_at?: string
          from_status?: string | null
          id?: string
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_status_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          archived: boolean
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          labels: string[]
          not_started_since: string | null
          notes: string
          priority: string
          project: string
          start_date: string
          status: string
          task: string
          user_id: string
          work_package: string
        }
        Insert: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          labels?: string[]
          not_started_since?: string | null
          notes?: string
          priority?: string
          project?: string
          start_date?: string
          status?: string
          task?: string
          user_id: string
          work_package?: string
        }
        Update: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          labels?: string[]
          not_started_since?: string | null
          notes?: string
          priority?: string
          project?: string
          start_date?: string
          status?: string
          task?: string
          user_id?: string
          work_package?: string
        }
        Relationships: []
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
          github_issue_number: number | null
          github_issue_url: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gathered_state: {
        Row: {
          durations: Json
          ids: Json
          order_ids: Json
          schedule: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          durations?: Json
          ids?: Json
          order_ids?: Json
          schedule?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          durations?: Json
          ids?: Json
          order_ids?: Json
          schedule?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_score_history: {
        Row: {
          created_at: string
          id: string
          inbox_lag_component: number
          on_time_component: number
          overdue_waiting_component: number
          rag_component: number
          recorded_week: string
          routine_component: number
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inbox_lag_component?: number
          on_time_component?: number
          overdue_waiting_component?: number
          rag_component?: number
          recorded_week: string
          routine_component?: number
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inbox_lag_component?: number
          on_time_component?: number
          overdue_waiting_component?: number
          rag_component?: number
          recorded_week?: string
          routine_component?: number
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      inbox_item_events: {
        Row: {
          created_at_snapshot: string | null
          event: string
          event_at: string
          id: string
          inbox_item_id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at_snapshot?: string | null
          event: string
          event_at?: string
          id?: string
          inbox_item_id: string
          source?: string
          user_id: string
        }
        Update: {
          created_at_snapshot?: string | null
          event?: string
          event_at?: string
          id?: string
          inbox_item_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          created_at: string
          due_date: string
          id: string
          notes: string
          priority: string
          project: string
          source: string
          source_id: string
          source_url: string
          task: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string
          id?: string
          notes?: string
          priority?: string
          project?: string
          source?: string
          source_id?: string
          source_url?: string
          task?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          notes?: string
          priority?: string
          project?: string
          source?: string
          source_id?: string
          source_url?: string
          task?: string
          user_id?: string
        }
        Relationships: []
      }
      ingest_sources: {
        Row: {
          created_at: string
          id: string
          last_received_at: string | null
          name: string
          slug: string
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_received_at?: string | null
          name: string
          slug: string
          token_hash: string
          token_prefix?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_received_at?: string | null
          name?: string
          slug?: string
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      kb_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          programme_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          programme_id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          programme_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      rag_status_history: {
        Row: {
          id: string
          rag_status: string
          recorded_at: string
          user_id: string
          work_package_id: string
        }
        Insert: {
          id?: string
          rag_status: string
          recorded_at?: string
          user_id: string
          work_package_id: string
        }
        Update: {
          id?: string
          rag_status?: string
          recorded_at?: string
          user_id?: string
          work_package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_status_history_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_completions: {
        Row: {
          completed_at: string
          completed_date: string
          id: string
          routine_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completed_date: string
          id?: string
          routine_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completed_date?: string
          id?: string
          routine_id?: string
          user_id?: string
        }
        Relationships: [
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
          frequency_config: Json
          frequency_type: string
          id: string
          name: string
          time_of_day: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          frequency_config?: Json
          frequency_type?: string
          id?: string
          name: string
          time_of_day?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          frequency_config?: Json
          frequency_type?: string
          id?: string
          name?: string
          time_of_day?: string
          user_id?: string
        }
        Relationships: []
      }
      sop_items: {
        Row: {
          created_at: string
          id: string
          instruction: string
          trigger_when: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction?: string
          trigger_when?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          trigger_when?: string
          user_id?: string
        }
        Relationships: []
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
      task_attachments: {
        Row: {
          action_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          item_type: string
          user_id: string
          waiting_item_id: string | null
          work_package_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          item_type?: string
          user_id: string
          waiting_item_id?: string | null
          work_package_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          item_type?: string
          user_id?: string
          waiting_item_id?: string | null
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_waiting_item_id_fkey"
            columns: ["waiting_item_id"]
            isOneToOne: false
            referencedRelation: "waiting_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          item_id: string
          item_type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      waiting_items: {
        Row: {
          asked_on: string
          created_at: string
          description: string
          due_by: string
          from_whom: string
          id: string
          linked_project_id: string | null
          notes: string
          project_wp: string
          status: string
          user_id: string
        }
        Insert: {
          asked_on?: string
          created_at?: string
          description?: string
          due_by?: string
          from_whom?: string
          id?: string
          linked_project_id?: string | null
          notes?: string
          project_wp?: string
          status?: string
          user_id: string
        }
        Update: {
          asked_on?: string
          created_at?: string
          description?: string
          due_by?: string
          from_whom?: string
          id?: string
          linked_project_id?: string | null
          notes?: string
          project_wp?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_items_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_packages: {
        Row: {
          blockers: string
          created_at: string
          dependencies: Json
          due_date: string
          id: string
          project: string
          rag_status: string
          start_date: string
          user_id: string
          work_package: string
          wp_lead: string
        }
        Insert: {
          blockers?: string
          created_at?: string
          dependencies?: Json
          due_date?: string
          id?: string
          project?: string
          rag_status?: string
          start_date?: string
          user_id: string
          work_package?: string
          wp_lead?: string
        }
        Update: {
          blockers?: string
          created_at?: string
          dependencies?: Json
          due_date?: string
          id?: string
          project?: string
          rag_status?: string
          start_date?: string
          user_id?: string
          work_package?: string
          wp_lead?: string
        }
        Relationships: []
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
