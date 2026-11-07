export function MiraSpeechPrivacySettings() {
  return (
    <section
      className="mt-4 rounded-xl border border-border/70 bg-background/50 p-3 text-sm"
      aria-label="Spracheingabe und Datenschutz"
    >
      <h3 className="font-semibold">Spracheingabe &amp; Datenschutz</h3>
      <p className="mt-1 text-muted-foreground">
        Für Diktat und Freisprechen nutzt Mira die SpeechRecognition-Schnittstelle deines Browsers.
        Je nach Browser kann Audio an dessen Spracherkennungsdienst übertragen werden; eine lokale
        Verarbeitung ist nicht garantiert. Mira erhält erkannten Text, keine rohe Mikrofonaufnahme.
      </p>
      <p className="mt-2 text-muted-foreground">
        Beim Diktat bleibt der Text bearbeitbar im Composer und wird erst nach deinem normalen Tipp
        auf „Senden“ an Mira übermittelt. Freisprechen ist ein separater, bewusst gestarteter Modus;
        dein normaler Entwurf und vorhandene Anhänge werden dabei nicht mitgesendet.
      </p>
    </section>
  );
}
