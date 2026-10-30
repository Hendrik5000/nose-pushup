import { supabase } from "@/integrations/supabase/client";
import {
  createBattleInvitationClient,
  createSupabaseBattleInvitationGateway,
} from "@/lib/battle-invitation-client";
import { BATTLE_INVITATIONS_UI_ENABLED } from "@/lib/battle-invitation-gate";

/** One shared client for the lobby panel and the global Postfach listener. */
export const battleInvitationClient = createBattleInvitationClient(
  createSupabaseBattleInvitationGateway(supabase),
  { migrationVerified: BATTLE_INVITATIONS_UI_ENABLED },
);
