/** Supabase bindings for friend app shares. Not imported by unit tests. */
import { supabase } from "@/integrations/supabase/client";
import { createFriendAppSharesClient, type FriendAppSharesGateway } from "./friend-app-shares";

type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Loose = {
  from(table: string): {
    select(columns: string): {
      order(column: string, opts: { ascending: boolean }): Result;
    };
    insert(values: Record<string, unknown>): Result;
    delete(): {
      eq(column: string, value: string): Result;
    };
  };
};
const loose = supabase as unknown as Loose;

const friendAppSharesGateway: FriendAppSharesGateway = {
  list: () => loose.from("friend_app_shares").select("*").order("created_at", { ascending: false }),
  insert: (values) => loose.from("friend_app_shares").insert(values),
  remove: (id) => loose.from("friend_app_shares").delete().eq("id", id),
};

export const friendAppSharesClient = createFriendAppSharesClient(friendAppSharesGateway);
