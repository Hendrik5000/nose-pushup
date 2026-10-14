<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Readiness-Score lives in `src/lib/readiness.ts` and is the single source for
  daily training-readiness; dashboard, coach plan and cali hub must use it
  instead of computing their own scores. Why: avoids diverging fatigue logic.
- Plateau/trend analysis for cali skills lives in `src/lib/calisthenics.ts`
  (`analyzeSkillTrends`, `getDailyFocus`); AI advice goes through
  `src/lib/cali-coach.functions.ts` and is cached in `coach_advice` with a
  `plan.plateau_skill` marker. Why: keeps AI calls rare and auditable.
- RPE (1–10) is collected in the workout finish flow before saving and stored
  on `workouts.rpe` (nullable). Why: one optional column, no breaking change.
- Battle league (`/battle-league`) is read-only over `battles` +
  `public_profiles.battle_rating`; the `nemesis` achievement condition is
  evaluated inside `check_achievements`. Why: no new tables, gamification stays
  server-side.
- New server-side AI calls use model `openai/gpt-6-astra` via
  `https://ai.gateway.lovable.dev/v1/responses` (store:false, reasoning effort
  low). Why: workspace default model policy; older coach code still uses
  gemini chat completions and is left as-is.
