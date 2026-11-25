import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export type TutorialStep = Readonly<{
  id: string;
  title: string;
  text: string;
  selector?: string;
  requireInteraction?: boolean;
}>;

export type Tutorial = Readonly<{
  id: string;
  title: string;
  description: string;
  route: string;
  steps: readonly TutorialStep[];
}>;

export const MAIN_TUTORIAL_ID = "main";

export const MAIN_TUTORIAL: Tutorial = {
  id: MAIN_TUTORIAL_ID,
  title: "Alo-Tour",
  description: "Führt dich interaktiv über die Startseite — du machst alles selbst mit.",
  route: "/",
  steps: [
    {
      id: "welcome",
      title: "Willkommen bei Alo",
      text: "Alo ist dein Launcher: ein Home-Bildschirm mit Apps, einem Marketplace und Mira als KI. Diese Tour führt dich herum — bei den Aufgaben mit „Jetzt du“ tippst du selbst auf das markierte Element. Du kannst jederzeit mit „Überspringen“ aussteigen.",
    },
    {
      id: "groups",
      title: "Apps sind nach Aufgaben gruppiert",
      text: "Deine Apps sind in Bereiche sortiert: Alo Intelligence (Mira, Nexus, Health), Fitness & Sport, Werkzeuge & System, Unterhaltung & Erweiterungen und Meine Apps. Leere Gruppen werden ausgeblendet.",
      selector: '[data-home-group-toggle="intelligence"]',
      requireInteraction: true,
    },
    {
      id: "groups-action",
      title: "Jetzt du: Gruppe ein- oder ausklappen",
      text: "Tippe auf den Gruppenkopf „Alo Intelligence“, um die Gruppe einzuklappen — und nochmal, um sie wieder einzublenden. Der Zustand wird pro Konto gespeichert.",
      selector: '[data-home-group-toggle="intelligence"]',
      requireInteraction: true,
    },
    {
      id: "favorites",
      title: "Favoriten",
      text: "Halte eine App lange gedrückt (oder Rechtsklick) und wähle „Zu Favoriten hinzufügen“. Deine Favoriten erscheinen als eigene Sektion ganz oben über den Gruppen.",
      selector: '[data-home-app-id="mira"]',
    },
    {
      id: "search",
      title: "Überall suchen",
      text: "Die Lupen-Suche oben durchsucht Mira-Verläufe, Notizen und Aufgaben, Apps, Spiele, Fußball-Ligen, Health-Übungen, Nexus und Trainingspläne — mit Sprungzielen direkt zum Treffer.",
      selector: 'button[aria-label="Überall suchen"]',
    },
    {
      id: "postfach",
      title: "Postfach — nur echte Benachrichtigungen",
      text: "Die Glocke zeigt deine ungelesenen Nachrichten als echte Zahl — es gibt keine künstlichen Aktivitäts-Badges. Hier landen Battle-Einladungen und Mitteilungen.",
      selector: 'button[aria-label^="Postfach öffnen"]',
    },
    {
      id: "mira-button",
      title: "Die Mira-Taste — halten und sprechen",
      text: "Der Mira-Knopf unten ist dein KI-Einstieg: Halten startet die Spracheingabe, dein Text erscheint live über dem Mira-Symbol, und nach dem Loslassen wird die Frage direkt an Mira übergeben und bearbeitet. Ein kurzer Tipp öffnet den Diktier-Dialog zum Prüfen.",
      selector: ".alo-mira-home-launcher-button",
    },
    {
      id: "edit-mode",
      title: "Bearbeitungsmodus",
      text: "Halte eine freie Stelle auf dem Home-Bildschirm lange gedrückt: Jetzt kannst du Apps per Drag-and-drop sortieren, mit der Tastatur verschieben, umbenennen und Hintergrundbilder wählen. Alles bleibt lokal auf deinem Konto.",
    },
    {
      id: "browser-pwa",
      title: "Browser und App-Shortcuts",
      text: "Der Alo-Browser öffnet echte Websites (bei Blockaden ehrlich als Lesetext), und Mira kann ihn nutzen und bedienen. Auf Android bekommst du per Long-Press auf das Alo-Icon direkte App-Shortcuts — zu Mira, Nexus, Fußball, Sports, Health, Spielen, Marketplace und mehr.",
    },
    {
      id: "marketplace",
      title: "Marketplace — der Alo App Store",
      text: "Im Marketplace installierst du Apps: Kategorien (Offiziell, Empfohlen, Neu), Detailseiten mit Vorschau und ähnlichen Apps, und Installiertes verschwindet aus dem Katalog und erscheint als Kachel hier auf dem Home-Bildschirm. Eigene Apps, die du mit Mira baust, kannst du dort veröffentlichen (nach Admin-Freigabe).",
      selector: '[data-home-app-id="marketplace"]',
    },
    {
      id: "marketplace-action",
      title: "Jetzt du: Öffne den Marketplace",
      text: "Tippe auf die Marketplace-Kachel, um den Alo App Store zu öffnen. Damit ist diese Tour geschafft — einzelne Tutorials für jede App findest du in den Einstellungen unter „Hilfe & Diagnose“.",
      selector: '[data-home-app-id="marketplace"]',
      requireInteraction: true,
    },
  ],
};

