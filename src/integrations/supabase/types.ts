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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          email: string
          label: string
          phone: string | null
        }
        Insert: {
          email: string
          label: string
          phone?: string | null
        }
        Update: {
          email?: string
          label?: string
          phone?: string | null
        }
        Relationships: []
      }
      admin_verified_sessions: {
        Row: {
          expires_at: string
          issued_at: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          expires_at: string
          issued_at?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          expires_at?: string
          issued_at?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_services: {
        Row: {
          booking_id: string
          duration_min: number
          name: string
          price_npr: number | null
          service_id: number
        }
        Insert: {
          booking_id: string
          duration_min: number
          name: string
          price_npr?: number | null
          service_id: number
        }
        Update: {
          booking_id?: string
          duration_min?: number
          name?: string
          price_npr?: number | null
          service_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_note: string | null
          blocks_time: boolean
          created_at: string
          custom_service: string | null
          customer_id: string
          ends_at: string
          id: string
          session_id: string
          starts_at: string
          status: string
          ticket_id: string
          total_price_npr: number | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          blocks_time?: boolean
          created_at?: string
          custom_service?: string | null
          customer_id: string
          ends_at: string
          id?: string
          session_id: string
          starts_at: string
          status?: string
          ticket_id: string
          total_price_npr?: number | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          blocks_time?: boolean
          created_at?: string
          custom_service?: string | null
          customer_id?: string
          ends_at?: string
          id?: string
          session_id?: string
          starts_at?: string
          status?: string
          ticket_id?: string
          total_price_npr?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_message_at: string
          session_id: string
          unread_admin: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string
          session_id: string
          unread_admin?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string
          session_id?: string
          unread_admin?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          channel_key: string
          created_at: string
          customer_id: string
          display_name: string | null
          id: string
          last_seen: string
          revoked: boolean
          token_hash: string
        }
        Insert: {
          channel_key?: string
          created_at?: string
          customer_id: string
          display_name?: string | null
          id?: string
          last_seen?: string
          revoked?: boolean
          token_hash: string
        }
        Update: {
          channel_key?: string
          created_at?: string
          customer_id?: string
          display_name?: string | null
          id?: string
          last_seen?: string
          revoked?: boolean
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          last_booking_at: string | null
          name: string
          phone: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_booking_at?: string | null
          name: string
          phone: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_booking_at?: string | null
          name?: string
          phone?: string
          visit_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: number
          sender: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: never
          sender: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: never
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          bookable: boolean
          duration_min: number
          id: number
          name: string
          price_npr: number | null
          sort: number
        }
        Insert: {
          bookable?: boolean
          duration_min: number
          id: number
          name: string
          price_npr?: number | null
          sort?: number
        }
        Update: {
          bookable?: boolean
          duration_min?: number
          id?: number
          name?: string
          price_npr?: number | null
          sort?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      kc_admin_check: {
        Args: { p_email: string; p_phone: string }
        Returns: boolean
      }
      kc_admin_delete_ticket: { Args: { p_id: string }; Returns: Json }
      kc_busy: { Args: { p_day: string }; Returns: Json }
      kc_cancel: { Args: { p_hash: string; p_ticket: string }; Returns: Json }
      kc_check_time: {
        Args: { p_end: string; p_start: string }
        Returns: undefined
      }
      kc_create_booking: {
        Args: {
          p_hash: string
          p_name: string
          p_new_hash: string
          p_phone: string
          p_services: number[]
          p_start: string
        }
        Returns: Json
      }
      kc_create_booking_details: {
        Args: {
          p_custom: string
          p_hash: string
          p_name: string
          p_new_hash: string
          p_phone: string
          p_services: number[]
          p_start: string
        }
        Returns: Json
      }
      kc_custom_detail: {
        Args: { p_custom: string; p_services: number[] }
        Returns: string
      }
      kc_ensure_session: {
        Args: {
          p_hash: string
          p_name: string
          p_new_hash: string
          p_phone: string
        }
        Returns: {
          channel_key: string
          created_at: string
          customer_id: string
          display_name: string | null
          id: string
          last_seen: string
          revoked: boolean
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kc_me: { Args: { p_hash: string }; Returns: Json }
      kc_messages: { Args: { p_after: number; p_hash: string }; Returns: Json }
      kc_new_ticket: { Args: never; Returns: string }
      kc_norm_phone: { Args: { p: string }; Returns: string }
      kc_ping: {
        Args: { p_kind: string; p_session: string }
        Returns: undefined
      }
      kc_price_and_end: {
        Args: { p_services: number[]; p_start: string }
        Returns: Record<string, unknown>
      }
      kc_send: {
        Args: {
          p_body: string
          p_hash: string
          p_name: string
          p_new_hash: string
          p_phone: string
        }
        Returns: Json
      }
      kc_session_of: {
        Args: { p_hash: string }
        Returns: {
          channel_key: string
          created_at: string
          customer_id: string
          display_name: string | null
          id: string
          last_seen: string
          revoked: boolean
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kc_update_service_details: {
        Args: {
          p_custom: string
          p_hash: string
          p_services: number[]
          p_ticket: string
        }
        Returns: Json
      }
      kc_update_services: {
        Args: { p_hash: string; p_services: number[]; p_ticket: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
