import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAchievements, markAchievementsSeen } from "@/lib/achievements.functions";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  condition_type: string;
  condition_value: number;
  xp_reward: number;
  hidden: boolean;
};

type Unlocked = { achievement_id: string; unlocked_at: string; seen: boolean };

const CATEGORIES: Record<string, { label: string; color: string }> = {
  reps: { label: "Reps", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  streak: { label: "Streak", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  level: { label: "Level", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  battle: { label: "Battle", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  challenge: { label: "Challenge", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  social: { label: "Social", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  pr: { label: "PB", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  run: { label: "Lauf", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
};

export function BadgeGallery() {
  const fetchAchievements = useServerFn(listAchievements);
  const markSeen = useServerFn(markAchievementsSeen);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Unlocked[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAchievements()
      .then((res) => {
        if (cancelled) return;
        setAchievements(res.achievements);
        setUnlocked(res.unlocked);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchAchievements]);

  // Show toasts for newly unlocked, unseen achievements.
  useEffect(() => {
    const unseen = unlocked.filter((u) => !u.seen);
    if (unseen.length === 0) return;
    const map = new Map(unlocked.map((u) => [u.achievement_id, u]));
    for (const u of unseen) {
      const ach = achievements.find((a) => a.id === u.achievement_id);
      if (!ach) continue;
      toast.success(`${ach.icon} ${ach.title} freigeschaltet!`, {
        description: `+${ach.xp_reward} XP · ${ach.description}`,
        duration: 5000,
      });
    }
    markSeen({ data: undefined }).then(() => {
      setUnlocked((prev) => prev.map((u) => ({ ...u, seen: true })));
    });
  }, [achievements, unlocked, markSeen]);

  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.achievement_id)), [unlocked]);

  const filtered = useMemo(() => {
    if (filter === "all") return achievements;
    if (filter === "unlocked") return achievements.filter((a) => unlockedIds.has(a.id));
    return achievements.filter((a) => a.category === filter);
  }, [achievements, filter, unlockedIds]);

  const categories = useMemo(
    () => ["all", "unlocked", ...Array.from(new Set(achievements.map((a) => a.category)))],
    [achievements],
  );

  if (loading) {
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Badges</h2>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      </section>
    );
  }

  const progress = achievements.length > 0 ? Math.round((unlocked.length / achievements.length) * 100) : 0;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Badges</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {unlocked.length}/{achievements.length} ({progress}%)
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] transition ${
              filter === cat
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat === "all" ? "Alle" : cat === "unlocked" ? "Freigeschaltet" : CATEGORIES[cat]?.label ?? cat}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {filtered.map((ach) => {
          const isUnlocked = unlockedIds.has(ach.id);
          const catStyle = CATEGORIES[ach.category]?.color ?? "bg-secondary text-muted-foreground border-border";
          return (
            <div
              key={ach.id}
              title={`${ach.title}: ${ach.description}`}
              className={`group relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 text-center transition ${
                isUnlocked ? catStyle : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              <span className={`text-2xl transition ${isUnlocked ? "grayscale-0" : "grayscale opacity-40"}`}>
                {ach.icon}
              </span>
              {isUnlocked && (
                <span className="mt-1 text-[9px] font-medium leading-tight">+{ach.xp_reward}</span>
              )}
              {!isUnlocked && ach.hidden && (
                <span className="absolute inset-0 flex items-center justify-center text-lg opacity-30">?</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
