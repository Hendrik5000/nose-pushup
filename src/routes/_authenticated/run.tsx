import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/run")({
  head: () => ({
    meta: [
      { title: "Lauf aufzeichnen — Nose Push" },
      {
        name: "description",
        content: "Zeichne deine Läufe per GPS auf: Distanz, Tempo, Dauer und Kalorien in einer Ansicht.",
      },
      { property: "og:title", content: "Lauf aufzeichnen — Nose Push" },
      { property: "og:description", content: "GPS-Lauftracking mit Distanz, Tempo und Kalorien." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunPage,
});

type Point = { lat: number; lon: number; t: number };
type RunRow = {
  id: string;
  distance_m: number;
  duration_ms: number;
  calories: number;
  created_at: string;
};

function haversine(a: Point, b: Point) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return (h > 0 ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function RunPage() {
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState<number>(75);

  const points = useRef<Point[]>([]);
  const watchId = useRef<number | null>(null);
  const startTs = useRef<number>(0);
  const accumulated = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const loadRuns = async () => {
    const { data } = await supabase
      .from("runs")
      .select("id, distance_m, duration_ms, calories, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setRuns((data ?? []) as RunRow[]);
  };

  useEffect(() => {
    void loadRuns();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("weight_kg")
        .eq("id", u.user.id)
        .maybeSingle();
      if (p?.weight_kg) setWeight(Number(p.weight_kg));
    })();
  }, []);

  useEffect(() => {
    if (!active || paused) return;
    const id = window.setInterval(() => {
      setElapsed(accumulated.current + (Date.now() - startTs.current));
    }, 500);
    return () => window.clearInterval(id);
  }, [active, paused]);

  const start = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("Dein Gerät unterstützt kein GPS.");
      return;
    }
    setGpsError(null);
    points.current = [];
    setDistance(0);
    setElapsed(0);
    accumulated.current = 0;
    startTs.current = Date.now();
    setActive(true);
    setPaused(false);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracy(pos.coords.accuracy);
        if (pausedRef.current) return;
        if (pos.coords.accuracy > 40) return; // zu ungenau
        const p: Point = { lat: pos.coords.latitude, lon: pos.coords.longitude, t: Date.now() };
        const last = points.current[points.current.length - 1];
        if (last) {
          const d = haversine(last, p);
          if (d < 2 || d > 120) {
            if (d <= 2) return; // Rauschen
          }
          setDistance((x) => x + d);
        }
        points.current.push(p);
      },
      (err) => setGpsError(err.message || "GPS-Zugriff verweigert."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  };

  const togglePause = () => {
    if (paused) {
      startTs.current = Date.now();
      setPaused(false);
    } else {
      accumulated.current += Date.now() - startTs.current;
      setPaused(true);
    }
  };

  const stopWatch = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  useEffect(() => stopWatch, []);

  const finish = async () => {
    stopWatch();
    const total = paused ? accumulated.current : accumulated.current + (Date.now() - startTs.current);
    setActive(false);
    setPaused(false);
    if (distance < 10) {
      setElapsed(total);
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const km = distance / 1000;
      const calories = Math.round(km * weight * 1.036);
      await supabase.from("runs").insert({
        user_id: u.user.id,
        distance_m: Math.round(distance),
        duration_ms: Math.round(total),
        calories,
        path: points.current.slice(-500) as unknown as never,
      });
      await loadRuns();
    }
    setSaving(false);
    setDistance(0);
    setElapsed(0);
  };

  const km = distance / 1000;
  const paceMinPerKm = km > 0.02 ? elapsed / 60000 / km : 0;
  const kcal = Math.round(km * weight * 1.036);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          ← Start
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Laufen</span>
        <span className="w-12" />
      </header>

      <section className="mt-6 rounded-3xl border border-border bg-card/60 p-6 text-center backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Distanz</div>
        <div className="mt-1 font-display text-6xl font-bold tabular-nums">
          {km.toFixed(2)}
          <span className="ml-1 text-lg font-medium text-muted-foreground">km</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Zeit" value={fmtTime(elapsed)} />
          <Metric
            label="Pace"
            value={paceMinPerKm > 0 ? `${Math.floor(paceMinPerKm)}:${String(Math.round((paceMinPerKm % 1) * 60)).padStart(2, "0")}` : "—"}
            unit="/km"
          />
          <Metric label="Kcal" value={String(kcal)} />
        </div>

        {gpsError && <p className="mt-4 text-xs text-destructive">{gpsError}</p>}
        {active && accuracy !== null && (
          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            GPS-Genauigkeit ±{Math.round(accuracy)} m
          </p>
        )}

        {!active ? (
          <button
            onClick={start}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Speichere…" : "Lauf starten"}
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={togglePause}
              className="rounded-2xl border border-border bg-secondary px-4 py-4 text-sm font-semibold transition active:scale-[0.98]"
            >
              {paused ? "Fortsetzen" : "Pause"}
            </button>
            <button
              onClick={finish}
              className="rounded-2xl bg-accent px-4 py-4 text-sm font-semibold text-accent-foreground transition active:scale-[0.98]"
            >
              Beenden
            </button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Letzte Läufe
        </h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            Noch kein Lauf aufgezeichnet.
          </p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3"
              >
                <div>
                  <div className="text-base font-semibold tabular-nums">
                    {(r.distance_m / 1000).toFixed(2)} km
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("de-DE")}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="tabular-nums">{fmtTime(r.duration_ms)}</div>
                  <div className="tabular-nums">{r.calories} kcal</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 px-2 py-3">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {value}
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
