import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper for Supabase's beta `auth.oauth` namespace.
type OAuthDetails = {
  client?: { name?: string; client_uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate } as never);
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 text-sm text-muted-foreground">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Nose&nbsp;Push
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Connect {clientName} to your account?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This lets <span className="text-foreground">{clientName}</span> read your profile, list
          your workouts, and log new sessions as you.
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Bitte warten…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
