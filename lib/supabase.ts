"use client";
import { createClient, EmailOtpType, SupabaseClient, User } from "@supabase/supabase-js";
import { GameState, initialState, snapshot, useGame } from "./store";
import { Session } from "./game";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export type SyncStatus = "offline" | "syncing" | "synced" | "error";
export interface Account {
  email: string | null; // null = анонімний (лише цей пристрій)
}

let userId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;
let subscribed = false;
let statusCb: (s: SyncStatus) => void = () => {};
const accountListeners = new Set<(a: Account | null) => void>();

const toAccount = (u: User | null | undefined): Account | null =>
  u ? { email: u.is_anonymous ? null : u.email ?? null } : null;

export function onAccount(fn: (a: Account | null) => void) {
  accountListeners.add(fn);
  refreshAccount();
  const { data: sub } = supabase?.auth.onAuthStateChange((_e, session) => fn(toAccount(session?.user))) ?? { data: null };
  const onVis = () => document.visibilityState === "visible" && refreshAccount();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    accountListeners.delete(fn);
    sub?.subscription.unsubscribe();
    document.removeEventListener("visibilitychange", onVis);
  };
}

/** Тягне свіжі дані користувача з сервера (email міг підтвердитись в іншій вкладці / браузері). */
export async function refreshAccount(): Promise<Account | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  let user = data.user;
  // Токен ще «анонімний», а на сервері email уже прив'язано — оновлюємо сесію.
  if (user && user.email && user.is_anonymous) {
    const r = await supabase.auth.refreshSession();
    user = r.data.user ?? user;
  }
  emitAccount(user);
  return toAccount(user);
}
const emitAccount = (u: User | null | undefined) => accountListeners.forEach((f) => f(toAccount(u)));

async function ensureUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.user;
}

async function push(state: GameState) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("player_state")
    .upsert({ user_id: userId, state, updated_at: new Date(state.updatedAt).toISOString() });
  if (error) throw error;
}

async function fetchRemote(): Promise<GameState | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from("player_state").select("state").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.state as GameState | undefined) ?? null;
}

function applyRemote(remote: GameState) {
  applyingRemote = true;
  useGame.getState().replaceAll(remote);
  applyingRemote = false;
}

/**
 * Узгоджує локальний і віддалений стан.
 * preferRemote — щойно увійшли в існуючий акаунт: його прогрес важливіший за свіжий пристрій.
 */
const OWNER_KEY = "rl-rpg-owner";
const getOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
const setOwner = (id: string) => { try { localStorage.setItem(OWNER_KEY, id); } catch {} };

async function reconcile(preferRemote: boolean) {
  const local = snapshot();
  const remote = await fetchRemote();
  // Локальні дані належать іншому акаунту (або ще нікому) → акаунт важливіший.
  const foreign = !!getOwner() && getOwner() !== userId;
  if (remote && (preferRemote || foreign || remote.updatedAt > local.updatedAt)) applyRemote(remote);
  else await push(local);
  if (userId) setOwner(userId);
}

function subscribeOnce() {
  if (subscribed) return;
  subscribed = true;
  useGame.subscribe(() => {
    if (applyingRemote || !userId) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      statusCb("syncing");
      push(snapshot()).then(() => statusCb("synced")).catch(() => statusCb("error"));
    }, 1500);
  });
}

/** Підключає синхронізацію: тягне віддалений стан, далі пушить зміни з дебаунсом. */
export async function startSync(onStatus: (s: SyncStatus) => void) {
  statusCb = onStatus;
  if (!supabase) return onStatus("offline");
  try {
    onStatus("syncing");
    const user = await ensureUser();
    userId = user?.id ?? null;
    emitAccount(user);
    if (!userId) return onStatus("error");
    await reconcile(false);
    onStatus("synced");
    subscribeOnce();
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

// ───────────── Вхід через email (код із листа) ─────────────

/** link — прив'язуємо email до поточного анонімного акаунта (прогрес зберігається);
 *  login — email уже має акаунт (інший пристрій): входимо в нього. */
export type CodeMode = "link" | "login";

const authErr = (e: { message?: string; code?: string; status?: number }) => {
  const m = (e.message ?? "").toLowerCase();
  if (e.status === 429 || m.includes("rate limit") || m.includes("security purposes"))
    return "Забагато запитів. Зачекай кілька хвилин і спробуй ще раз.";
  if (m.includes("invalid") && m.includes("email")) return "Невірний email";
  if (m.includes("expired") || m.includes("invalid")) return "Код невірний або застарів";
  return e.message || "Помилка входу";
};

export async function requestCode(email: string): Promise<CodeMode> {
  if (!supabase) throw new Error("Supabase не налаштовано");
  const { data } = await supabase.auth.getUser();
  const emailRedirectTo = window.location.origin;
  if (data.user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo });
    if (!error) return "link";
    const taken = error.code === "email_exists" || /already|registered|exists/i.test(error.message);
    if (!taken) throw new Error(authErr(error));
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } });
  if (error) throw new Error(authErr(error));
  return "login";
}

/** input — 6-значний код АБО скопійоване посилання з листа. */
export async function verifyCode(email: string, input: string, mode: CodeMode) {
  if (!supabase) throw new Error("Supabase не налаштовано");
  const raw = input.trim();
  let res;
  if (/^https?:\/\//.test(raw)) {
    const u = new URL(raw);
    const token_hash = u.searchParams.get("token") ?? u.searchParams.get("token_hash");
    const type = (u.searchParams.get("type") ?? (mode === "link" ? "email_change" : "magiclink")) as EmailOtpType;
    if (!token_hash) throw new Error("Це не те посилання — скопіюй кнопку «Sign in» / «Confirm» з листа");
    res = await supabase.auth.verifyOtp({ token_hash, type });
  } else {
    res = await supabase.auth.verifyOtp({ email, token: raw, type: mode === "link" ? "email_change" : "email" });
  }
  const { data, error } = res;
  if (error) {
    // Посилання вже використали (натиснули в іншому браузері) — але email міг уже прив'язатися.
    const acc = await refreshAccount();
    if (acc?.email && acc.email.toLowerCase() === email.toLowerCase()) return;
    throw new Error(
      /^https?:/.test(raw)
        ? "Посилання вже використане або застаріло. Якщо натискав його — перевір вхід: відкрий профіль ще раз. Інакше надішли новий лист."
        : authErr(error),
    );
  }
  userId = data.user?.id ?? userId;
  emitAccount(data.user);
  statusCb("syncing");
  // link: той самий акаунт → просто пушимо; login: беремо прогрес з акаунта.
  await reconcile(mode === "login");
  statusCb("synced");
}

export async function signOut() {
  if (!supabase) return;
  if (pushTimer) clearTimeout(pushTimer);
  await push(snapshot()).catch(() => {});
  await supabase.auth.signOut();
  userId = null;
  // Чистий локальний стан + новий анонімний гість, щоб наступний гравець не бачив чужих даних.
  applyingRemote = true;
  useGame.getState().replaceAll(initialState());
  applyingRemote = false;
  await startSync(statusCb);
}
