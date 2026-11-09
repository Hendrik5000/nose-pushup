import { useEffect, useState } from "react";
import {
  chooseDecision,
  createPersonalToolId,
  formatWorldClock,
  isValidTimeZone,
  loadPersonalTool,
  localDateKey,
  milestoneDistance,
  parseChecklistItems,
  recentLocalDateKeys,
  savePersonalTool,
  type ChecklistTemplate,
  type HabitEntry,
  type IfThenPlan,
  type Milestone,
  type PersonalToolData,
  type PersonalToolName,
  type WorldClock,
} from "@/lib/dashboard-personal-tools";

function usePersonalTool<K extends PersonalToolName>(userId: string, kind: K) {
  const [value, setValue] = useState<PersonalToolData[K]>(() => loadPersonalTool(userId, kind));
  const [status, setStatus] = useState("");
  useEffect(() => {
    setValue(loadPersonalTool(userId, kind));
    setStatus("");
  }, [kind, userId]);
  const update = (next: PersonalToolData[K]) => {
    setValue(next);
    setStatus(
      savePersonalTool(userId, kind, next)
        ? "Auf diesem Gerät gespeichert."
        : "Browser-Speicher nicht verfügbar; Änderung bleibt nur vorübergehend sichtbar.",
    );
  };
  return { value, update, status };
}

