export function DesignStylePicker() {
  return (
    <section
      className="design-style-picker rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
      aria-labelledby="alo-design-title"
    >
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <span className="text-xl font-semibold">A</span>
        </span>
        <div className="min-w-0">
          <h3 id="alo-design-title" className="text-base font-semibold">
            Alo Modern
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Ein einheitliches, minimalistisches Design für die gesamte Website – mit klarer
            Typografie, großzügigen Abständen und ruhigen, hochwertigen Oberflächen.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Einheitliches Design aktiv
          </p>
        </div>
      </div>
    </section>
  );
}
