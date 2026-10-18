-- Automatic client error reports (optional sync from the app)
create table if not exists public.error_reports (
  id text primary key,
  message text not null,
  name text,
  stack text,
  route text,
  source text,
  severity text not null default 'error',
  user_agent text,
  user_id uuid references auth.users (id) on delete set null,
  extra jsonb not null default '{}'::jsonb,
  fixed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists error_reports_created_at_idx on public.error_reports (created_at desc);
create index if not exists error_reports_fixed_idx on public.error_reports (fixed) where fixed = false;

alter table public.error_reports enable row level security;

-- Authenticated users can insert their own reports
drop policy if exists "error_reports_insert_own" on public.error_reports;
create policy "error_reports_insert_own"
  on public.error_reports for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Users can read their own reports (dev / support)
drop policy if exists "error_reports_select_own" on public.error_reports;
create policy "error_reports_select_own"
  on public.error_reports for select
  to authenticated
  using (user_id = auth.uid());

-- Anon insert without user_id (guest crashes)
drop policy if exists "error_reports_insert_anon" on public.error_reports;
create policy "error_reports_insert_anon"
  on public.error_reports for insert
  to anon
  with check (user_id is null);
