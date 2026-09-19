import { useCallback, useState } from "react";

export type ShareStats = {
  title: string;
  headline: string;
  subline: string;
  rows: { label: string; value: string }[];
};

/**
 * Erzeugt aus Trainingswerten eine teilbare Bildkarte (Canvas) und nutzt
 * das native Teilen-Menü, sonst Download.
 */
export function ShareCard({ stats, label = "Ergebnis teilen" }: { stats: ShareStats; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const share = useCallback(async () => {
    setBusy(true);
    setHint(null);
    try {
      const w = 1080;
      const h = 1350;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0b1020");
      grad.addColorStop(1, "#16243f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.arc(w * 0.85, h * 0.12, 260, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#8ab4ff";
      ctx.font = "600 34px system-ui, sans-serif";
      ctx.fillText(stats.title.toUpperCase(), 90, 170);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 130px system-ui, sans-serif";
      ctx.fillText(stats.headline, 90, 330);

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "400 40px system-ui, sans-serif";
      ctx.fillText(stats.subline, 90, 400);

      let y = 540;
      for (const row of stats.rows) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        roundRect(ctx, 90, y, w - 180, 130, 32);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font = "500 34px system-ui, sans-serif";
        ctx.fillText(row.label, 130, y + 58);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 52px system-ui, sans-serif";
        ctx.fillText(row.value, 130, y + 112);
        y += 156;
      }

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "500 34px system-ui, sans-serif";
      ctx.fillText("Nosy Push-Ups", 90, h - 90);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png"),
      );
      const file = new File([blob], "nosy-pushups.png", { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: stats.title, text: stats.subline });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nosy-pushups.png";
        a.click();
        URL.revokeObjectURL(url);
        setHint("Bild gespeichert");
      }
    } catch {
      setHint("Teilen nicht möglich");
    } finally {
      setBusy(false);
    }
  }, [stats]);

  return (
    <div>
      <button
        onClick={share}
        disabled={busy}
        className="w-full rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Erstelle Bild…" : `📤 ${label}`}
      </button>
      {hint && <p className="mt-1 text-center text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
