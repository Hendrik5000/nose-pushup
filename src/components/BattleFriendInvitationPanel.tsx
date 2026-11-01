import { useCallback, useEffect, useState } from "react";
import type { BattleMode } from "@/lib/battle.functions";
import { modeDefaults } from "@/lib/battle.functions";
import {
  type BattleInvitationDashboard,
  type IncomingBattleInvitation,
  type SentBattleInvitation,
} from "@/lib/battle-invitation-client";
import { battleInvitationClient } from "@/lib/battle-invitations-runtime";
import { BackendNotReadyError } from "@/lib/friends/rpc";
import { Link } from "@tanstack/react-router";

export type BattleFriendInvitationPanelProps = {
  mode: BattleMode;
  durationS: number;
  targetReps: number;
  onOpenBattle: (battleId: string) => void;
};

const MODE_LABELS: Record<BattleMode, string> = {
  timed: "Zeitduell",
  first_to: "Erster auf Ziel",
  sprint: "Sprint",
  endurance: "Ausdauer",
};

function statusLabel(status: SentBattleInvitation["status"]) {
  switch (status) {
    case "pending":
      return "Ausstehend";
    case "accepted":
      return "Angenommen";
    case "declined":
      return "Abgelehnt";
    case "cancelled":
      return "Zurückgezogen / beendet";
    case "expired":
      return "Abgelaufen";
  }
}

