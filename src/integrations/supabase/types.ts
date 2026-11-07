export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Dipulihkan manual dari file migrasi + pemakaian di kode. Lovable akan membuat ulang file ini otomatis dari database.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          current_level: number | null
          test_notes: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          current_level?: number | null
          test_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          current_level?: number | null
          test_notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      subjects: {
        Row: {
          id: string
          slug: string
          name: string
          bio: string
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          bio?: string
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          bio?: string
          sort_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          slug: string
          name: string
          tagline: string
          description: string
          goals: string
          advantages: string
          levels_label: string
          level_number: number
          level_label: string
          schedule: string
          quota: number
          price: number
          price_normal: number
          price_promo: number
          price_per_session: number
          price_per_session_normal: number
          price_per_session_promo: number
          price_prefix: string
          package_type: string
          package_weeks: number
          package_sessions: number
          allowed_packages: string[]
          available_sessions: number[]
          available_months: number[]
          package_prices: Json
          default_session_count: number
          target_gender: string
          teacher_id: string | null
          subject_id: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          tagline?: string
          description?: string
          goals?: string
          advantages?: string
          levels_label?: string
          level_number?: number
          level_label?: string
          schedule?: string
          quota?: number
          price?: number
          price_normal?: number
          price_promo?: number
          price_per_session?: number
          price_per_session_normal?: number
          price_per_session_promo?: number
          price_prefix?: string
          package_type?: string
          package_weeks?: number
          package_sessions?: number
          allowed_packages?: string[]
          available_sessions?: number[]
          available_months?: number[]
          package_prices?: Json
          default_session_count?: number
          target_gender?: string
          teacher_id?: string | null
          subject_id?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          tagline?: string
          description?: string
          goals?: string
          advantages?: string
          levels_label?: string
          level_number?: number
          level_label?: string
          schedule?: string
          quota?: number
          price?: number
          price_normal?: number
          price_promo?: number
          price_per_session?: number
          price_per_session_normal?: number
          price_per_session_promo?: number
          price_prefix?: string
          package_type?: string
          package_weeks?: number
          package_sessions?: number
          allowed_packages?: string[]
          available_sessions?: number[]
          available_months?: number[]
          package_prices?: Json
          default_session_count?: number
          target_gender?: string
          teacher_id?: string | null
          subject_id?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "classes_subject_id_fkey"; columns: ["subject_id"]; isOneToOne: false; referencedRelation: "subjects"; referencedColumns: ["id"] }
        ]
      }
      class_private: {
        Row: {
          class_id: string
          whatsapp_link: string
          zoom_link: string
        }
        Insert: {
          class_id: string
          whatsapp_link?: string
          zoom_link?: string
        }
        Update: {
          class_id?: string
          whatsapp_link?: string
          zoom_link?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          id: string
          class_id: string
          level: number
          number: number
          title: string
          description: string
          scheduled_at: string
          is_published: boolean
        }
        Insert: {
          id?: string
          class_id: string
          level?: number
          number: number
          title: string
          description?: string
          scheduled_at?: string
          is_published?: boolean
        }
        Update: {
          id?: string
          class_id?: string
          level?: number
          number?: number
          title?: string
          description?: string
          scheduled_at?: string
          is_published?: boolean
        }
        Relationships: [
          { foreignKeyName: "class_sessions_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"] }
        ]
      }
      session_recordings: {
        Row: {
          session_id: string
          class_id: string
          video_url: string
          created_at: string
        }
        Insert: {
          session_id: string
          class_id: string
          video_url: string
          created_at?: string
        }
        Update: {
          session_id?: string
          class_id?: string
          video_url?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "session_recordings_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"] }
        ]
      }
      session_private: {
        Row: {
          session_id: string
          class_id: string
          zoom_link: string
          material_path: string
          material_name: string
        }
        Insert: {
          session_id: string
          class_id: string
          zoom_link?: string
          material_path?: string
          material_name?: string
        }
        Update: {
          session_id?: string
          class_id?: string
          zoom_link?: string
          material_path?: string
          material_name?: string
        }
        Relationships: []
      }
      session_submissions: {
        Row: {
          session_id: string
          user_id: string
          class_id: string
          file_path: string
          file_name: string
          created_at: string
        }
        Insert: {
          session_id: string
          user_id: string
          class_id: string
          file_path: string
          file_name: string
          created_at?: string
        }
        Update: {
          session_id?: string
          user_id?: string
          class_id?: string
          file_path?: string
          file_name?: string
          created_at?: string
        }
        Relationships: []
      }
      session_results: {
        Row: {
          session_id: string
          user_id: string
          class_id: string
          grade: number | null
          feedback: string
        }
        Insert: {
          session_id: string
          user_id: string
          class_id: string
          grade?: number | null
          feedback?: string
        }
        Update: {
          session_id?: string
          user_id?: string
          class_id?: string
          grade?: number | null
          feedback?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body?: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value?: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          id: string
          code: string
          discount_type: string
          discount_value: number
          max_uses: number | null
          used_count: number
          is_active: boolean
          expires_at: string | null
          package_target: string
          target_counts: number[]
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_type?: string
          discount_value?: number
          max_uses?: number | null
          used_count?: number
          is_active?: boolean
          expires_at?: string | null
          package_target?: string
          target_counts?: number[]
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          discount_type?: string
          discount_value?: number
          max_uses?: number | null
          used_count?: number
          is_active?: boolean
          expires_at?: string | null
          package_target?: string
          target_counts?: number[]
          created_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          class_id: string
          status: Database["public"]["Enums"]["payment_status"]
          amount: number
          method: string
          sender_name: string | null
          note: string | null
          proof_url: string | null
          paid_at: string | null
          starts_at: string | null
          package_type: string
          package_weeks: number
          package_months: number
          sessions_total: number | null
          sessions_used: number | null
          voucher_code: string | null
          referral_code: string | null
          referrer_id: string | null
          referral_reward_amount: number
          use_referral_reward: boolean
          reward_used: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          class_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          amount: number
          method?: string
          sender_name?: string | null
          note?: string | null
          proof_url?: string | null
          paid_at?: string | null
          starts_at?: string | null
          package_type?: string
          package_weeks?: number
          package_months?: number
          sessions_total?: number | null
          sessions_used?: number | null
          voucher_code?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          referral_reward_amount?: number
          use_referral_reward?: boolean
          reward_used?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          class_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          amount?: number
          method?: string
          sender_name?: string | null
          note?: string | null
          proof_url?: string | null
          paid_at?: string | null
          starts_at?: string | null
          package_type?: string
          package_weeks?: number
          package_months?: number
          sessions_total?: number | null
          sessions_used?: number | null
          voucher_code?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          referral_reward_amount?: number
          use_referral_reward?: boolean
          reward_used?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "enrollments_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"] }
        ]
      }
      referral_settings: {
        Row: {
          id: true
          enabled: boolean
          discount_type: string
          discount_value: number
          reward_enabled: boolean
          reward_amount: number
        }
        Insert: {
          id?: true
          enabled?: boolean
          discount_type?: string
          discount_value?: number
          reward_enabled?: boolean
          reward_amount?: number
        }
        Update: {
          id?: true
          enabled?: boolean
          discount_type?: string
          discount_value?: number
          reward_enabled?: boolean
          reward_amount?: number
        }
        Relationships: []
      }
      referral_accounts: {
        Row: {
          user_id: string
          code: string
        }
        Insert: {
          user_id: string
          code?: string
        }
        Update: {
          user_id?: string
          code?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          source_enrollment_id: string
          user_id: string
          amount: number
          created_at: string
        }
        Insert: {
          source_enrollment_id: string
          user_id: string
          amount: number
          created_at?: string
        }
        Update: {
          source_enrollment_id?: string
          user_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: { Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }; Returns: boolean }
      has_paid: { Args: { _user_id: string; _class_id: string }; Returns: boolean }
      is_teacher: { Args: { _class_id?: string }; Returns: boolean }
      validate_voucher: { Args: { _code: string; _price: number }; Returns: { final_amount: number; discount: number; voucher_code: string }[] }
      validate_discount: { Args: { _code: string; _class_id: string; _use_reward?: boolean }; Returns: { final_amount: number; discount: number; code: string | null; kind: string | null; referrer_id: string | null; reward_amount: number; reward_used: number }[] }
      voucher_scope_ok: { Args: { _code: string; _package: string; _count: number }; Returns: boolean }
      referral_balance: { Args: { _user_id: string }; Returns: number }
      public_teachers: { Args: Record<PropertyKey, never>; Returns: { id: string; name: string; photo_path: string }[] }
      submit_proof: { Args: { _enrollment_id: string; _proof_url: string }; Returns: undefined }
      class_session_count: { Args: { _class_id: string }; Returns: number }
      sessions_bought: { Args: { _user_id: string; _class_id: string }; Returns: number }
      session_allowed: { Args: { _user_id: string; _session_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "student"
      payment_status: "pending" | "paid" | "rejected"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
