-- Real-Life RPG — схема Supabase.
-- Виконати в Supabase → SQL Editor.
-- Також увімкнути: Authentication → Sign In / Providers → "Allow anonymous sign-ins".

-- Увесь стан персонажа зберігається одним JSON-документом на користувача.
-- Це найпростіша і надійна синхронізація для офлайн-першого мобільного застосунку.
create table if not exists public.player_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.player_state enable row level security;

drop policy if exists "own state select" on public.player_state;
drop policy if exists "own state insert" on public.player_state;
drop policy if exists "own state update" on public.player_state;

create policy "own state select" on public.player_state
  for select using (auth.uid() = user_id);
create policy "own state insert" on public.player_state
  for insert with check (auth.uid() = user_id);
create policy "own state update" on public.player_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Історія фокус-сесій окремою таблицею — зручно для статистики / графіків.
create table if not exists public.focus_sessions (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  skill_id   text not null,
  skill_name text not null,
  minutes    int  not null,
  xp         int  not null,
  day        date not null,
  created_at timestamptz not null default now()
);

alter table public.focus_sessions enable row level security;

drop policy if exists "own sessions" on public.focus_sessions;
create policy "own sessions" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists focus_sessions_user_day on public.focus_sessions(user_id, day);
