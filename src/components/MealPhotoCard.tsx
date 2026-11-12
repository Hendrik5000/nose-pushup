import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeMeal } from "@/lib/meal.functions";

type Meal = { id: string; title: string; kcal: number; protein_g: number; tip: string | null };

const todayStr = () => new Date().toISOString().slice(0, 10);

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function MealPhotoCard() {
  const analyze = useServerFn(analyzeMeal);
  const input = useRef<HTMLInputElement>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("meal_logs")
      .select("id, title, kcal, protein_g, tip")
      .eq("day", todayStr())
      .order("created_at", { ascending: false });
    setMeals((data as Meal[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const image = await shrink(file);
      const est = await analyze({ data: { image } });
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Bitte anmelden.");
      const { error } = await supabase.from("meal_logs").insert({
        user_id: u.user.id,
        day: todayStr(),
        title: est.title,
        kcal: est.kcal,
        protein_g: est.protein_g,
        tip: est.tip,
      });
      if (error) throw error;
      setMsg(est.tip || null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Analyse fehlgeschlagen.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (id: string) => {
    await supabase.from("meal_logs").delete().eq("id", id);
    await load();
  };

  const protein = meals.reduce((s, m) => s + m.protein_g, 0);
  const kcal = meals.reduce((s, m) => s + m.kcal, 0);

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ernährung heute
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {protein} g Protein · {kcal} kcal
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Foto machen – Mira schätzt Energie und Protein (ungefähre Werte).
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
          {busy ? "Analysiere…" : "Mahlzeit"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {msg && <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm">{msg}</p>}
      {meals.length > 0 && (
        <ul className="mt-3 space-y-2">
          {meals.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{m.title}</span>
              <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                {m.protein_g} g · {m.kcal} kcal
                <button type="button" aria-label="Löschen" onClick={() => void remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
