import { getFatigueAdvice, getFatigueLevel, type FatigueLevel } from "@/lib/calisthenics";

type Props = {
  workoutsLast7Days: number;
  avgSoreness: number;
};

const TRAFFIC_COLORS: Record<FatigueLevel, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

const STRESS_PARTS = [
  { key: "wrist" as const, label: "Handgelenke", icon: "🤚" },
  { key: "shoulder" as const, label: "Schultern", icon: "💪" },
  { key: "elbow" as const, label: "Ellbogen", icon: "🦾" },
  { key: "core" as const, label: "Core / Hüfte", icon: "🫀" },
];

export function CaliLoadManager({ workoutsLast7Days, avgSoreness }: Props) {
  const level = getFatigueLevel(workoutsLast7Days, avgSoreness);
  const advice = getFatigueAdvice(level);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="text-sm font-semibold">Belastungssteuerung</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${TRAFFIC_COLORS[level]}`} />
          <span className={`text-xs font-semibold ${advice.color}`}>{advice.title}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{advice.message}</p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <StatPill label="Sessions (7 Tage)" value={String(workoutsLast7Days)} />
        <StatPill label="Ø Gelenk-Score" value={avgSoreness > 0 ? avgSoreness.toFixed(1) : "—"} />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/50 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
