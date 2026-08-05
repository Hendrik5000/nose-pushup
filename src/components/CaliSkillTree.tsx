import { Link } from "@tanstack/react-router";
import {
  type CaliPath,
  type CaliSkill,
  type SkillStatus,
  getSkillStatus,
  skillProgress,
  getRecommendedSkill,
} from "@/lib/calisthenics";

type Props = {
  path: CaliPath;
  bests: Record<string, number>;
};

export function CaliSkillTree({ path, bests }: Props) {
  const recommended = getRecommendedSkill(bests, path);

  return (
    <div className="space-y-3">
      {/* Path Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{path.icon}</span>
        <h3 className="text-base font-bold tracking-tight">{path.name} Path</h3>
        <span className="ml-auto text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {path.skills.filter((s) => getSkillStatus(bests, s) === "mastered").length}/
          {path.skills.length} gemeistert
        </span>
      </div>

      {/* Skill Chain */}
      <div className="relative space-y-2">
        {path.skills.map((skill, i) => {
          const status = getSkillStatus(bests, skill);
          const pct = skillProgress(bests, skill);
          const isRecommended = skill.id === recommended.id;
          const isLast = i === path.skills.length - 1;

          return (
            <div key={skill.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div
                  className={`absolute left-6 top-full z-10 h-2 w-0.5 ${
                    status === "mastered" ? "bg-primary" : "bg-border"
                  }`}
                />
              )}

              <SkillCard
                skill={skill}
                status={status}
                progress={pct}
                isRecommended={isRecommended}
                best={bests[skill.id] ?? 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  status,
  progress,
  isRecommended,
  best,
}: {
  skill: CaliSkill;
  status: SkillStatus;
  progress: number;
  isRecommended: boolean;
  best: number;
}) {
  const isLocked = status === "locked";
  const isMastered = status === "mastered";

  return (
    <div
      className={`relative rounded-2xl border p-4 transition ${
        isLocked
          ? "border-border/50 bg-card/20 opacity-60"
          : isMastered
            ? "border-primary/40 bg-primary/8"
            : isRecommended
              ? "border-primary/60 bg-primary/10"
              : "border-border bg-card/50"
      } backdrop-blur`}
    >
      {/* Recommended badge */}
      {isRecommended && !isMastered && !isLocked && (
        <div className="absolute -top-2 left-4 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-primary-foreground">
          Heute empfohlen
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon + status */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl ${
            isLocked
              ? "border-border/50 bg-background/30"
              : isMastered
                ? "border-primary/40 bg-primary/15"
                : "border-border bg-background/50"
          }`}
        >
          {isLocked ? "🔒" : isMastered ? "✅" : skill.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
              {skill.name}
            </span>
            <span className="rounded-full border border-border/60 bg-secondary/50 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {skill.unit === "seconds" ? "Haltezeit" : "Reps"}
            </span>
          </div>

          {!isLocked && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{skill.description}</p>
          )}

          {isLocked && skill.prerequisite && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Freischalten: vorherige Übung ≥ {skill.unlock_threshold}
              {skill.unit === "seconds" ? "s" : " Reps"}
            </p>
          )}

          {/* Progress bar */}
          {!isLocked && !isMastered && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  Best: <span className="font-semibold text-foreground tabular-nums">
                    {best > 0 ? `${best}${skill.unit === "seconds" ? "s" : ""}` : "—"}
                  </span>
                </span>
                <span>
                  Ziel: {skill.mastery_threshold}{skill.unit === "seconds" ? "s" : " Reps"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {isMastered && (
            <div className="mt-1 text-[11px] font-semibold text-primary">
              ✓ Gemeistert · Best: {best}{skill.unit === "seconds" ? "s" : " Reps"}
            </div>
          )}
        </div>

        {/* Train button */}
        {!isLocked && !isMastered && (
          <Link
            to="/workout/$exerciseId"
            params={{ exerciseId: skill.id }}
            className="shrink-0 rounded-xl bg-primary/15 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25 active:scale-[0.97]"
          >
            Train
          </Link>
        )}
      </div>

      {/* Tip */}
      {!isLocked && !isMastered && isRecommended && (
        <div className="mt-3 rounded-xl bg-background/40 px-3 py-2 border border-border/50">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">💡 Tipp: </span>{skill.tip}
          </p>
        </div>
      )}
    </div>
  );
}
