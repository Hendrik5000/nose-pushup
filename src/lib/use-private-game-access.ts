import { useEffect, useReducer, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAreaAccess } from "@/lib/admin.functions";
import {
  createPrivateGameAccessState,
  getPrivateGameAccessStatusForUser,
  hasPrivateGameAccessForUser,
  reducePrivateGameAccess,
} from "@/lib/private-game-access-policy";

const AUTH_IDENTITY_EVENTS = new Set(["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"]);

export function usePrivateGameAccess(userId: string | null) {
  const [state, dispatch] = useReducer(
    reducePrivateGameAccess,
    userId,
    createPrivateGameAccessState,
  );
  const authUserIdRef = useRef(userId);
  const routeUserIdRef = useRef(userId);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!AUTH_IDENTITY_EVENTS.has(event)) return;
      const nextUserId = session?.user.id ?? null;
      authUserIdRef.current = nextUserId;
      requestIdRef.current += 1;
      dispatch({ type: "auth-change", userId: nextUserId });
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (routeUserIdRef.current === userId) return;
    routeUserIdRef.current = userId;
    authUserIdRef.current = userId;
    requestIdRef.current += 1;
    dispatch({ type: "auth-change", userId });
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId || state.userId !== userId || authUserIdRef.current !== userId) {
      return () => {
        active = false;
      };
    }

    const check = async () => {
      const requestId = ++requestIdRef.current;
      const revision = state.revision;
      dispatch({ type: "check-start", userId, revision, requestId });

      let allowed = false;
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const sessionUserId = session?.user.id ?? null;
        if (sessionUserId !== userId) {
          authUserIdRef.current = sessionUserId;
          requestIdRef.current += 1;
          dispatch({ type: "auth-change", userId: sessionUserId });
          return;
        }

        allowed = (await getAdminAreaAccess()) === true;

        const {
          data: { session: verifiedSession },
          error: verificationError,
        } = await supabase.auth.getSession();
        if (verificationError) throw verificationError;
        const verifiedUserId = verifiedSession?.user.id ?? null;
        if (verifiedUserId !== userId) {
          authUserIdRef.current = verifiedUserId;
          requestIdRef.current += 1;
          dispatch({ type: "auth-change", userId: verifiedUserId });
          return;
        }
      } catch {
        allowed = false;
      }

      if (!active || requestIdRef.current !== requestId || authUserIdRef.current !== userId) return;
      dispatch({ type: "check-result", userId, revision, requestId, allowed });
    };

    void check();
    const invalidateBeforeForegroundCheck = () => {
      if (document.hidden || authUserIdRef.current !== userId) return;
      requestIdRef.current += 1;
      dispatch({ type: "recheck", userId });
    };
    const onFocus = () => invalidateBeforeForegroundCheck();
    const onVisibilityChange = () => {
      invalidateBeforeForegroundCheck();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      requestIdRef.current += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state.revision, state.userId, userId]);

  return {
    state,
    status: getPrivateGameAccessStatusForUser(state, userId),
    hasAccess: hasPrivateGameAccessForUser(state, userId),
  };
}
