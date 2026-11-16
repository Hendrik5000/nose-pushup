export type TikTokLink = { url: string; videoId: string | null };

export type TikTokOEmbed = {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
};

const TIKTOK_URL_RE = /https?:\/\/(?:www\.|vm\.|m\.)?tiktok\.com\/[^\s<>"')\]]+/gi;
const VIDEO_ID_RE = /\/video\/(\d+)/;
const MOBILE_VIDEO_ID_RE = /\/v\/(\d+)(?:\.html)?/;
const TRAILING_PUNCT_RE = /[.,;:!?)\]]+$/;

/** Extrahiert alle TikTok-Links aus einem Nachrichtentext (dedupliziert, Reihenfolge bleibt erhalten). */
export function extractTikTokLinks(content: string): TikTokLink[] {
  if (!content) return [];
  const seen = new Set<string>();
  const links: TikTokLink[] = [];
  for (const match of content.matchAll(TIKTOK_URL_RE)) {
    const url = match[0].replace(TRAILING_PUNCT_RE, "");
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id = VIDEO_ID_RE.exec(url) ?? MOBILE_VIDEO_ID_RE.exec(url);
    links.push({ url, videoId: id ? id[1] : null });
  }
  return links;
}

/** Offizielle TikTok-Embed-URL für ein Video (ohne externes Skript, CSP-freundlich). */
export function tiktokEmbedSrc(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}

/** oEmbed-Endpunkt für Kurzlinks (vm.tiktok.com) ohne API-Key. */
export function tiktokOEmbedUrl(url: string): string {
  return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
}
