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
      battle_queue: {
        Row: {
          battle_id: string | null
          created_at: string
          duration_s: number
          mode: string
          user_id: string
        }
        Insert: {
          battle_id?: string | null
          created_at?: string
          duration_s?: number
          mode?: string
          user_id: string
        }
        Update: {
          battle_id?: string | null
          created_at?: string
          duration_s?: number
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_queue_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
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
          mode: string
          rematch_of: string | null
          started_at: string | null
          status: string
          target_reps: number
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
          mode?: string
          rematch_of?: string | null
          started_at?: string | null
          status?: string
          target_reps?: number
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
          mode?: string
          rematch_of?: string | null
          started_at?: string | null
          status?: string
          target_reps?: number
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          id: number
          payload: Json
          sender_id: string
          type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: never
          payload: Json
          sender_id: string
          type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: never
          payload?: Json
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          callee_id: string
          caller_id: string
          conversation_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          callee_id: string
          caller_id: string
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          callee_id?: string
          caller_id?: string
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_posts: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          motto: string
          name: string
          owner_id: string
          updated_at: string
          weekly_goal: number
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          motto?: string
          name: string
          owner_id: string
          updated_at?: string
          weekly_goal?: number
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          motto?: string
          name?: string
          owner_id?: string
          updated_at?: string
          weekly_goal?: number
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
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string
          name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          name?: string | null
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
      friend_battle_invitations: {
        Row: {
          battle_id: string | null
          created_at: string
          duration_s: number
          expires_at: string
          id: string
          mode: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
          target_reps: number
        }
        Insert: {
          battle_id?: string | null
          created_at?: string
          duration_s: number
          expires_at?: string
          id?: string
          mode: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
          target_reps: number
        }
        Update: {
          battle_id?: string | null
          created_at?: string
          duration_s?: number
          expires_at?: string
          id?: string
          mode?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
          target_reps?: number
        }
        Relationships: [
          {
            foreignKeyName: "friend_battle_invitations_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_code_attempts: {
        Row: {
          attempted_at: string
          id: number
          succeeded: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          succeeded: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          succeeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      friend_codes: {
        Row: {
          code: string
          created_at: string
          rotated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          rotated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          rotated_at?: string | null
          user_id?: string
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
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          conversation_id: string | null
          last_read_at: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          last_read_at?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          last_read_at?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          link_preview: Json | null
          pinned_at: string | null
          reply_to_id: string | null
          room_id: string | null
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          link_preview?: Json | null
          pinned_at?: string | null
          reply_to_id?: string | null
          room_id?: string | null
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          link_preview?: Json | null
          pinned_at?: string | null
          reply_to_id?: string | null
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          read_at: string | null
          room_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          room_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          room_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          created_at: string
          day: string
          exercise_id: string | null
          focus: string
          id: string
          note: string
          plan_id: string
          reps: number
          rest_s: number
          sets: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          exercise_id?: string | null
          focus: string
          id?: string
          note?: string
          plan_id: string
          reps?: number
          rest_s?: number
          sets?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          exercise_id?: string | null
          focus?: string
          id?: string
          note?: string
          plan_id?: string
          reps?: number
          rest_s?: number
          sets?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      postfach_items: {
        Row: {
          created_at: string
          from_user_id: string | null
          id: string
          kind: string
          payload: Json
          read_at: string | null
          ref_id: string | null
          resolution: string | null
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          ref_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          ref_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          battle_losses: number
          battle_rating: number
          battle_wins: number
          best_count: number
          birth_year: number | null
          bubble_color: string | null
          coins: number
          created_at: string
          current_streak: number
          daily_goal: number
          display_name: string | null
          haptics_enabled: boolean
          height_cm: number | null
          id: string
          invited_by: string | null
          last_seen_at: string | null
          last_workout_date: string | null
          level: number
          longest_streak: number
          onboarded: boolean
          personal_bests: Json
          public_enabled: boolean
          public_slug: string | null
          sex: string | null
          share_activity: boolean
          sound_enabled: boolean
          status_text: string | null
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
          battle_rating?: number
          battle_wins?: number
          best_count?: number
          birth_year?: number | null
          bubble_color?: string | null
          coins?: number
          created_at?: string
          current_streak?: number
          daily_goal?: number
          display_name?: string | null
          haptics_enabled?: boolean
          height_cm?: number | null
          id: string
          invited_by?: string | null
          last_seen_at?: string | null
          last_workout_date?: string | null
          level?: number
          longest_streak?: number
          onboarded?: boolean
          personal_bests?: Json
          public_enabled?: boolean
          public_slug?: string | null
          sex?: string | null
          share_activity?: boolean
          sound_enabled?: boolean
          status_text?: string | null
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
          battle_rating?: number
          battle_wins?: number
          best_count?: number
          birth_year?: number | null
          bubble_color?: string | null
          coins?: number
          created_at?: string
          current_streak?: number
          daily_goal?: number
          display_name?: string | null
          haptics_enabled?: boolean
          height_cm?: number | null
          id?: string
          invited_by?: string | null
          last_seen_at?: string | null
          last_workout_date?: string | null
          level?: number
          longest_streak?: number
          onboarded?: boolean
          personal_bests?: Json
          public_enabled?: boolean
          public_slug?: string | null
          sex?: string | null
          share_activity?: boolean
          sound_enabled?: boolean
          status_text?: string | null
          streak_freeze_week?: string | null
          streak_freezes?: number
          theme?: string
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      program_days: {
        Row: {
          created_at: string
          day_index: number
          exercise_id: string | null
          focus: string
          id: string
          note: string
          program_id: string
          reps: number
          rest_s: number
          sets: number
        }
        Insert: {
          created_at?: string
          day_index: number
          exercise_id?: string | null
          focus: string
          id?: string
          note?: string
          program_id: string
          reps?: number
          rest_s?: number
          sets?: number
        }
        Update: {
          created_at?: string
          day_index?: number
          exercise_id?: string | null
          focus?: string
          id?: string
          note?: string
          program_id?: string
          reps?: number
          rest_s?: number
          sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_days_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          level: string
          sort_order: number
          title: string
          weeks: number
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id: string
          level?: string
          sort_order?: number
          title: string
          weeks?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          level?: string
          sort_order?: number
          title?: string
          weeks?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_bonuses: {
        Row: {
          coins: number
          created_at: string
          id: string
          invited_id: string
          referrer_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          id?: string
          invited_id: string
          referrer_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          invited_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      room_mutes: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_mutes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_mutes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
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
      season_scores: {
        Row: {
          created_at: string
          id: string
          league: string
          points: number
          season_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league?: string
          points?: number
          season_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league?: string
          points?: number
          season_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          active: boolean
          created_at: string
          ends_on: string
          id: string
          name: string
          starts_on: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_on: string
          id?: string
          name: string
          starts_on: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          cost: number
          created_at: string
          description: string
          icon: string
          id: string
          kind: string
          name: string
          payload: Json
          sort_order: number
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string
          icon?: string
          id: string
          kind: string
          name: string
          payload?: Json
          sort_order?: number
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          payload?: Json
          sort_order?: number
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          id: string
          model: string | null
          summary: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          summary?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
          week_start?: string
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
      user_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_days: {
        Row: {
          completed_at: string
          created_at: string
          day_index: number
          id: string
          reps_done: number
          user_id: string
          user_program_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          day_index: number
          id?: string
          reps_done?: number
          user_id: string
          user_program_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          day_index?: number
          id?: string
          reps_done?: number
          user_id?: string
          user_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_days_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_day: number
          id: string
          program_id: string
          started_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_day?: number
          id?: string
          program_id: string
          started_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_day?: number
          id?: string
          program_id?: string
          started_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          clean_reps: number | null
          count: number
          created_at: string
          duration_ms: number
          exercise_id: string
          form_score: number | null
          id: string
          rpe: number | null
          user_id: string
        }
        Insert: {
          clean_reps?: number | null
          count: number
          created_at?: string
          duration_ms?: number
          exercise_id?: string
          form_score?: number | null
          id?: string
          rpe?: number | null
          user_id: string
        }
        Update: {
          clean_reps?: number | null
          count?: number
          created_at?: string
          duration_ms?: number
          exercise_id?: string
          form_score?: number | null
          id?: string
          rpe?: number | null
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
          battle_rating: number | null
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
          battle_rating?: number | null
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
          battle_rating?: number | null
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
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      calc_level: { Args: { _xp: number }; Returns: number }
      calls_expire_stale: { Args: { p_user: string }; Returns: undefined }
      can_post_in_conversation: { Args: { p_conv: string }; Returns: boolean }
      can_read_chat_upload: { Args: { p_name: string }; Returns: boolean }
      can_write_chat_upload: { Args: { p_name: string }; Returns: boolean }
      cancel_my_friend_battle_invitation: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
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
      claim_queue_match: {
        Args: { _duration_s: number; _mode: string; _user_id: string }
        Returns: string
      }
      club_league: {
        Args: never
        Returns: {
          club_id: string
          color: string
          members: number
          name: string
          week_reps: number
          weekly_goal: number
        }[]
      }
      club_week_stats: {
        Args: { _club_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          level: number
          reps: number
          user_id: string
        }[]
      }
      create_friend_battle_invitation: {
        Args: {
          p_duration_s: number
          p_mode: string
          p_recipient_id: string
          p_target_reps: number
        }
        Returns: string
      }
      create_group: {
        Args: { p_members: string[]; p_name: string }
        Returns: string
      }
      end_call: {
        Args: { p_call_id: string; p_failed?: boolean }
        Returns: string
      }
      generate_friend_code: { Args: never; Returns: string }
      get_chat_display_names: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_friend_public_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_my_dms: {
        Args: never
        Returns: {
          conversation_id: string
          is_friend: boolean
          last_message_at: string
          other_avatar_url: string
          other_id: string
          other_name: string
        }[]
      }
      get_my_friend_code: { Args: never; Returns: string }
      get_my_incoming_calls: {
        Args: never
        Returns: {
          call_id: string
          caller_avatar_url: string
          caller_id: string
          caller_name: string
          conversation_id: string
          created_at: string
          kind: string
        }[]
      }
      get_my_pending_battle_invitations: {
        Args: never
        Returns: {
          created_at: string
          duration_s: number
          expires_at: string
          invitation_id: string
          mode: string
          sender_avatar_url: string
          sender_display_name: string
          sender_id: string
          target_reps: number
        }[]
      }
      get_my_sent_friend_battle_invitations: {
        Args: never
        Returns: {
          battle_id: string
          created_at: string
          expires_at: string
          invitation_id: string
          mode: string
          recipient_id: string
          responded_at: string
          status: string
        }[]
      }
      get_my_sent_friend_requests: {
        Args: never
        Returns: {
          created_at: string
          friendship_id: string
          to_avatar_url: string
          to_name: string
          to_user_id: string
        }[]
      }
      get_or_create_dm: { Args: { p_other: string }; Returns: string }
      grant_referral_bonus: {
        Args: { _invited_id: string }
        Returns: undefined
      }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conv: string; p_user: string }
        Returns: boolean
      }
      is_registered_user: { Args: never; Returns: boolean }
      join_club_by_code: { Args: { _code: string }; Returns: string }
      postfach_install_battle_bridge: { Args: never; Returns: string }
      postfach_push: {
        Args: {
          p_from: string
          p_kind: string
          p_payload: Json
          p_ref: string
          p_user: string
        }
        Returns: undefined
      }
      postfach_resolve: {
        Args: {
          p_kind: string
          p_ref: string
          p_resolution: string
          p_user: string
        }
        Returns: undefined
      }
      public_profile: {
        Args: { _slug: string }
        Returns: {
          avatar_url: string
          battle_wins: number
          best_count: number
          current_streak: number
          display_name: string
          level: number
          longest_streak: number
          xp: number
        }[]
      }
      purchase_shop_item: { Args: { _item_id: string }; Returns: Json }
      regenerate_my_friend_code: { Args: never; Returns: string }
      respond_to_call: {
        Args: { p_accept: boolean; p_call_id: string }
        Returns: string
      }
      respond_to_friend_battle_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: {
          battle_id: string
          result: string
        }[]
      }
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string }
        Returns: string
      }
      search_messages: {
        Args: { q: string }
        Returns: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          link_preview: Json | null
          pinned_at: string | null
          reply_to_id: string | null
          room_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_call_signal: {
        Args: { p_call_id: string; p_payload: Json; p_type: string }
        Returns: boolean
      }
      send_friend_request_by_code: { Args: { p_code: string }; Returns: Json }
      start_call: {
        Args: { p_callee: string; p_conversation?: string; p_kind: string }
        Returns: Json
      }
      withdraw_friend_request: {
        Args: { p_friendship_id: string }
        Returns: boolean
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
