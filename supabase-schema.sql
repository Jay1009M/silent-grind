-- supabase-schema.sql
--
-- Run this once in your Supabase project's SQL editor (Project ->
-- SQL Editor -> New query -> paste -> Run) before filling in
-- cloud-sync.js. This is a deliberately simple key-value schema, not
-- a fully normalized one — it's the fastest honest path to real
-- cross-device sync for a single user's own data. If you later build
-- a real Ghost Circle / leaderboard feature that needs to query across
-- users (e.g. aggregate hours), you'll want proper normalized tables
-- (goals, proofs, sessions as real rows) instead of one jsonb blob per
-- key. That's a deliberate scope cut for this pass, not an oversight.

create table if not exists public.kv_store (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.kv_store enable row level security;

-- Each user can only ever read or write their own rows.
create policy "kv_store_select_own"
  on public.kv_store for select
  using (auth.uid() = user_id);

create policy "kv_store_insert_own"
  on public.kv_store for insert
  with check (auth.uid() = user_id);

create policy "kv_store_update_own"
  on public.kv_store for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "kv_store_delete_own"
  on public.kv_store for delete
  using (auth.uid() = user_id);

-- Keep updated_at honest on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists kv_store_set_updated_at on public.kv_store;
create trigger kv_store_set_updated_at
  before update on public.kv_store
  for each row execute function public.set_updated_at();