export function BattleFriendInvitationPanel({
  mode,
  durationS,
  targetReps,
  onOpenBattle,
}: BattleFriendInvitationPanelProps) {
  const [dashboard, setDashboard] = useState<BattleInvitationDashboard | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await battleInvitationClient.loadDashboard();
      setDashboard(next);
      setNotReady(false);
      setError(null);
      return next;
    } catch (caught) {
      if (caught instanceof BackendNotReadyError) setNotReady(true);
      else
        setError(
          "Freunde oder Battle-Einladungen konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.",
        );
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const update = async (silent = false) => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const next = await battleInvitationClient.loadDashboard();
        if (!active) return;
        setDashboard(next);
        setNotReady(false);
        setError(null);
      } catch (caught) {
        if (active) {
          if (caught instanceof BackendNotReadyError) setNotReady(true);
          else
            setError(
              "Freunde oder Battle-Einladungen konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.",
            );
        }
      } finally {
        inFlight = false;
        if (active && !silent) setLoading(false);
      }
    };
    void update();
    const interval = window.setInterval(() => void update(true), 30_000);
    const retryWhenAvailable = () => void update(true);
    window.addEventListener("focus", retryWhenAvailable);
    window.addEventListener("online", retryWhenAvailable);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", retryWhenAvailable);
      window.removeEventListener("online", retryWhenAvailable);
    };
  }, []);

  const sendInvitation = async (friend: { id: string; displayName: string | null }) => {
    if (busy) return;
    setBusy(`send-${friend.id}`);
    setError(null);
    setNotice(null);
    try {
      await battleInvitationClient.sendInvitation({
        recipientId: friend.id,
        mode,
        durationS: mode === "timed" ? durationS : modeDefaults(mode).duration_s,
        targetReps: mode === "first_to" ? targetReps : modeDefaults(mode).target_reps,
      });
      setNotice(
        `Die Einladung wurde an ${friend.displayName?.trim() || "deinen Freund"} gesendet. Bei deinem Freund erscheint sofort ein Pop-up, und sie läuft nach 24 Stunden ab.`,
      );
      await refresh(true);
    } catch (caught) {
      if (caught instanceof BackendNotReadyError) setNotReady(true);
      else
        setError(
          "Die Einladung konnte nicht gesendet werden. Prüfe, ob die Freundschaft noch bestätigt ist, und versuche es erneut.",
        );
    } finally {
      setBusy(null);
    }
  };

  const answerInvitation = async (invitation: IncomingBattleInvitation, accept: boolean) => {
    if (busy) return;
    setBusy(invitation.id);
    setError(null);
    setNotice(null);
    try {
      const response = await battleInvitationClient.respondToInvitation(
        invitation.id,
        invitation.senderId,
        accept,
      );
      if (response.result === "accepted" && response.battleId) {
        const waitingBattle = await battleInvitationClient.lookupWaitingBattle(
          response.battleId,
          invitation.senderId,
        );
        if (waitingBattle) {
          onOpenBattle(waitingBattle.id);
          return;
        }
        setNotice(
          "Die Einladung wurde angenommen, aber der private Warteraum ist nicht mehr verfügbar.",
        );
      } else if (response.result === "declined") {
        setNotice("Die Battle-Einladung wurde abgelehnt.");
      } else {
        setNotice(
          "Diese Einladung ist nicht mehr offen, abgelaufen oder die Freundschaft wurde beendet.",
        );
      }
      await refresh(true);
    } catch {
      setError(
        "Die Einladung wurde nicht verarbeitet. Aktualisiere das Postfach und prüfe den aktuellen Status.",
      );
      await refresh(true);
    } finally {
      setBusy(null);
    }
  };

  const cancelInvitation = async (invitation: SentBattleInvitation) => {
    if (busy) return;
    setBusy(invitation.id);
    setError(null);
    setNotice(null);
    try {
      const cancelled = await battleInvitationClient.cancelInvitation(invitation.id);
      setNotice(
        cancelled
          ? "Die ausstehende Einladung wurde zurückgezogen."
          : "Diese Einladung ist nicht mehr offen.",
      );
      await refresh(true);
    } catch {
      setError(
        "Die Einladung konnte nicht zurückgezogen werden. Aktualisiere den Status und versuche es erneut.",
      );
    } finally {
      setBusy(null);
    }
  };

  const openWaitingBattle = async (invitation: SentBattleInvitation) => {
    if (busy || !invitation.battleId) return;
    setBusy(invitation.id);
    setError(null);
    try {
      const battle = await battleInvitationClient.lookupWaitingBattle(
        invitation.battleId,
        invitation.recipientId,
      );
      if (battle) onOpenBattle(battle.id);
      else
        setNotice(
          "Der Warteraum ist nicht mehr verfügbar oder die Freundschaft besteht nicht mehr.",
        );
    } catch {
      setError("Der private Battle-Warteraum konnte nicht geprüft werden.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="battle-friend-invitations-title"
      className="relative mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur"
      data-feature-status="enabled"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="battle-friend-invitations-title"
            className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Mit Freunden kämpfen
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Lade einen bestätigten Freund mit deinem gewählten Battle-Modus ein. Das Duell startet
            erst, wenn der Host es im Warteraum ausdrücklich startet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy !== null}
          className="min-h-11 shrink-0 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      )}

      {notReady && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground"
        >
          Battle-Einladungen sind auf dem Server noch nicht eingerichtet. Battle-Codes funktionieren
          weiterhin.
        </p>
      )}

      <div className="mt-4">
        <p id="battle-friend-picker-title" className="text-xs font-medium text-muted-foreground">
          Freund anklicken, um ihn einzuladen
        </p>
        {dashboard && dashboard.friends.length > 0 ? (
          <ul
            aria-labelledby="battle-friend-picker-title"
            className="mt-2 grid gap-2 sm:grid-cols-2"
          >
            {dashboard.friends.map((friend) => (
              <li key={friend.id}>
                <button
                  type="button"
                  onClick={() => void sendInvitation(friend)}
                  disabled={busy !== null || loading}
                  aria-label={`${friend.displayName?.trim() || "Freund"} zum Battle einladen`}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm font-medium hover:border-primary/50 disabled:opacity-50"
                >
                  <span className="truncate">{friend.displayName?.trim() || "Freund"}</span>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {busy === `send-${friend.id}` ? "Sende…" : "Einladen"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {loading ? "Freunde werden geladen…" : "Noch keine bestätigten Freunde."}{" "}
            <Link to="/profile" className="underline underline-offset-2">
              Freunde hinzufügen
            </Link>
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Modus: {MODE_LABELS[mode]} ·{" "}
        {mode === "timed" ? `${durationS}s` : `Ziel ${targetReps} Wdh.`}
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-background/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 id="battle-invitation-inbox-title" className="text-sm font-semibold">
            Battle-Einladungs-Postfach
          </h3>
          <span className="text-xs text-muted-foreground">
            {dashboard?.incoming.length ?? 0} offen
          </span>
        </div>
        {dashboard?.incoming.length ? (
          <ul className="mt-3 space-y-2">
            {dashboard.incoming.map((invitation) => (
              <li key={invitation.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium">
                  {invitation.senderDisplayName?.trim() || "Freund"} ·{" "}
                  {MODE_LABELS[invitation.mode]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invitation.durationS}s · läuft ab{" "}
                  {new Date(invitation.expiresAt).toLocaleString("de-DE")}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void answerInvitation(invitation, true)}
                    className="min-h-11 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Annehmen
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void answerInvitation(invitation, false)}
                    className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {loading ? "Postfach wird geladen…" : "Keine offenen Battle-Einladungen."}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
        <h3 className="text-sm font-semibold">Deine gesendeten Einladungen</h3>
        {dashboard?.sent.length ? (
          <ul className="mt-3 space-y-2">
            {dashboard.sent.map((invitation) => {
              const friend = dashboard.friends.find((item) => item.id === invitation.recipientId);
              return (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {friend?.displayName?.trim() || "Freund"} · {MODE_LABELS[invitation.mode]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {statusLabel(invitation.status)} ·{" "}
                      {new Date(invitation.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  {invitation.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void cancelInvitation(invitation)}
                      className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
                    >
                      Zurückziehen
                    </button>
                  )}
                  {invitation.status === "accepted" && invitation.battleId && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void openWaitingBattle(invitation)}
                      className="min-h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      {busy === invitation.id ? "Prüfe…" : "Warteraum öffnen"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Noch keine gesendeten Battle-Einladungen.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Einladungen erscheinen bei deinem Freund als Pop-up, solange die App geöffnet ist, und immer
        im Postfach. Push-Mitteilungen bei geschlossener App sind nicht aktiviert.
      </p>
    </section>
  );
}
