/** Supabase bindings for friend codes and the Postfach. Not imported by unit tests. */
import { supabase } from "@/integrations/supabase/client";
import {
  createFriendsClient,
  buildFriendEntries,
  type FriendEntry,
  type FriendProfileRow,
  type FriendshipRow,
} from "./friends-client";
import { createPostfachClient, type PostfachGateway } from "./postfach";
import type { RpcError, RpcGateway } from "./rpc";

export const friendsClient = createFriendsClient(supabase as unknown as RpcGateway);

type Result = PromiseLike<{ data: unknown; error: RpcError | null }>;
type Loose = {
  from(table: string): {
    select(columns: string): {
      order(column: string, opts: { ascending: boolean }): { limit(n: number): Result };
      or(filter: string): { order(column: string, opts: { ascending: boolean }): Result };
      in(column: string, values: string[]): Result;
    };
    update(values: Record<string, unknown>): {
      in(column: string, values: string[]): PromiseLike<{ error: RpcError | null }>;
    };
    delete(): {
      in(column: string, values: string[]): PromiseLike<{ error: RpcError | null }>;
      eq(column: string, value: string): PromiseLike<{ error: RpcError | null }>;
    };
  };
};
const loose = supabase as unknown as Loose;

const postfachGateway: PostfachGateway = {
  list: (limit) =>
    loose.from("postfach_items").select("*").order("created_at", { ascending: false }).limit(limit),
  markRead: (ids, readAt) => loose.from("postfach_items").update({ read_at: readAt }).in("id", ids),
  remove: (ids) => loose.from("postfach_items").delete().in("id", ids),
};

export const postfachClient = createPostfachClient(postfachGateway);

/** Accepted friends with public profile data. Pending rows are never returned here. */
export async function loadFriendEntries(userId: string): Promise<FriendEntry[]> {
  const { data: rows } = await loose
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  const friendships = (Array.isArray(rows) ? rows : []) as FriendshipRow[];
  const ids = Array.from(
    new Set(
      friendships
        .filter((f) => f.status === "accepted")
        .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
    ),
  );
  let profiles: FriendProfileRow[] = [];
  if (ids.length > 0) {
    const { data } = await loose
      .from("public_profiles")
      .select("id, display_name, avatar_url, level, xp, current_streak, battle_wins")
      .in("id", ids);
    profiles = (Array.isArray(data) ? data : []) as FriendProfileRow[];
  }
  return buildFriendEntries(userId, friendships, profiles);
}

export async function removeFriendship(friendshipId: string): Promise<boolean> {
  const { error } = await loose.from("friendships").delete().eq("id", friendshipId);
  return !error;
}
