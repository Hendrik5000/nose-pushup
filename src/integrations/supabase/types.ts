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
      achievements: {
        Row: {
          category: string
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          hidden: boolean
          icon: string
          id: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          category: string
          condition_type: string
          condition_value?: number
          created_at?: string
          description: string
          hidden?: boolean
          icon?: string
          id: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          hidden?: boolean
          icon?: string
          id?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      battle_reps: {
        Row: {
          battle_id: string
          count: number
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          battle_id: string
          count?: number
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          battle_id?: string
          count?: number
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_reps_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          code: string
          created_at: string
          duration_s: number
          ends_at: string | null
          guest_count: number
          guest_id: string | null
          host_count: number
          host_id: string
          id: string
          is_bot: boolean
          started_at: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          duration_s?: number
          ends_at?: string | null
          guest_count?: number
          guest_id?: string | null
          host_count?: number
          host_id: string
          id?: string
          is_bot?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          duration_s?: number
          ends_at?: string | null
          guest_count?: number
          guest_id?: string | null
          host_count?: number
          host_id?: string
          id?: string
          is_bot?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          description: string
          exercise_id: string | null
          goal_type: string
          goal_value: number
          icon: string
          id: string
          period: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          exercise_id?: string | null
          goal_type: string
          goal_value: number
          icon?: string
          id: string
          period: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          exercise_id?: string | null
          goal_type?: string
          goal_value?: number
          icon?: string
          id?: string
          period?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      coach_advice: {
        Row: {
          advice: string
          created_at: string
          id: string
          model: string | null
          plan: Json
          user_id: string
        }
        Insert: {
          advice: string
          created_at?: string
          id?: string
          model?: string | null
          plan?: Json
          user_id: string
        }
        Update: {
          advice?: string
          created_at?: string
          id?: string
          model?: string | null
          plan?: Json
          user_id?: string
        }
        Relationships: []
      }
      daily_stats: {
        Row: {
          created_at: string
          day: string
          id: string
          sessions: number
          total_duration_ms: number
          total_reps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          sessions?: number
          total_duration_ms?: number
          total_reps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          sessions?: number
          total_duration_ms?: number
          total_reps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          detection_type: string
          icon: string
          id: string
          name: string
          sort_order: number
          unit: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          detection_type: string
          icon: string
          id: string
          name: string
          sort_order?: number
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          detection_type?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_entries: {
        Row: {
          active_kcal: number
          created_at: string
          day: string
          id: string
          sleep_min: number
          source: string
          steps: number
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          active_kcal?: number
          created_at?: string
          day: string
          id?: string
          sleep_min?: number
          source?: string
          steps?: number
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          active_kcal?: number
          created_at?: string
          day?: string
          id?: string
          sleep_min?: number
          source?: string
          steps?: number
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          battle_losses: number
          battle_wins: number
          best_count: number
          birth_year: number | null
          created_at: string
          current_streak: number
          daily_goal: number
          display_name: string | null
          haptics_enabled: boolean
          height_cm: number | null
          id: string
          last_workout_date: string | null
          level: number
          longest_streak: number
          onboarded: boolean
          personal_bests: Json
          sex: string | null
          share_activity: boolean
          sound_enabled: boolean
          streak_freeze_week: string | null
          streak_freezes: number
          theme: string
          updated_at: string
          weight_kg: number | null
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          battle_losses?: number
          battle_wins?: number
          best_count?: number
          birth_year?: number | null
          created_at?: string
          current_streak?: number
          daily_goal?: number
          display_name?: string | null
          haptics_enabled?: boolean
          height_cm?: number | null
          id: string
          last_workout_date?: string | null
          level?: number
          longest_streak?: number
          onboarded?: boolean
          personal_bests?: Json
          sex?: string | null
          share_activity?: boolean
          sound_enabled?: boolean
          streak_freeze_week?: string | null
          streak_freezes?: number
          theme?: string
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          battle_losses?: number
          battle_wins?: number
          best_count?: number
          birth_year?: number | null
          created_at?: string
          current_streak?: number
          daily_goal?: number
          display_name?: string | null
          haptics_enabled?: boolean
          height_cm?: number | null
          id?: string
          last_workout_date?: string | null
          level?: number
          longest_streak?: number
          onboarded?: boolean
          personal_bests?: Json
          sex?: string | null
          share_activity?: boolean
          sound_enabled?: boolean
          streak_freeze_week?: string | null
          streak_freezes?: number
          theme?: string
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      runs: {
        Row: {
          calories: number
          created_at: string
          distance_m: number
          duration_ms: number
          id: string
          note: string | null
          path: Json
          user_id: string
        }
        Insert: {
          calories?: number
          created_at?: string
          distance_m?: number
          duration_ms?: number
          id?: string
          note?: string | null
          path?: Json
          user_id: string
        }
        Update: {
          calories?: number
          created_at?: string
          distance_m?: number
          duration_ms?: number
          id?: string
          note?: string | null
          path?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          seen: boolean
          unlocked_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          seen?: boolean
          unlocked_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          seen?: boolean
          unlocked_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          id: string
          period_start: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          period_start: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          period_start?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          count: number
          created_at: string
          duration_ms: number
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          count: number
          created_at?: string
          duration_ms?: number
          exercise_id?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          duration_ms?: number
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          battle_losses: number | null
          battle_wins: number | null
          best_count: number | null
          current_streak: number | null
          display_name: string | null
          id: string | null
          level: number | null
          longest_streak: number | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          battle_losses?: number | null
          battle_wins?: number | null
          best_count?: number | null
          current_streak?: number | null
          display_name?: string | null
          id?: string | null
          level?: number | null
          longest_streak?: number | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          battle_losses?: number | null
          battle_wins?: number | null
          best_count?: number | null
          current_streak?: number | null
          display_name?: string | null
          id?: string | null
          level?: number | null
          longest_streak?: number | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_level: { Args: { _xp: number }; Returns: number }
      challenge_period_start: {
        Args: { _day: string; _period: string }
        Returns: string
      }
      check_achievements: {
        Args: { _user_id: string }
        Returns: {
          _achievement_id: string
          _xp_reward: number
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