export const APP_TUTORIALS: readonly Tutorial[] = [
  {
    id: "mira",
    title: "Mira-Tutorial",
    description: "Fragen stellen, Anhänge, Sprache und Einstellungen in Miras Chat.",
    route: "/ai",
    steps: [
      {
        id: "composer",
        title: "Frag Mira einfach",
        text: "Schreibe deine Frage ins Eingabefeld und sende sie. Mira beantwortet Wissen, Schreiben, Ideen, Lernen und Alltag — Antworten können visuell aufbereitet sein (Tabellen, Karten, Pläne).",
        selector: "textarea",
      },
      {
        id: "context",
        title: "Kontext ist deine Entscheidung",
        text: "Standardmäßig teilt Mira keine deiner App-Daten. In Miras Einstellungen entscheidest du pro Bereich, ob sie Trainings- oder Chat-Kontext sehen darf.",
      },
      {
        id: "voice",
        title: "Sprache",
        text: "Über das Mikrofon diktierst du deine Frage. Vom Home-Bildschirm aus wird eine gesprochene Frage nach dem Loslassen der Mira-Taste sogar direkt an Mira übergeben und bearbeitet.",
      },
      {
        id: "browser",
        title: "Mira nutzt den Alo-Browser",
        text: "Bei Web-Fragen liest Mira Seiten über den Alo-Browser und zeigt dir an, was sie tut — du kannst ihre Ergebnisse direkt im Browser öffnen. Sie kann auch Websites bedienen und folgt dabei sichtbar mit einem Zeiger.",
      },
      {
        id: "apps",
        title: "Eigene Apps mit Mira bauen",
        text: "Du kannst Mira bitten, eine kleine App zu bauen. Deine Entwürfe bleiben privat in deinem Konto, bis ein Admin sie im Marketplace freigibt.",
      },
    ],
  },
  {
    id: "nexus",
    title: "Nexus-Chat-Tutorial",
    description: "Räume, Direktnachrichten und Mira im Nexus.",
    route: "/chat",
    steps: [
      {
        id: "rooms",
        title: "Räume und Direktnachrichten",
        text: "Links wählst du Räume und Direktnachrichten. Lokale Chats bleiben nur auf diesem Gerät; mit Nexus-Verbindung werden sie in der Cloud synchronisiert.",
      },
      {
        id: "mira",
        title: "Mira direkt im Chat",
        text: "Der Mira-Eintrag oben in der Chatliste öffnet Miras Assistentin direkt in Nexus — mit eigenem Verlauf, wie ein ganz normaler Chat.",
      },
      {
        id: "actions",
        title: "Aktionen pro Raum",
        text: "Über das Drei-Punkte-Menü favorisierst du Räume, stellst sie stumm, suchst im Verlauf oder exportierst ihn.",
      },
    ],
  },
  {
    id: "health",
    title: "Alo-Health-Tutorial",
    description: "Messwerte, Fitness-Werkzeuge und Sportbereiche.",
    route: "/health",
    steps: [
      {
        id: "today",
        title: "Heute",
        text: "Oben siehst du deine Tageswerte: Schritte, aktive Kalorien und Schlaf — aus echten Messungen oder manuell erfasst.",
        selector: "#health-today",
      },
      {
        id: "fitness",
        title: "Fitness & Erholung",
        text: "Readiness, Erholungskalender, Wasser-Tracker und Pausen-Timer sind hier gebündelt.",
        selector: "#health-fitness",
      },
      {
        id: "entry",
        title: "Tag manuell erfassen",
        text: "Über „Tag manuell erfassen“ trägst du Datum, Schritte, Kalorien, Schlaf und Gewicht ein — auch ohne Uhr oder Health-Connect.",
        selector: "#health-entry",
      },
      {
        id: "sport",
        title: "Sport verbinden",
        text: "In der Seitenleiste („Sport verbinden“) springst du direkt zu Alo Sports, Fußball, Training, Calisthenics, Übungen und Coach.",
      },
    ],
  },
  {
    id: "sports",
    title: "Alo-Sports-Tutorial",
    description: "Live-Spiele, Tabellen und Lieblingsteams.",
    route: "/sports",
    steps: [
      {
        id: "leagues",
        title: "Ligen wechseln",
        text: "Über die Liga-Chips (oder die Seitenleiste) wechselst du zwischen Bundesliga, 2. und 3. Liga, Premier League, La Liga, Serie A, Ligue 1 und der Nationalmannschaft.",
        selector: 'nav[aria-label="Ligaauswahl"]',
      },
      {
        id: "live",
        title: "Spiele & Live",
        text: "Du siehst live laufende Spiele mit Stand und Status, die Tabelle, Spieltage mit Ergebnissen und die nächsten Ansetzungen.",
      },
      {
        id: "favorites",
        title: "Lieblingsteams",
        text: "Markiere Lieblingsteams — deren Spiele werden dir hervorgehoben zusammengestellt.",
      },
    ],
  },
  {
    id: "football",
    title: "Alo-Fußball-Tutorial",
    description: "Tabellen, Spieltage und Nationalmannschaft.",
    route: "/football",
    steps: [
      {
        id: "table",
        title: "Tabelle und Spieltage",
        text: "Die Fußball-App zeigt Bundesligatabellen, Spieltage mit Ergebnissen und Ansetzungen mit Blättern-Funktion — live von OpenLigaDB und TheSportsDB.",
      },
      {
        id: "national",
        title: "Nationalmannschaft",
        text: "Auch die deutsche Nationalmannschaft ist dabei: Länderspiele mit Terminen und Ergebnissen.",
      },
      {
        id: "sidebar",
        title: "Seitenleiste",
        text: "Über die App-Aktionen springst du zur Sports-Übersicht oder in den Marketplace.",
      },
    ],
  },
  {
    id: "games",
    title: "Spiele-Tutorial",
    description: "Vier Alo-Spiele für alle angemeldeten Alo-Nutzer.",
    route: "/games",
    steps: [
      {
        id: "selection",
        title: "Vier Alo-Spiele",
        text: "Alle angemeldeten Alo-Nutzer können Grid Defense, Kupferkern, Neon Starfighter und Alo Schach spielen. Die Spiele laufen im Vollbild; Spielstände gelten nur für die Sitzung.",
      },
      {
        id: "starfighter",
        title: "Neon Starfighter",
        text: "Neon Starfighter kennst du aus Notion: Hangar mit Upgrades, Arsenal, Missionen, Bosskämpfe alle fünf Sektoren, Combos und Hacking-Minigame — Bedienfeld und Infos liegen als Overlay über dem Vollbild-Canvas.",
      },
      {
        id: "marketplace",
        title: "Mehr Spiele",
        text: "Installierte Spiele erscheinen zusätzlich als Home-Kacheln; neue Spiele findest du im Marketplace.",
      },
    ],
  },
  {
    id: "marketplace",
    title: "Marketplace-Tutorial",
    description: "Apps finden, installieren und verwalten.",
    route: "/marketplace",
    steps: [
      {
        id: "search",
        title: "Katalog mit Suche",
        text: "Der Marketplace ist der Alo App Store: Suche oben, Kategorien Offiziell, Empfohlen, Neu und Von Freunden.",
        selector: 'form[role="search"] input',
      },
      {
        id: "detail",
        title: "Detailseiten",
        text: "Jede App hat eine Detailseite mit Beschreibung, Vorschau, Berechtigungen und ähnlichen Apps — installieren und deinstallieren funktioniert dort wie im Play Store.",
      },
      {
        id: "installed",
        title: "Installiert = Home-Bildschirm",
        text: "Installierte Apps erscheinen als Kacheln auf dem Home-Bildschirm und werden aus dem Marketplace-Katalog ausgeblendet — nichts doppelt.",
      },
      {
        id: "own",
        title: "Eigene Apps veröffentlichen",
        text: "Apps, die du mit Mira gebaut hast, findest du unter „Meine App-Entwürfe“ und kannst du zur Veröffentlichung einreichen — nach Admin-Prüfung erscheinen sie im Marketplace.",
      },
    ],
  },
  {
    id: "browser",
    title: "Browser-Tutorial",
    description: "Echte Websites öffnen, Reader-Modus und Mira.",
    route: "/browser",
    steps: [
      {
        id: "address",
        title: "Alles öffnen",
        text: "Gib eine Adresse ein — der Alo-Browser lädt normale Websites schnell über mehrere parallele Wege und zeigt blockierte Seiten ehrlich als Lesetext statt weißem Kasten.",
      },
      {
        id: "mira",
        title: "Mira im Browser",
        text: "Das Mira-Panel im Browser zeigt dir, was Mira macht; sie kann Seiten lesen, Links folgen und auf der Website suchen — du siehst ihren virtuellen Zeiger.",
      },
      {
        id: "newtab",
        title: "Im neuen Tab öffnen",
        text: "Bei Seiten, die Einbetten blockieren, öffnest du sie per Knopfdruck in einem echten Browser-Tab.",
      },
    ],
  },
  {
    id: "settings",
    title: "Einstellungen-Tutorial",
    description: "Kategorien, Darstellung und Hilfe.",
    route: "/profile",
    steps: [
      {
        id: "categories",
        title: "Kategorien",
        text: "Die Einstellungen sind wie in iOS gruppiert: Konto & Apps, Darstellung, Alltag, Datenschutz und Unterstützung — jede Kategorie ist eine eigene Unterseite.",
        selector: '[data-settings-category-list="true"]',
      },
      {
        id: "design",
        title: "Design wählen",
        text: "Unter „Darstellung & Menüfarbe“ stellst du den Apple-HIG-Stil oder das klassische Design, Farbwelt, Navigation und Widgets ein.",
      },
      {
        id: "support",
        title: "Hilfe & Diagnose",
        text: "Hier startest du diese Tutorials jederzeit erneut, meldest Fehler und findest die Alo-Version.",
      },
    ],
  },
];

