import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyWorkouts from "./tools/list-my-workouts";
import logWorkout from "./tools/log-workout";
import getMyRecentStats from "./tools/get-leaderboard";

// OAuth issuer MUST be the direct Supabase host. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the fallback keeps the manifest extract eval
// well-formed. Tokens never verify against the sentinel.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nose-push-mcp",
  title: "Nose Push MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Nose Push training app. Use `get_my_profile` for the signed-in user's XP/level/streak, `list_my_workouts` for recent sessions, `get_my_recent_stats` for daily aggregates, and `log_workout` to record a new session (triggers XP/streak/PB updates server-side).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyWorkouts, logWorkout, getMyRecentStats],
});
