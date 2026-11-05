import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import type { PrivateGameId } from "@/lib/private-game-policy";
import { HOME_OTHER_AREAS } from "@/lib/home-app-menus";
import { supabase } from "@/integrations/supabase/client";
import { PostfachBell } from "@/components/postfach/PostfachBell";
import { MiraHandoff } from "@/components/alo/MiraHandoff";
import { MiraVoiceChatDialog } from "@/components/mira/MiraVoiceChatDialog";
import { MiraSpark } from "@/components/mira/MiraSpark";
import {
  createBrowserSpeechRecognitionFactory,
  type MiraSpeechRecognitionLike,
} from "@/lib/mira-voice-conversation";
import { Search, Users, X } from "lucide-react";
import "@/mira-home-overlay.css";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Alo — All in one" },
      {
        name: "description",
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat an einem Ort.",
      },
    ],
  }),
  component: Dashboard,
});

function HomeAppHub({
  displayName,
  avatarUrl,
}: {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  const { user } = Route.useRouteContext();
  const [canSeeAdmin, setCanSeeAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    setCanSeeAdmin(false);
    void getAdminAreaAccess()
      .then((allowed) => {
        if (active && allowed === true) setCanSeeAdmin(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user.id]);
  const initials = displayName?.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <section className="alo-tablet-home-hub mb-8" aria-labelledby="app-hub-title">
      <header className="mb-7 flex items-center justify-between gap-3">
        <h1 id="app-hub-title" className="text-2xl font-bold tracking-tight">
          Alo
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Überall suchen"
            onClick={() => window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" }))}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <PostfachBell />
          <Link
            to="/profile"
            hash="profile-training"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Freunde öffnen"
            title="Freunde"
          >
            <Users className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            to="/profile"
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Profil und Einstellungen öffnen"
            title="Profil und Einstellungen"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </Link>
        </div>
      </header>
      <nav
        className="alo-tablet-home-apps grid w-full max-w-[520px] grid-cols-4 gap-x-3 gap-y-6"
        aria-label="Alo-Apps"
      >
        <HubAppIcon to="/ai" title="Mira" artwork="mira" />
        <HubAppIcon to="/chat" title="Nexus Chat" artwork="nexus" />
        <HubAppIcon to="/exercises" title="Alo Health" artwork="health" />
        <HubAppIcon to="/profile" title="Einstellungen" artwork="settings" />
        {canSeeAdmin && <HubAppIcon to="/admin" title="Admin" artwork="admin" />}
        {canSeeAdmin && (
          <>
            <HubGameAppIcon game="grid-defense" title="Grid Defense" artwork="gridDefense" />
            <HubGameAppIcon game="kupferkern" title="Kupferkern" artwork="kupferkern" />
          </>
        )}
        <Link
          to="/areas"
          className={`alo-tablet-home-app-action ${HUB_APP_ICON_CLASS_NAME}`}
          aria-label={`Weitere Bereiche öffnen (${HOME_OTHER_AREAS.length})`}
        >
          <HubAppIconContents title="Weitere Bereiche" artwork="more" />
        </Link>
        <HubAppIcon to="/training" title="Trainingsübersicht & Gym" artwork="training" />
        <Link
          to="/tools"
          className={`alo-tablet-home-app-action ${HUB_APP_ICON_CLASS_NAME}`}
          aria-label="Alo-Werkzeuge öffnen"
        >
          <HubAppIconContents title="Alo-Werkzeuge" artwork="tools" />
        </Link>
      </nav>
    </section>
  );
}

type HubArtworkKind =
  | "mira"
  | "nexus"
  | "health"
  | "settings"
  | "admin"
  | "gridDefense"
  | "kupferkern"
  | "more"
  | "training"
  | "tools";

const HUB_APP_ICON_CLASS_NAME =
  "group flex w-full min-w-0 flex-col items-center gap-2 rounded-xl text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function HubAppIcon({
  to,
  title,
  artwork,
}: {
  to: "/ai" | "/chat" | "/exercises" | "/profile" | "/admin" | "/training";
  title: string;
  artwork: Exclude<HubArtworkKind, "gridDefense" | "kupferkern">;
}) {
  return (
    <Link to={to} aria-label={`${title} öffnen`} className={HUB_APP_ICON_CLASS_NAME}>
      <HubAppIconContents title={title} artwork={artwork} />
    </Link>
  );
}

function HubGameAppIcon({
  game,
  title,
  artwork,
}: {
  game: PrivateGameId;
  title: string;
  artwork: "gridDefense" | "kupferkern";
}) {
  return (
    <Link
      to="/games"
      search={{ game }}
      aria-label={`${title} öffnen`}
      className={HUB_APP_ICON_CLASS_NAME}
    >
      <HubAppIconContents title={title} artwork={artwork} />
    </Link>
  );
}

function HubAppIconContents({ title, artwork }: { title: string; artwork: HubArtworkKind }) {
  return (
    <>
      <span className="relative grid aspect-square w-full max-w-[96px] place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md transition group-hover:scale-105 group-hover:shadow-lg">
        <HubArtwork kind={artwork} />
      </span>
      <span className="max-w-full text-[11px] font-medium leading-tight text-foreground sm:text-xs">
        {title}
      </span>
    </>
  );
}

function HubArtwork({ kind }: { kind: HubArtworkKind }) {
  const palettes = {
    mira: { bg: "#211c37", accent: "#c4b5fd", glow: "#8b5cf6" },
    nexus: { bg: "#122d3a", accent: "#67e8f9", glow: "#0ea5e9" },
    health: { bg: "#15352e", accent: "#86efac", glow: "#10b981" },
    settings: { bg: "#3a2e1e", accent: "#fcd34d", glow: "#f59e0b" },
    admin: { bg: "#182b3b", accent: "#a5d8ff", glow: "#38bdf8" },
    gridDefense: { bg: "#152b32", accent: "#a7f3d0", glow: "#22c55e" },
    kupferkern: { bg: "#38251c", accent: "#fdba74", glow: "#c2410c" },
    more: { bg: "#172735", accent: "#67e8f9", glow: "#0ea5e9" },
    training: { bg: "#30291d", accent: "#fcd34d", glow: "#f59e0b" },
    tools: { bg: "#25233a", accent: "#c4b5fd", glow: "#8b5cf6" },
  } as const;
  const palette = palettes[kind];

  return (
    <svg
      viewBox="74 0 132 132"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="280" height="132" rx="18" fill={palette.bg} />
      <circle cx="232" cy="28" r="47" fill={palette.glow} opacity=".18" />
      <circle cx="35" cy="112" r="54" fill={palette.accent} opacity=".08" />
      {kind === "mira" && (
        <>
          <ellipse
            cx="140"
            cy="68"
            rx="64"
            ry="24"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".48"
            strokeWidth="2"
            transform="rotate(-18 140 68)"
          />
          <ellipse
            cx="140"
            cy="68"
            rx="42"
            ry="53"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".28"
            strokeWidth="2"
            transform="rotate(28 140 68)"
          />
          <circle cx="140" cy="66" r="20" fill={palette.glow} />
          <path d="m140 39 4 13 13 4-13 4-4 13-4-13-13-4 13-4 4-13Z" fill="#fff" />
          <circle cx="196" cy="38" r="4" fill="#fff" />
          <circle cx="82" cy="93" r="3" fill={palette.accent} />
        </>
      )}
      {kind === "nexus" && (
        <>
          <path
            d="M74 42h83a14 14 0 0 1 14 14v25a14 14 0 0 1-14 14h-8l-17 15V95H74a14 14 0 0 1-14-14V56a14 14 0 0 1 14-14Z"
            fill={palette.accent}
            opacity=".95"
          />
          <path
            d="M135 27h69a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13h-9v14l-17-14h-43a13 13 0 0 1-13-13V40a13 13 0 0 1 13-13Z"
            fill="#e0f2fe"
            opacity=".94"
          />
          <circle cx="91" cy="68" r="4" fill="#123047" />
          <circle cx="110" cy="68" r="4" fill="#123047" />
          <circle cx="129" cy="68" r="4" fill="#123047" />
          <path d="M159 49h37" stroke="#0c4a6e" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M159 58h25"
            stroke="#0c4a6e"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".55"
          />
        </>
      )}
      {kind === "health" && (
        <>
          <circle cx="140" cy="67" r="43" fill={palette.glow} opacity=".32" />
          <path
            d="M140 96 101 60a24 24 0 0 1 36-32l3 4 3-4a24 24 0 0 1 36 32l-39 36Z"
            fill={palette.accent}
          />
          <path
            d="M70 72h31l10-17 16 35 13-25 10 13h60"
            fill="none"
            stroke="#123b2e"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="209" cy="39" r="5" fill="#fff" opacity=".85" />
        </>
      )}
      {kind === "settings" && (
        <>
          <circle cx="140" cy="66" r="42" fill={palette.glow} opacity=".28" />
          <path
            d="M140 34a8 8 0 0 1 8 8v4a23 23 0 0 1 8 4l4-2a8 8 0 0 1 11 3l4 7a8 8 0 0 1-3 11l-4 2a24 24 0 0 1 0 9l4 2a8 8 0 0 1 3 11l-4 7a8 8 0 0 1-11 3l-4-2a23 23 0 0 1-8 4v4a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8v-4a23 23 0 0 1-8-4l-4 2a8 8 0 0 1-11-3l-4-7a8 8 0 0 1 3-11l4-2a24 24 0 0 1 0-9l-4-2a8 8 0 0 1-3-11l4-7a8 8 0 0 1 11-3l4 2a23 23 0 0 1 8-4v-4a8 8 0 0 1 8-8h8Z"
            fill={palette.accent}
            transform="translate(0 -7) scale(.92 1) translate(12 0)"
          />
          <circle cx="140" cy="66" r="18" fill={palette.bg} />
          <circle cx="140" cy="66" r="8" fill={palette.accent} />
          <path
            d="M202 43h23M213.5 31.5v23"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
        </>
      )}
      {kind === "admin" && (
        <>
          <path
            d="M140 28 185 45v28c0 26-18 44-45 58-27-14-45-32-45-58V45l45-17Z"
            fill={palette.accent}
            opacity=".92"
          />
          <path
            d="m120 70 14 14 28-30"
            fill="none"
            stroke={palette.bg}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "gridDefense" && (
        <>
          <path
            d="M88 42h104M88 66h104M88 90h104M108 34v72M140 34v72M172 34v72"
            stroke={palette.accent}
            strokeOpacity=".28"
            strokeWidth="2"
          />
          <path d="M119 90V68h42v22Z" fill={palette.glow} opacity=".72" />
          <path d="M129 68V54l11-20 11 20v14Z" fill={palette.accent} />
          <path
            d="M140 44v12m-6-6h12"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".92"
          />
        </>
      )}
      {kind === "kupferkern" && (
        <>
          <path
            d="M88 43h24l13 23h30l13-23h24M88 89h24l13-23h30l13 23h24"
            fill="none"
            stroke={palette.accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".72"
          />
          <circle cx="140" cy="66" r="29" fill={palette.glow} opacity=".25" />
          <circle cx="140" cy="66" r="18" fill={palette.glow} />
          <circle cx="140" cy="66" r="8" fill={palette.accent} />
          <circle cx="140" cy="66" r="3" fill="#fff" />
        </>
      )}
      {kind === "more" && (
        <>
          <circle cx="140" cy="66" r="43" fill={palette.glow} opacity=".28" />
          <path
            d="M140 39v54M113 66h54"
            stroke={palette.accent}
            strokeWidth="12"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === "training" && (
        <>
          <circle cx="140" cy="66" r="43" fill={palette.glow} opacity=".25" />
          <path
            d="M104 54v24m12-33v42m48-42v42m12-33v24M116 66h48"
            fill="none"
            stroke={palette.accent}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "tools" && (
        <>
          <circle cx="140" cy="66" r="44" fill={palette.glow} opacity=".24" />
          <path
            d="M104 54h72a8 8 0 0 1 8 8v37a8 8 0 0 1-8 8h-72a8 8 0 0 1-8-8V62a8 8 0 0 1 8-8Z"
            fill={palette.accent}
          />
          <path
            d="M124 54V44a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v10m-60 20h88m-52 0v12h16V74"
            fill="none"
            stroke={palette.bg}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="184" cy="37" r="4" fill="#fff" opacity=".9" />
        </>
      )}
      <path d="M18 18h22" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MiraOverlayLauncher() {
  const { user } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [handoffRequest, setHandoffRequest] = useState<{ id: number; text: string } | null>(null);
  const recognitionRef = useRef<MiraSpeechRecognitionLike | null>(null);
  const handoffIdRef = useRef(0);

  const stopListening = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already have ended.
      }
    }
    setListening(false);
  };

  const startListening = () => {
    const recognitionFactory = createBrowserSpeechRecognitionFactory();
    const recognition = recognitionFactory?.();
    if (!recognition) {
      setVoiceError("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return;
    }

    setVoiceError(null);
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const recognized = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (recognized)
        setTranscript((previous) => (previous ? `${previous} ${recognized}` : recognized));
    };
    recognition.onerror = (event) => {
      const message =
        event?.error === "not-allowed" || event?.error === "service-not-allowed"
          ? "Mikrofonzugriff wurde nicht erlaubt. Prüfe die Browser-Berechtigung und tippe erneut."
          : event?.error === "audio-capture"
            ? "Kein verwendbares Mikrofon gefunden. Prüfe dein Gerät und versuche es erneut."
            : event?.error === "no-speech"
              ? "Es wurde keine Sprache erkannt. Tippe auf das Mikrofon und versuche es erneut."
              : "Spracherkennung fehlgeschlagen. Versuche es erneut oder nutze den Textbereich.";
      setVoiceError(message);
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) stopListening();
    else setVoiceError(null);
    setOpen(nextOpen);
  };

  const continueToMira = () => {
    const text = transcript.trim();
    if (!text) return;
    stopListening();
    setOpen(false);
    handoffIdRef.current += 1;
    setHandoffRequest({ id: handoffIdRef.current, text });
  };

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already have ended.
      }
      recognitionRef.current = null;
    },
    [],
  );

  return (
    <>
      <div className={`alo-mira-home-launcher${handoffRequest ? " has-handoff" : ""}`}>
        {handoffRequest ? (
          <div className="alo-mira-home-handoff-actions">
            <MiraHandoff
              key={handoffRequest.id}
              userId={user.id}
              text={handoffRequest.text}
              source="deine eingesprochene Frage"
              label="Frage in Mira prüfen"
              className="alo-mira-home-handoff-button"
              onNavigate={() => {
                setHandoffRequest(null);
                setTranscript("");
              }}
            />
            <button
              type="button"
              className="alo-mira-home-handoff-dismiss"
              aria-label="Diktierte Frage verwerfen"
              onClick={() => {
                setHandoffRequest(null);
                setTranscript("");
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="alo-mira-home-launcher-button"
            aria-label="Mira öffnen und eine Frage stellen"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => handleOpenChange(true)}
          >
            <MiraSpark />
          </button>
        )}
      </div>
      <MiraVoiceChatDialog
        open={open}
        onOpenChange={handleOpenChange}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        listening={listening}
        onStartListening={startListening}
        onStopListening={stopListening}
        error={voiceError}
        onContinue={continueToMira}
        continueLabel="Frage in Mira prüfen"
        className="alo-dialog alo-mira-voice-entry-dialog max-h-[88dvh] overflow-y-auto sm:max-w-md"
      />
    </>
  );
}

type HomeProfile = { display_name: string | null; avatar_url: string | null };

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  useEffect(() => {
    let active = true;
    setProfile(null);
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      let current = data;
      if (!current) {
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            display_name:
              (user.user_metadata?.display_name as string | undefined) ??
              (user.is_anonymous ? "Gast" : (user.email?.split("@")[0] ?? null)),
          })
          .select("display_name, avatar_url")
          .maybeSingle();
        if (!active) return;
        current = created;
      }
      setProfile(current);
    })();
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <main className="alo-tablet-home-page relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-6 pb-24">
      <HomeAppHub displayName={profile?.display_name} avatarUrl={profile?.avatar_url} />
      <MiraOverlayLauncher />
    </main>
  );
}