export const ALL_TUTORIALS: readonly Tutorial[] = [MAIN_TUTORIAL, ...APP_TUTORIALS];

export function getTutorial(id: string): Tutorial | null {
  return ALL_TUTORIALS.find((tutorial) => tutorial.id === id) ?? null;
}

export type TutorialActiveRun = Readonly<{ id: string; step: number }>;

export type TutorialState = Readonly<{
  completed: readonly string[];
  active: TutorialActiveRun | null;
}>;

export const EMPTY_TUTORIAL_STATE: TutorialState = Object.freeze({
  completed: Object.freeze([]),
  active: null,
});

const MAX_COMPLETED = 64;
const MAX_STATE_BYTES = 4_096;
const LEGACY_TOUR_KEY_PREFIX = "nose-push:tour-seen:";

export function tutorialStateStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-tutorial-state-v1", userId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTutorialState(value: unknown): TutorialState {
  if (
    !isRecord(value) ||
    !Array.isArray(value.completed) ||
    value.completed.length > MAX_COMPLETED
  ) {
    throw new Error("Ungültiger Tutorial-Fortschritt.");
  }
  const completed: string[] = [];
  for (const entry of value.completed) {
    if (typeof entry !== "string" || !getTutorial(entry) || completed.includes(entry)) {
      throw new Error("Ungültiger Tutorial-Fortschritt.");
    }
    completed.push(entry);
  }
  let active: TutorialActiveRun | null = null;
  if (value.active !== null && value.active !== undefined) {
    if (
      !isRecord(value.active) ||
      typeof value.active.id !== "string" ||
      !getTutorial(value.active.id) ||
      typeof value.active.step !== "number" ||
      !Number.isInteger(value.active.step) ||
      value.active.step < 0 ||
      value.active.step >= (getTutorial(value.active.id)?.steps.length ?? 0)
    ) {
      throw new Error("Ungültiger Tutorial-Fortschritt.");
    }
    active = Object.freeze({ id: value.active.id, step: value.active.step });
  }
  return Object.freeze({
    completed: Object.freeze(completed),
    active,
  });
}

