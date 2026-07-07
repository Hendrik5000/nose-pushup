import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s.next) }),
  head: () => ({
    meta: [
      { title: "Anmelden — Nose Push" },
      { name: "description", content: "Melde dich an, um deine Push-Up-Bestwerte geräteübergreifend zu speichern." },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ href: search.next });
  },
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  password: z.string().min(6, "Mindestens 6 Zeichen").max(72),
  displayName: z.string().trim().min(1).max(60).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const translateAuthError = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
      return "E-Mail oder Passwort ist falsch.";
    if (m.includes("email not confirmed"))
      return "Bitte bestätige zuerst deine E-Mail (Link im Postfach).";
    if (m.includes("user already registered"))
      return "Diese E-Mail ist bereits registriert. Melde dich stattdessen an.";
    if (m.includes("password should be at least"))
      return "Passwort zu kurz — mindestens 6 Zeichen.";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Zu viele Versuche. Bitte warte einen Moment.";
    if (m.includes("network") || m.includes("failed to fetch"))
      return "Keine Verbindung — prüfe dein Internet.";
    return raw;
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = credSchema.safeParse({
      email,
      password,
      displayName: mode === "signup" ? displayName : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      window.location.href = next;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Anmeldung fehlgeschlagen";
      setError(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/auth?next=" + encodeURIComponent(next),
    });
    if (result.error) {
      setError(result.error instanceof Error ? result.error.message : "OAuth fehlgeschlagen");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    window.location.href = next;
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: "Gast" } },
      });
      if (error) throw error;
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gast-Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Nose&nbsp;Push
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Willkommen zurück" : "Konto erstellen"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Melde dich an, um deine Bestwerte zu sehen."
              : "Speichere Bestwerte und Trainings auf allen Geräten."}
          </p>

          <div className="mt-6 space-y-2">
            <OAuthButton label="Mit Google fortfahren" onClick={() => handleOAuth("google")} disabled={loading} />
            <OAuthButton label="Mit Apple fortfahren" onClick={() => handleOAuth("apple")} disabled={loading} />
          </div>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />oder<span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <Field
                label="Anzeigename"
                value={displayName}
                onChange={setDisplayName}
                placeholder="z. B. Alex"
                autoComplete="nickname"
              />
            )}
            <Field
              label="E-Mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="du@beispiel.de"
              autoComplete="email"
              required
            />
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Passwort
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 pr-12 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Bitte warten…" : mode === "signin" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition"
          >
            {mode === "signin"
              ? "Noch kein Konto? Jetzt registrieren"
              : "Bereits registriert? Anmelden"}
          </button>

          <div className="mt-4 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleGuest}
              disabled={loading}
              className="w-full rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground hover:border-primary/40 active:scale-[0.98] disabled:opacity-60"
            >
              👤 Als Gast fortfahren
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Ohne Anmeldung starten. Fortschritt bleibt an dieses Gerät gebunden.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function OAuthButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
