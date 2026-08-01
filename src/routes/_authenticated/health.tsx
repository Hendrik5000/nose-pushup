import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Health Connect — Nose Push" },
      {
        name: "description",
        content: "Verbinde Schritte, aktive Kalorien, Schlaf und Gewicht mit deinem Push-Up-Training.",
      },
      { property: "og:title", content: "Health Connect — Nose Push" },
      { property: "og:description", content: "Gesundheitsdaten mit deinem Training zusammenführen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

type Entry = {
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function HealthPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [day, setDay] = useState(today());
  const [steps, setSteps] = useState("");
  const [kcal, setKcal] = useState("");
  const [weight, setWeight] = useState("");
  const [sleepH, setSleepH] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("health_entries")
      .select("day, steps, active_kcal, weight_kg, sleep_min, source")
      .order("day", { ascending: false })
      .limit(14);
    setEntries((data ?? []) as Entry[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: u.user.id,
      day,
      steps: Math.max(0, Math.min(200000, parseInt(steps || "0", 10) || 0)),
      active_kcal: Math.max(0, Math.min(20000, parseInt(kcal || "0", 10) || 0)),
      weight_kg: weight ? Math.max(20, Math.min(400, parseFloat(weight))) : null,
      sleep_min: Math.max(0, Math.min(1440, Math.round((parseFloat(sleepH || "0") || 0) * 60))),
      source: "manual",
    };
    const { error } = await supabase
      .from("health_entries")
      .upsert(payload, { onConflict: "user_id,day" });
    setBusy(false);
    if (error) {
      setMsg("Speichern fehlgeschlagen.");
      return;
    }
    if (payload.weight_kg) {
      await supabase.from("profiles").update({ weight_kg: payload.weight_kg }).eq("id", u.user.id);
    }
    setMsg("Gesundheitsdaten gespeichert ✓");
    setSteps("");
    setKcal("");
    setSleepH("");
    void load();
  };

  const week = entries.slice(0, 7);
  const avgSteps = week.length ? Math.round(week.reduce((s, e) => s + e.steps, 0) / week.length) : 0;
  const avgSleep = week.length ? week.reduce((s, e) => s + e.sleep_min, 0) / week.length / 60 : 0;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          ← Start
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Health Connect</span>
        <span className="w-12" />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Card label="Ø Schritte (7T)" value={avgSteps.toLocaleString("de-DE")} />
        <Card label="Ø Schlaf (7T)" value={`${avgSleep.toFixed(1)} h`} />
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Tag erfassen
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input label="Datum" type="date" value={day} onChange={setDay} />
          <Input label="Schritte" type="number" value={steps} onChange={setSteps} placeholder="8000" />
          <Input label="Aktive kcal" type="number" value={kcal} onChange={setKcal} placeholder="450" />
          <Input label="Schlaf (h)" type="number" value={sleepH} onChange={setSleepH} placeholder="7.5" />
          <Input label="Gewicht (kg)" type="number" value={weight} onChange={setWeight} placeholder="78" />
        </div>
        {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
        <button
          onClick={save}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Speichere…" : "Speichern"}
        </button>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card/40 p-5 text-xs leading-relaxed text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Mit Health Connect verbinden</h2>
        <p>
          Health Connect (Android) und Apple Health geben ihre Daten nur an installierte Apps mit
          System-Berechtigung weiter — eine Web-App wie diese kann sie nicht direkt auslesen.
          So bekommst du deine Daten trotzdem rein:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Health Connect öffnen → „Daten und Zugriff" → Schritte / Kalorien / Schlaf ansehen.</li>
          <li>Werte oben für den jeweiligen Tag eintragen — dauert 10 Sekunden.</li>
          <li>Der Smart Coach nutzt Schritte, Schlaf und Gewicht automatisch für seine Empfehlungen.</li>
        </ol>
        <p className="mt-2">
          Deine Läufe zeichnet die App per GPS selbst auf — dafür brauchst du Health Connect nicht.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Verlauf
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            Noch keine Gesundheitsdaten.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.day}
                className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3 text-xs"
              >
                <span className="font-semibold">
                  {new Date(e.day).toLocaleDateString("de-DE")}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {e.steps.toLocaleString("de-DE")} Schritte · {e.active_kcal} kcal ·{" "}
                  {(e.sleep_min / 60).toFixed(1)} h
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-4 py-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