export function loadTutorialState(
  storage: Pick<Storage, "getItem">,
  userId: string,
): TutorialState {
  let state = EMPTY_TUTORIAL_STATE;
  try {
    const raw = storage.getItem(tutorialStateStorageKey(userId));
    if (raw !== null && raw.length <= MAX_STATE_BYTES) {
      state = parseTutorialState(JSON.parse(raw) as unknown);
    }
  } catch {
    state = EMPTY_TUTORIAL_STATE;
  }
  if (!state.completed.includes(MAIN_TUTORIAL_ID)) {
    for (const known of ALL_TUTORIALS) {
      try {
        if (storage.getItem(`${LEGACY_TOUR_KEY_PREFIX}${known.id}:${userId}`) === "1") {
          state = Object.freeze({
            ...state,
            completed: Object.freeze([...state.completed, known.id]),
          });
        }
      } catch {
        break;
      }
    }
    try {
      if (storage.getItem(`${LEGACY_TOUR_KEY_PREFIX}v2:${userId}`) === "1") {
        state = Object.freeze({
          ...state,
          completed: Object.freeze([...state.completed, MAIN_TUTORIAL_ID]),
        });
      }
    } catch {
      /* ignore legacy probe */
    }
  }
  return state;
}

export function saveTutorialState(
  storage: Pick<Storage, "setItem">,
  userId: string,
  state: TutorialState,
): void {
  const serialized = JSON.stringify(state);
  if (serialized.length > MAX_STATE_BYTES) {
    throw new Error("Tutorial-Fortschritt überschreitet das Speicherlimit.");
  }
  storage.setItem(tutorialStateStorageKey(userId), serialized);
}

