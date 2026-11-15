import { useEffect, useMemo, useState } from "react";
import {
  extractTikTokLinks,
  tiktokEmbedSrc,
  tiktokOEmbedUrl,
  type TikTokLink,
  type TikTokOEmbed,
} from "@/lib/link-embeds";

/** Fallback für Kurzlinks (vm.tiktok.com): oEmbed-Vorschau mit Titel/Thumbnail. */
function ShortTikTokCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<TikTokOEmbed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(tiktokOEmbedUrl(url))
      .then((r) => (r.ok ? (r.json() as Promise<TikTokOEmbed>) : Promise.reject(new Error("oembed failed"))))
      .then((data) => {
        if (alive) setMeta(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-[340px] items-center gap-3 rounded-xl border border-border bg-card/60 p-2 transition hover:border-primary/60"
    >
      {meta?.thumbnail_url && (
        <img
          src={meta.thumbnail_url}
          alt=""
          loading="lazy"
          className="h-16 w-16 rounded-lg object-cover"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {meta?.title || "TikTok-Video"}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {failed ? url : meta?.author_name ? `${meta.author_name} · TikTok` : "TikTok-Kurzlink wird geladen …"}
        </span>
      </span>
    </a>
  );
}

function TikTokEmbed({ link }: { link: TikTokLink }) {
  if (link.videoId) {
    return (
      <iframe
        src={tiktokEmbedSrc(link.videoId)}
        title="TikTok-Video"
        loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-[560px] w-full max-w-[340px] rounded-xl border border-border bg-black"
      />
    );
  }
  return <ShortTikTokCard url={link.url} />;
}

/** Rendert alle TikTok-Links einer Nachricht als Embeds (mehrere Links möglich). */
export function MessageLinkEmbeds({ content }: { content: string }) {
  const links = useMemo(() => extractTikTokLinks(content), [content]);
  if (links.length === 0) return null;
  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      {links.map((link) => (
        <TikTokEmbed key={link.url} link={link} />
      ))}
    </div>
  );
}
