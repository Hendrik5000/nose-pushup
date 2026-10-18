-- Allow watch as health_entries source (no schema break if source is free text)
-- Optional device registry for future server-side pairing

create table if not exists public.wearable_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null,
  name text not null,
  enabled boolean not null default true,
  last_sync_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wearable_devices_user_id_idx on public.wearable_devices (user_id);

alter table public.wearable_devices enable row level security;

drop policy if exists "wearable_devices_own" on public.wearable_devices;
create policy "wearable_devices_own"
  on public.wearable_devices
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
