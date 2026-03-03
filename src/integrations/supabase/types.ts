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
      actions: {
        Row: {
          created_at: string
          due_date: string
          id: string
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
          created_at?: string
          due_date?: string
          id?: string
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
          created_at?: string
          due_date?: string
          id?: string
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
      inbox_items: {
        Row: {
          created_at: string
          due_date: string
          id: string
          notes: string
          priority: string
          project: string
          source: string
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
          task?: string
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
      waiting_items: {
        Row: {
          asked_on: string
          created_at: string
          description: string
          due_by: string
          from_whom: string
          id: string
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
          notes?: string
          project_wp?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
      [_ in never]: never
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
