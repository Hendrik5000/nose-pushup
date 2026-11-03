export type SupabaseBackendEnv = {
  projectId?: string | null;
  url?: string | null;
};

const PROJECT_REF = /^[a-z0-9]{8,40}$/i;

/** Resolve only public backend identity; never include keys, tokens, query strings or paths. */
export function resolveSupabaseBackendScope({ projectId, url }: SupabaseBackendEnv): string | null {
  const configuredId = projectId?.trim() || null;
  if (configuredId && !PROJECT_REF.test(configuredId)) return null;

  let urlScope: string | null = null;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
      const supabaseHost = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
      urlScope = supabaseHost ? supabaseHost[1].toLowerCase() : parsed.origin.toLowerCase();
    } catch {
      return null;
    }
  }

  if (configuredId && urlScope && configuredId.toLowerCase() !== urlScope) return null;
  const scope = configuredId?.toLowerCase() ?? urlScope;
  return scope ? `supabase:${scope}` : null;
}

const publicEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

/** Build-time public identifiers are safe to use for local storage partitioning. */
export const SUPABASE_BACKEND_SCOPE = resolveSupabaseBackendScope({
  projectId: publicEnv?.VITE_SUPABASE_PROJECT_ID,
  url: publicEnv?.VITE_SUPABASE_URL,
});

/** Isolate local records by both backend and account; unconfigured storage is never cloud-synced. */
export function scopedStorageKey(prefix: string, userId: string, scope = SUPABASE_BACKEND_SCOPE) {
  const backend = scope ?? "unconfigured";
  return `${prefix}:v2:${encodeURIComponent(backend)}:${encodeURIComponent(userId)}`;
}
