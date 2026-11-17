/**
 * Zentrale Alo-App-Registry: eine Quelle der Wahrheit für Apps und Bereiche,
 * die über Routen erreichbar sind (Titel, Route, Aliasse). Genutzt von Miras
 * Computer-Use-Navigation; weitere Bereiche (Suche, Widgets, Berechtigungen)
 * können darauf aufbauen. Marketplace-Apps bleiben dynamisch (Katalog + Installs).
 */

export type AloAppRegistryEntry = Readonly<{
  id: string;
  title: string;
  route: string;
  aliases: readonly string[];
}>;

export const ALO_APP_REGISTRY: readonly AloAppRegistryEntry[] = Object.freeze([
  {
    id: "settings",
    title: "Einstellungen",
    route: "/profile",
    aliases: ["einstellungen", "settings", "profil"],
  },
  { id: "sports", title: "Alo Sports", route: "/sports", aliases: ["sport"] },
  {
    id: "football",
    title: "Alo Fußball",
    route: "/football",
    aliases: ["fußball", "fussball", "football"],
  },
  { id: "health", title: "Alo Health", route: "/health", aliases: ["health", "gesundheit"] },
  {
    id: "games",
    title: "Alo Spiele",
    route: "/games",
    aliases: ["spiele", "games", "grid defense", "kupferkern", "starfighter"],
  },
  {
    id: "marketplace",
    title: "Marketplace",
    route: "/marketplace",
    aliases: ["marketplace", "app store", "store"],
  },
  { id: "browser", title: "Browser", route: "/browser", aliases: ["browser", "internet"] },
  { id: "mira", title: "Mira", route: "/ai", aliases: ["mira", "ki-app"] },
  { id: "nexus", title: "Nexus", route: "/chat", aliases: ["nexus", "chat"] },
  { id: "training", title: "Training", route: "/training", aliases: ["training"] },
  { id: "tools", title: "Alo-Werkzeuge", route: "/tools", aliases: ["werkzeuge", "tools"] },
  { id: "home", title: "Start", route: "/", aliases: ["start", "home", "startbildschirm"] },
  {
    id: "exercises",
    title: "Übungen",
    route: "/exercises",
    aliases: ["übungen", "uebungen", "übung", "uebung"],
  },
  {
    id: "programs",
    title: "Programme",
    route: "/programs",
    aliases: ["programme", "trainingspläne", "trainingsplan"],
  },
  { id: "calisthenics", title: "Calisthenics", route: "/calisthenics", aliases: ["calisthenics"] },
  { id: "run", title: "Laufen", route: "/run", aliases: ["laufen", "running"] },
  { id: "season", title: "Saison", route: "/season", aliases: ["saison"] },
  { id: "battle", title: "Wettkampf", route: "/battle", aliases: ["wettkampf", "battle"] },
  {
    id: "battle-league",
    title: "Battle-Liga",
    route: "/battle-league",
    aliases: ["battle-liga", "battleliga"],
  },
  {
    id: "leaderboard",
    title: "Rangliste",
    route: "/leaderboard",
    aliases: ["rangliste", "bestenliste"],
  },
  { id: "clubs", title: "Clubs", route: "/clubs", aliases: ["clubs", "club"] },
  { id: "alarm", title: "Wecker", route: "/alarm", aliases: ["wecker", "alarm"] },
  { id: "admin", title: "Admin", route: "/admin", aliases: ["admin", "administration"] },
]);
