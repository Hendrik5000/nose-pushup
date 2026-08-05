import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; name: string; reps: number; sessions: number; self: boolean };

/** Live-Feed: heutige Push-Ups von dir und deinen Freunden (Realtime). */
export function FriendActivity({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    const { data: fr } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("status", "accepted");

    const friendIds = (fr ?? [])
      .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id))
      .filter((id): id is string => !!id);

    const ids = [userId, ...friendIds];

    const [{ data: profs }, { data: stats }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", ids),
      supabase.from("daily_stats").select("user_id, total_reps, sessions").eq("day", today).in("user_id", ids),
    ]);

    const nameOf = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Athlet"]));
    const statOf = new Map((stats ?? []).map((s) => [s.user_id, s]));

    const list: Row[] = ids.map((id) => {
      const s = statOf.get(id);
      return {
        id,
        name: id === userId ? "Du" : (nameOf.get(id) ?? "Freund"),
        reps: s?.total_reps ?? 0,
        sessions: s?.sessions ?? 0,
        self: id === userId,
      };
    });

    list.sort((a, b) => b.reps - a.reps);
    setRows(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("daily-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const max = Math.max(1, ...rows.map((r) => r.reps));

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Heute live
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Live
        </span>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Lade…</p>
      ) : rows.length <= 1 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Noch kein sozialer Vergleich aktiv. Lade Freunde ein und starte den nächsten gemeinsamen Push-Up-Tag.
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <span className="font-semibold">Gemeinsam stärker:</span> Kleine tägliche Sessions mit Freunden machen den Fortschritt deutlich angenehmer.
          </div>
          <ul className="mt-3 space-y-2.5">
        <p className="mt-3 text-xs text-muted-foreground">
          Füge Freunde hinzu, um eure Push-Ups über den Tag live zu vergleichen.
        </p>
      ) : (
          <ul className="mt-3 space-y-2.5">
            {rows.map((r, i) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className={r.self ? "font-semibold text-primary" : "text-foreground"}>
                    {i === 0 && r.reps > 0 ? "👑 " : ""}
                    {r.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.reps} Reps · {r.sessions} Sets
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${r.self ? "bg-primary" : "bg-accent"}`}
                    style={{ width: `${(r.reps / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
