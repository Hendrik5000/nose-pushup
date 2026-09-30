import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ThemePicker } from "@/components/ThemePicker";
import { NotificationSettings } from "@/components/NotificationSettings";
import { isSoundEnabled, setSoundEnabled, isHapticsEnabled, setHapticsEnabled } from "@/lib/feedback";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Einstellungen — Nose Push" }],
  }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  daily_goal: number;
};

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabledLocal] = useState(isSoundEnabled());
  const [hapticsEnabled, setHapticsEnabledLocal] = useState(isHapticsEnabled());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, daily_goal")
        .eq("id", u.user.id)
        .maybeSingle();
      if (p) setProfile(p as Profile);
      setLoading(false);
    })();
  }, []);

  const handleSoundChange = (value: boolean) => {
    setSoundEnabled(value);
    setSoundEnabledLocal(value);
  };

  const handleHapticsChange = (value: boolean) => {
    setHapticsEnabled(value);
    setHapticsEnabledLocal(value);
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-20">
      <header className="flex items-center justify-between mb-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück
        </Link>
        <span className="text-sm font-semibold">⚙️ Einstellungen</span>
        <span className="w-12" />
      </header>

      {loading ? (
        <div className="flex justify-center py-8">
          <p className="text-sm text-muted-foreground">Lade Einstellungen…</p>
        </div>
      ) : (
        <>
          {/* Profil & Konto */}
          <SettingsSection title="Profil & Konto">
            <SettingItem label="Display Name" value={profile?.display_name || "—"} icon="👤" />
            <SettingItem label="Tägliches Ziel" value={`${profile?.daily_goal || 50} Reps`} icon="🎯" />
            <SettingItem 
              label="Abmelden" 
              value="Sign out"
              icon="🚪"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              isButton
            />
          </SettingsSection>

          {/* Ton & Haptik */}
          <SettingsSection title="Ton & Haptik">
            <SettingToggle
              label="Ton"
              description="Feedback-Töne bei Wiederholungen"
              icon="🔊"
              checked={soundEnabled}
              onChange={handleSoundChange}
            />
            <SettingToggle
              label="Vibration"
              description="Haptisches Feedback"
              icon="📳"
              checked={hapticsEnabled}
              onChange={handleHapticsChange}
            />
          </SettingsSection>

          {/* Benachrichtigungen */}
          <SettingsSection title="Benachrichtigungen">
            <div className="px-4 py-3">
              <NotificationSettings />
            </div>
          </SettingsSection>

          {/* Design & Anzeige */}
          <SettingsSection title="Design & Anzeige">
            <div className="px-4 py-3">
              {profile?.id && <ThemePicker profileId={profile.id} />}
            </div>
          </SettingsSection>

          {/* Info */}
          <SettingsSection title="Über">
            <SettingItem label="Version" value="1.0.0" icon="📦" />
            <SettingItem label="Entwickler" value="Hendrik" icon="👨‍💻" />
          </SettingsSection>
        </>
      )}

      <BottomNav />
    </main>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="px-4 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {title}
      </h2>
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden backdrop-blur">
        {children}
      </div>
    </div>
  );
}

function SettingItem({
  label,
  value,
  icon,
  onClick,
  isButton = false,
}: {
  label: string;
  value: string;
  icon: string;
  onClick?: () => void;
  isButton?: boolean;
}) {
  const content = (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="text-xl leading-none">{icon}</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{label}</div>
        </div>
      </div>
      <div className={`text-sm font-medium ${isButton ? "text-primary" : "text-muted-foreground"}`}>
        {value}
      </div>
    </div>
  );

  if (isButton && onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left border-t border-border/50 first:border-t-0 hover:bg-primary/5 transition active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  return <div className="border-t border-border/50 first:border-t-0">{content}</div>;
}

function SettingToggle({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full text-left border-t border-border/50 first:border-t-0 hover:bg-primary/5 transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl leading-none">{icon}</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground mt-1">{description}</div>
          </div>
        </div>
        <div className={`h-6 w-10 rounded-full border-2 transition flex items-center ${checked ? "border-primary bg-primary/20" : "border-border bg-secondary/40"}`}>
          <div
            className={`h-5 w-5 rounded-full transition ${checked ? "ml-auto mr-0.5 bg-primary" : "ml-0.5 mr-auto bg-muted-foreground"}`}
          />
        </div>
      </div>
    </button>
  );
}