function Card({
  title,
  children,
  status,
}: {
  title: string;
  children: React.ReactNode;
  status: string;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-card/70 p-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Nur in diesem Browser und getrennt je Konto gespeichert. {status}
      </p>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 80,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  secondary = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        secondary
          ? "border border-border bg-secondary/50 text-foreground"
          : "bg-primary text-primary-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function HabitTracker({ userId }: { userId: string }) {
  const { value: habits, update, status } = usePersonalTool(userId, "habitTracker");
  const [title, setTitle] = useState("");
  const today = localDateKey();
  const dates = recentLocalDateKeys();
  const addHabit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name || name.length > 48) return;
    update([...habits, { id: createPersonalToolId("habit"), title: name, completedDates: [] }]);
    setTitle("");
  };
  const toggle = (habit: HabitEntry) => {
    const completedDates = habit.completedDates.includes(today)
      ? habit.completedDates.filter((date) => date !== today)
      : [...habit.completedDates, today].slice(-120);
    update(habits.map((item) => (item.id === habit.id ? { ...item, completedDates } : item)));
  };
  return (
    <Card title="Alltagsrituale" status={status}>
      <form onSubmit={addHabit} className="flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Neue Gewohnheit"
          maxLength={48}
          placeholder="z. B. spazieren gehen"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <ActionButton type="submit" disabled={!title.trim()}>
          Hinzufügen
        </ActionButton>
      </form>
      {habits.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Lege eine kleine Routine fest und hake sie bei Bedarf ab.
        </p>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const recentCount = dates.filter((date) => habit.completedDates.includes(date)).length;
            const done = habit.completedDates.includes(today);
            return (
              <li
                key={habit.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 p-3"
              >
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => toggle(habit)}
                  className={`min-h-11 min-w-11 rounded-xl border text-sm font-bold ${done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                >
                  {done ? "✓" : "○"}
                  <span className="sr-only">{done ? "Heute erledigt" : "Heute abhaken"}</span>
                </button>
                <span className="min-w-0 flex-1 text-sm">{habit.title}</span>
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {recentCount}/7
                  <br />7 Tage
                </span>
                <button
                  type="button"
                  aria-label={`${habit.title} entfernen`}
                  onClick={() => update(habits.filter((item) => item.id !== habit.id))}
                  className="min-h-11 min-w-11 rounded-lg text-muted-foreground"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function IfThenPlanner({ userId }: { userId: string }) {
  const { value, update, status } = usePersonalTool(userId, "ifThenPlan");
  const [trigger, setTrigger] = useState(value?.trigger ?? "");
  const [action, setAction] = useState(value?.action ?? "");
  const [fallback, setFallback] = useState(value?.fallback ?? "");
  useEffect(() => {
    setTrigger(value?.trigger ?? "");
    setAction(value?.action ?? "");
    setFallback(value?.fallback ?? "");
  }, [value]);
  const save = () => {
    const plan: IfThenPlan = {
      trigger: trigger.trim(),
      action: action.trim(),
      fallback: fallback.trim(),
    };
    if (plan.trigger && plan.action) update(plan);
  };
  return (
    <Card title="Wenn–dann-Plan" status={status}>
      <p className="text-xs text-muted-foreground">
        Eine Hürde und ein machbarer nächster Schritt – ohne Erinnerung oder Benachrichtigung.
      </p>
      <TextField
        label="Wenn …"
        value={trigger}
        onChange={setTrigger}
        placeholder="… ich nach Hause komme"
      />
      <TextField
        label="Dann …"
        value={action}
        onChange={setAction}
        placeholder="… gehe ich 10 Minuten spazieren"
      />
      <TextField
        label="Meine kleine Variante (optional)"
        value={fallback}
        onChange={setFallback}
        placeholder="… reichen auch 2 Minuten"
      />
      <div className="flex gap-2">
        <ActionButton onClick={save} disabled={!trigger.trim() || !action.trim()}>
          Plan speichern
        </ActionButton>
        <ActionButton secondary onClick={() => update(null)} disabled={!value}>
          Löschen
        </ActionButton>
      </div>
      {value && (
        <p className="rounded-xl bg-secondary/50 p-3 text-sm">
          Wenn {value.trigger}, dann {value.action}
          {value.fallback ? ` (kleine Variante: ${value.fallback})` : ""}.
        </p>
      )}
    </Card>
  );
}

function ChecklistTemplates({ userId }: { userId: string }) {
  const { value: templates, update, status } = usePersonalTool(userId, "checklistTemplates");
  const [title, setTitle] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [active, setActive] = useState<ChecklistTemplate | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const items = active?.items ?? [];
  const addTemplate = (event: React.FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    const parsed = parseChecklistItems(itemsText);
    if (!name || parsed.length === 0) return;
    update([
      ...templates,
      { id: createPersonalToolId("checklist"), title: name.slice(0, 48), items: parsed },
    ]);
    setTitle("");
    setItemsText("");
  };
  return (
    <Card title="Checklisten-Vorlagen" status={status}>
      <form onSubmit={addTemplate} className="space-y-2">
        <TextField
          label="Vorlagenname"
          value={title}
          onChange={setTitle}
          placeholder="z. B. Trainingstasche"
          maxLength={48}
        />
        <label className="block space-y-1 text-xs text-muted-foreground">
          <span>Ein Punkt pro Zeile (höchstens 12)</span>
          <textarea
            value={itemsText}
            onChange={(event) => setItemsText(event.target.value)}
            rows={3}
            placeholder={"Trinkflasche\nHandtuch\nKopfhörer"}
            className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
          />
        </label>
        <ActionButton
          type="submit"
          disabled={!title.trim() || parseChecklistItems(itemsText).length === 0}
        >
          Vorlage anlegen
        </ActionButton>
      </form>
      {active ? (
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{active.title}</h3>
            <ActionButton secondary onClick={() => setChecked([])}>
              Abhakliste zurücksetzen
            </ActionButton>
          </div>
          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <li key={item}>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(item)}
                    onChange={() =>
                      setChecked((current) =>
                        current.includes(item)
                          ? current.filter((value) => value !== item)
                          : [...current, item],
                      )
                    }
                    className="size-5 accent-primary"
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="mt-2 min-h-11 text-sm text-primary"
          >
            Vorlagenliste
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center gap-2 rounded-xl border border-border/70 p-3"
            >
              <button
                type="button"
                onClick={() => {
                  setActive(template);
                  setChecked([]);
                }}
                className="min-h-11 min-w-0 flex-1 text-left text-sm font-medium"
              >
                {template.title}
                <span className="block text-xs text-muted-foreground">
                  {template.items.length} Punkte
                </span>
              </button>
              <button
                type="button"
                aria-label={`${template.title} löschen`}
                onClick={() => update(templates.filter((item) => item.id !== template.id))}
                className="min-h-11 min-w-11 rounded-lg text-muted-foreground"
              >
                ×
              </button>
            </li>
          ))}
          {templates.length === 0 && (
            <li className="text-xs text-muted-foreground">
              Erstelle eine Vorlage und verwende sie bei Bedarf erneut.
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function DecisionPicker({ userId }: { userId: string }) {
  const { value: options, update, status } = usePersonalTool(userId, "decisionPicker");
  const [draft, setDraft] = useState(options.join("\n"));
  const [result, setResult] = useState("");
  useEffect(() => setDraft(options.join("\n")), [options]);
  const save = () => {
    const cleaned = parseChecklistItems(draft).slice(0, 30);
    update(cleaned);
    setResult("");
  };
  return (
    <Card title="Entscheidungshilfe" status={status}>
      <p className="text-xs text-muted-foreground">
        Alo wählt zufällig aus deiner eigenen Liste. Es wird nichts bewertet oder geteilt.
      </p>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>Eine Möglichkeit pro Zeile</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          maxLength={1200}
          placeholder={"Spaziergang\nLesen\nMusik hören"}
          className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton secondary onClick={save}>
          Liste speichern
        </ActionButton>
        <ActionButton
          disabled={options.length === 0}
          onClick={() => setResult(chooseDecision(options) ?? "")}
        >
          Auswählen
        </ActionButton>
      </div>
      {result && (
        <p role="status" className="rounded-xl bg-primary/10 p-3 text-base font-semibold">
          Vorschlag: {result}
        </p>
      )}
    </Card>
  );
}

function MilestonesCard({ userId }: { userId: string }) {
  const { value: milestones, update, status } = usePersonalTool(userId, "milestones");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [repeatYearly, setRepeatYearly] = useState(false);
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !milestoneDistance({ date, repeatYearly })) return;
    const item: Milestone = {
      id: createPersonalToolId("milestone"),
      title: title.trim().slice(0, 48),
      date,
      repeatYearly,
    };
    update([...milestones, item]);
    setTitle("");
    setDate("");
  };
  return (
    <Card title="Persönliche Meilensteine" status={status}>
      <form onSubmit={add} className="space-y-2">
        <TextField
          label="Ereignis"
          value={title}
          onChange={setTitle}
          placeholder="z. B. Prüfung"
          maxLength={48}
        />
        <label className="block space-y-1 text-xs text-muted-foreground">
          <span>Datum</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={repeatYearly}
            onChange={(event) => setRepeatYearly(event.target.checked)}
            className="size-5 accent-primary"
          />
          Wiederholt sich jedes Jahr
        </label>
        <ActionButton type="submit" disabled={!title.trim() || !date}>
          Meilenstein hinzufügen
        </ActionButton>
      </form>
      <ul className="space-y-2">
        {milestones.map((item) => {
          const distance = milestoneDistance(item);
          const label = !distance
            ? "Datum ungültig"
            : distance.direction === "today"
              ? "Heute"
              : distance.direction === "until"
                ? `Noch ${distance.days} ${distance.days === 1 ? "Tag" : "Tage"}`
                : `Seit ${distance.days} ${distance.days === 1 ? "Tag" : "Tagen"}`;
          return (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-border/70 p-3"
            >
              <span className="min-w-0 flex-1 text-sm">
                {item.title}
                <span className="block text-xs text-muted-foreground">
                  {label}
                  {item.repeatYearly ? " · jährlich" : ""}
                </span>
              </span>
              <button
                type="button"
                aria-label={`${item.title} löschen`}
                onClick={() => update(milestones.filter((value) => value.id !== item.id))}
                className="min-h-11 min-w-11 rounded-lg text-muted-foreground"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function WorldClockCard({ userId }: { userId: string }) {
  const { value: clocks, update, status } = usePersonalTool(userId, "worldClock");
  const [zone, setZone] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const addZone = (event: React.FormEvent) => {
    event.preventDefault();
    const value = zone.trim();
    if (!isValidTimeZone(value)) {
      setError("Bitte eine gültige IANA-Zeitzone eingeben, z. B. Europe/London.");
      return;
    }
    if (clocks.some((item) => item.zone.toLowerCase() === value.toLowerCase())) {
      setError("Diese Zeitzone ist bereits gespeichert.");
      return;
    }
    const item: WorldClock = { id: createPersonalToolId("zone"), zone: value };
    update([...clocks, item]);
    setZone("");
    setError("");
  };
  return (
    <Card title="Weltuhr" status={status}>
      <form onSubmit={addZone} className="flex gap-2">
        <input
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          aria-label="IANA-Zeitzone hinzufügen"
          placeholder="Europe/London"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <ActionButton type="submit" disabled={!zone.trim()}>
          Hinzufügen
        </ActionButton>
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {clocks.map((item) => {
          const formatted = formatWorldClock(item.zone, now);
          const label = item.zone.split("/").at(-1)?.replaceAll("_", " ") ?? item.zone;
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 p-3"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {item.zone} · {formatted?.day ?? "Zeitzone nicht verfügbar"}
                </span>
              </div>
              <time className="text-lg font-semibold tabular-nums">{formatted?.time ?? "—"}</time>
              {clocks.length > 1 && (
                <button
                  type="button"
                  aria-label={`${item.zone} entfernen`}
                  onClick={() => update(clocks.filter((value) => value.id !== item.id))}
                  className="min-h-11 min-w-11 rounded-lg text-muted-foreground"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Die Uhr aktualisiert sich höchstens einmal pro Minute.
      </p>
    </Card>
  );
}

export function PersonalUtilityCard({
  kind,
  userId,
}: {
  kind: PersonalToolName;
  userId: string | null;
}) {
  if (!userId) return null;
  switch (kind) {
    case "habitTracker":
      return <HabitTracker userId={userId} />;
    case "ifThenPlan":
      return <IfThenPlanner userId={userId} />;
    case "checklistTemplates":
      return <ChecklistTemplates userId={userId} />;
    case "decisionPicker":
      return <DecisionPicker userId={userId} />;
    case "milestones":
      return <MilestonesCard userId={userId} />;
    case "worldClock":
      return <WorldClockCard userId={userId} />;
  }
}
