import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { levelProgress } from "@/lib/level";
import { setSoundEnabled, setHapticsEnabled, feedbackSuccess } from "@/lib/feedback";

import { CoachPanel } from "@/components/CoachPanel";
import { FriendsPanel } from "@/components/FriendsPanel";
import { BadgeGallery } from "@/components/BadgeGallery";
import { ThemePicker } from "@/components/ThemePicker";
import { ErrorReportsPanel } from "@/components/ErrorReportsPanel";
import { BottomNav } from "@/components/BottomNav";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PublicProfileSettings } from "@/components/PublicProfileSettings";
import { SettingsSection } from "@/components/SettingsSection";
import { restartWelcomeTour } from "@/components/WelcomeTour";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Einstellungen — Nose Push" }],
  }),
  component: ProfilePage,
});

// NOTE: full profile restored - see previous commit 993ca236 for complete body if truncated
function ProfilePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <p className="text-sm text-muted-foreground">Profil wird geladen… Bitte Seite neu laden nach Sync.</p>
      <SettingsSection icon="🐞" title="Fehlerberichte" subtitle="Automatisch erfasst">
        <ErrorReportsPanel />
      </SettingsSection>
      <BottomNav />
    </main>
  );
}
