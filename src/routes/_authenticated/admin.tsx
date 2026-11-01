import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { AloHomeLink } from "@/components/AloHomeLink";
import {
  getAdminAreaAccess,
  getAdminRoleManagement,
  grantAdminAccess,
  revokeAdminAccess,
  type AdminRoleManagementResult,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await getAdminAreaAccess())) throw redirect({ to: "/" });
  },
  component: AdminOverview,
});

function AdminOverview() {
  const [roleAccess, setRoleAccess] = useState<AdminRoleManagementResult | null>(null);
  const [roleLoadError, setRoleLoadError] = useState(false);
  const [roleActionError, setRoleActionError] = useState("");
  const [roleActionNotice, setRoleActionNotice] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [roleMutationPending, setRoleMutationPending] = useState(false);

  useEffect(() => {
    let active = true;
    void getAdminRoleManagement()
      .then((result) => {
        if (active) setRoleAccess(result);
      })
      .catch(() => {
        if (active) setRoleLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refreshRoleAccess() {
    const result = await getAdminRoleManagement();
    setRoleAccess(result);
    if (!result.canManage) throw new Error("Not authorized");
  }

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoleMutationPending(true);
    setRoleActionError("");
    setRoleActionNotice("");
    try {
      await grantAdminAccess({ data: { userId: targetUserId.trim() } });
      await refreshRoleAccess();
      setTargetUserId("");
      setRoleActionNotice("Adminzugriff wurde vergeben.");
    } catch {
      setRoleActionError("Adminzugriff konnte nicht vergeben werden. Bitte die Konto-ID prüfen.");
    } finally {
      setRoleMutationPending(false);
    }
  }

  async function handleRevoke(userId: string) {
    if (!window.confirm(`Adminzugriff für ${userId} wirklich entziehen?`)) return;
    setRoleMutationPending(true);
    setRoleActionError("");
    setRoleActionNotice("");
    try {
      await revokeAdminAccess({ data: { userId } });
      await refreshRoleAccess();
      setRoleActionNotice("Adminzugriff wurde entzogen.");
    } catch {
      setRoleActionError("Adminzugriff konnte nicht entzogen werden.");
    } finally {
      setRoleMutationPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-5">
      <AloHomeLink />
      <header className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Alo</p>
            <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Der Admin-Bereich ist vorbereitet. Neue Verwaltungsfunktionen werden hier ergänzt und
          serverseitig nach Berechtigung geprüft.
        </p>
      </header>

      <section
        aria-labelledby="admin-sections-title"
        className="rounded-3xl border border-border bg-card/45 p-5 sm:p-7"
      >
        <h2 id="admin-sections-title" className="text-lg font-semibold">
          Verwaltungsbereiche
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Weitere Admin-Funktionen können hier ergänzt werden.
        </p>
      </section>

      {roleLoadError && (
        <p className="text-sm text-destructive" role="alert">
          Adminrollen konnten nicht geladen werden.
        </p>
      )}

      {roleAccess?.canManage && (
        <section
          aria-labelledby="admin-role-management-title"
          className="rounded-3xl border border-border bg-card/45 p-5 sm:p-7"
        >
          <h2 id="admin-role-management-title" className="text-lg font-semibold">
            Adminzugriffe verwalten
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Nur du kannst Adminzugriff vergeben oder entziehen. Verwende dafür die Alo-Konto-ID.
          </p>

          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleGrant}>
            <label className="sr-only" htmlFor="admin-target-user-id">
              Alo-Konto-ID für neuen Adminzugriff
            </label>
            <input
              id="admin-target-user-id"
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              maxLength={36}
              onChange={(event) => setTargetUserId(event.target.value)}
              pattern="[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
              placeholder="Alo-Konto-ID (UUID)"
              required
              value={targetUserId}
            />
            <button
              className="alo-btn min-h-11 shrink-0"
              disabled={roleMutationPending}
              type="submit"
            >
              Adminzugriff gewähren
            </button>
          </form>

          {roleActionError && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {roleActionError}
            </p>
          )}
          {roleActionNotice && (
            <p className="mt-4 text-sm text-foreground" aria-live="polite">
              {roleActionNotice}
            </p>
          )}

          <h3 className="mt-7 text-sm font-semibold">Aktuelle Admin-Konten</h3>
          {roleAccess.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Keine Admin-Konten gefunden.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {roleAccess.assignments.map((assignment) => (
                <li
                  key={assignment.userId}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <code className="break-all text-sm text-foreground">{assignment.userId}</code>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Admin seit {new Date(assignment.grantedAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  {assignment.canRevoke ? (
                    <button
                      aria-label={`Adminzugriff für ${assignment.userId} entziehen`}
                      className="alo-btn min-h-10 shrink-0"
                      disabled={roleMutationPending}
                      onClick={() => void handleRevoke(assignment.userId)}
                      type="button"
                    >
                      Entziehen
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      Eigener Zugriff
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
