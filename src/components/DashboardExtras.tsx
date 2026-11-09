import { DailyBriefingCard } from "@/components/DailyBriefingCard";
import { QuickActionsBar } from "@/components/QuickActionsBar";
import { MoodCheckin } from "@/components/MoodCheckin";
import { WaterTracker } from "@/components/WaterTracker";
import { WorkoutNotesPanel } from "@/components/WorkoutNotesPanel";

export function DashboardExtras(props: {
  userId: string;
  streak: number;
  todayReps: number;
  goal: number;
  readinessScore?: number;
}) {
  return (
    <>
      <DailyBriefingCard
        userId={props.userId}
        streak={props.streak}
        todayReps={props.todayReps}
        goal={props.goal}
        readinessScore={props.readinessScore}
      />
      <QuickActionsBar />
      <MoodCheckin key={props.userId} userId={props.userId} />
      <WaterTracker key={props.userId} userId={props.userId} />
      <WorkoutNotesPanel />
    </>
  );
}
