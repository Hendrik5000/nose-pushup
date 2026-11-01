const GUIDE_TOPICS = [
  {
    title: "Startseite & Bereiche",
    body: "Auf der Alo-Startseite öffnest du Mira, Nexus Chat, Alo Health oder die Einstellungen. Über den Link „Zur Alo-Startseite“ kommst du aus den Bereichen zurück. Auf einer freien Stelle kannst du außerdem horizontal zwischen Training, Mira und Nexus wechseln; Eingaben und aktive Workouts bleiben dabei geschützt.",
  },
  {
    title: "Training & Fortschritt",
    body: "Öffne Alo Health für Übungen und Training. Auf der Startseite findest du die Trainingsübersicht und den Gym-Partnerbereich. Trainingsdaten und Partnerwerte bleiben getrennt; teile nur die Werte, die du ausdrücklich freigibst.",
  },
  {
    title: "Mira & Datenfreigabe",
    body: "Mira hilft bei Alltag, Wissen, Schreiben und Ideen. Deine Frage wird erst gesendet, wenn du sie abschickst. Trainings-, Gesundheits- und Nexus-Daten werden nicht automatisch angehängt; eine Freigabe steuerst du separat in Miras Einstellungen. Dateien bleiben bis zum bewussten Senden auf deinem Gerät.",
  },
  {
    title: "Nexus Chat",
    body: "Nexus unterscheidet lokale Inhalte von Cloud-Chats. Achte auf den angezeigten Status: Nur eine bestätigte Cloud-Zustellung ist wirklich verschickt; lokal gespeicherte Nachrichten bleiben lokal.",
  },
  {
    title: "Einstellungen & Personalisierung",
    body: "Nutze die Rubrik-Chips für den direkten Sprung und tippe auf einen Bereich, um seine Optionen zu öffnen. Deine Auswahl bleibt anpassbar: sechs Designstile, 13 Farbwelten, vier Navigationslayouts sowie persönliche Widgets im Trainingsbereich. „Klassisch“ bleibt als Stil verfügbar.",
  },
  {
    title: "Installieren, Hilfe & Fehlerberichte",
    body: "Wenn dein Browser es anbietet, kannst du Alo über sein Menü mit „App installieren“ oder „Zum Startbildschirm hinzufügen“ auf dein Gerät legen. Die Willkommenstour lässt sich unter Profil → Hilfe erneut starten. Unter Profil → Fehlerberichte kannst du Einträge ansehen und manuell kopieren; prüfe persönliche Inhalte, bevor du etwas teilst.",
  },
] as const;

export function AloWebAppGuide() {
  return (
    <section aria-label="Kurzanleitung für die Alo-Web-App" className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Die wichtigsten Wege kurz erklärt. Öffne nur den Abschnitt, den du gerade brauchst.
      </p>
      {GUIDE_TOPICS.map((topic) => (
        <details
          key={topic.title}
          className="rounded-2xl border border-border bg-background/40 px-3"
        >
          <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-semibold text-foreground">
            {topic.title}
          </summary>
          <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{topic.body}</p>
        </details>
      ))}
    </section>
  );
}