export function startTutorial(state: TutorialState, id: string): TutorialState {
  if (!getTutorial(id)) throw new Error("Unbekanntes Tutorial.");
  return parseTutorialState({
    completed: state.completed,
    active: { id, step: 0 },
  });
}

export function advanceTutorial(state: TutorialState, id: string): TutorialState {
  const tutorial = getTutorial(id);
  if (!tutorial) throw new Error("Unbekanntes Tutorial.");
  if (state.active?.id !== id) return state;
  const next = state.active.step + 1;
  if (next >= tutorial.steps.length) {
    return parseTutorialState({
      completed: state.completed.includes(id) ? state.completed : [...state.completed, id],
      active: null,
    });
  }
  return parseTutorialState({ completed: state.completed, active: { id, step: next } });
}

export function completeTutorial(state: TutorialState, id: string): TutorialState {
  if (!getTutorial(id)) throw new Error("Unbekanntes Tutorial.");
  return parseTutorialState({
    completed: state.completed.includes(id) ? state.completed : [...state.completed, id],
    active: null,
  });
}

export function isTutorialCompleted(state: TutorialState, id: string): boolean {
  return state.completed.includes(id);
}

export function shouldAutoStartMainTour(
  state: TutorialState,
  storage: Pick<Storage, "getItem">,
  userId: string,
): boolean {
  if (state.active !== null || state.completed.includes(MAIN_TUTORIAL_ID)) return false;
  try {
    if (storage.getItem(`${LEGACY_TOUR_KEY_PREFIX}v2:${userId}`) === "1") return false;
  } catch {
    /* storage unavailable — start the tour */
  }
  return true;
}
