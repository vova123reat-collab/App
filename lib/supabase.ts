"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GameState, snapshot, useGame } from "./store";
import { Session } from "./game";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export type SyncStatus = "offline" | "syncing" | "synced" | "error";

let userId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;

async function ensureUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.user?.id ?? null;
}

async function push(state: GameState) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("player_state")
    .upsert({ user_id: userId, state, updated_at: new Date(state.updatedAt).toISOString() });
  if (error) throw error;
}

/** Підключає синхронізацію: тягне віддалений стан, далі пушить зміни з дебаунсом. */
export async function startSync(onStatus: (s: SyncStatus) => void) {
  if (!supabase) return onStatus("offline");
  try {
    onStatus("syncing");
    userId = await ensureUser();
    if (!userId) return onStatus("error");

    const { data, error } = await supabase
      .from("player_state").select("state").eq("user_id", userId).maybeSingle();
    if (error) throw error;

    const local = snapshot();
    const remote = data?.state as GameState | undefined;
    if (remote && remote.updatedAt > local.updatedAt) {
      applyingRemote = true;
      useGame.getState().replaceAll(remote);
      applyingRemote = false;
    } else {
      await push(local);
    }
    onStatus("synced");

    useGame.subscribe(() => {
      if (applyingRemote) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        onStatus("syncing");
        push(snapshot()).then(() => onStatus("synced")).catch(() => onStatus("error"));
      }, 1500);
    });
  } catch (e) {
    console.error("[sync]", e);
    onStatus("error");
  }
}

export async function logSession(s: Session, skillName: string) {
  if (!supabase || !userId) return;
  await supabase.from("focus_sessions").insert({
    id: s.id, user_id: userId, skill_id: s.skillId, skill_name: skillName,
    minutes: s.minutes, xp: s.xp, day: s.date,
  });
}
