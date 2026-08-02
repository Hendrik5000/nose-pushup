import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const backfillAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("check_achievements", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { unlocked: (data ?? []) as Array<{ achievement_id: string; xp_reward: number }> };
  });

export const listAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: all }, { data: unlocked }] = await Promise.all([
      supabase.from("achievements").select("*").order("sort_order", { ascending: true }),
      supabase.from("user_achievements").select("achievement_id, unlocked_at, seen").eq("user_id", userId),
    ]);
    return {
      achievements: (all ?? []) as Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        category: string;
        condition_type: string;
        condition_value: number;
        xp_reward: number;
        hidden: boolean;
      }>,
      unlocked: (unlocked ?? []) as Array<{ achievement_id: string; unlocked_at: string; seen: boolean }>,
    };
  });

export const markAchievementsSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_achievements")
      .update({ seen: true })
      .eq("user_id", userId)
      .eq("seen", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
