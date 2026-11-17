import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Клієнт з service role — лише на сервері, обходить RLS. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Без схожих символів (0/O, 1/I/L) — легко ввести з екрана.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function randomCode(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
