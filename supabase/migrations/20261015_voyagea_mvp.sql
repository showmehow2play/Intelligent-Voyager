-- NordicExplorer MVP: schema isolato dall'applicazione esistente.
-- Eseguire nel SQL Editor del progetto Supabase scelto.

create extension if not exists pgcrypto;

create table if not exists public.voyagea_trips (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voyagea_trip_members (
  trip_id text not null references public.voyagea_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.voyagea_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.voyagea_trips(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voyagea_trips_owner_idx on public.voyagea_trips(owner_id);
create index if not exists voyagea_members_user_idx on public.voyagea_trip_members(user_id);
create index if not exists voyagea_invitations_email_idx on public.voyagea_invitations(lower(email));

create or replace function public.voyagea_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists voyagea_trips_updated_at on public.voyagea_trips;
create trigger voyagea_trips_updated_at
before update on public.voyagea_trips
for each row execute function public.voyagea_touch_updated_at();

create or replace function public.voyagea_is_trip_member(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voyagea_trips t
    where t.id = p_trip_id and t.owner_id = auth.uid()
  ) or exists (
    select 1 from public.voyagea_trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.voyagea_trip_role(p_trip_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.voyagea_trips t where t.id = p_trip_id and t.owner_id = auth.uid()) then 'owner'
    else coalesce((select m.role from public.voyagea_trip_members m where m.trip_id = p_trip_id and m.user_id = auth.uid()), '')
  end;
$$;

alter table public.voyagea_trips enable row level security;
alter table public.voyagea_trip_members enable row level security;
alter table public.voyagea_invitations enable row level security;

drop policy if exists voyagea_trips_select on public.voyagea_trips;
create policy voyagea_trips_select on public.voyagea_trips
for select to authenticated
using (owner_id = auth.uid() or public.voyagea_is_trip_member(id));

drop policy if exists voyagea_trips_insert on public.voyagea_trips;
create policy voyagea_trips_insert on public.voyagea_trips
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists voyagea_trips_update on public.voyagea_trips;
create policy voyagea_trips_update on public.voyagea_trips
for update to authenticated
using (public.voyagea_trip_role(id) in ('owner', 'editor'))
with check (public.voyagea_trip_role(id) in ('owner', 'editor'));

drop policy if exists voyagea_trips_delete on public.voyagea_trips;
create policy voyagea_trips_delete on public.voyagea_trips
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists voyagea_members_select on public.voyagea_trip_members;
create policy voyagea_members_select on public.voyagea_trip_members
for select to authenticated
using (user_id = auth.uid() or public.voyagea_trip_role(trip_id) = 'owner');

drop policy if exists voyagea_members_insert on public.voyagea_trip_members;
create policy voyagea_members_insert on public.voyagea_trip_members
for insert to authenticated
with check (public.voyagea_trip_role(trip_id) = 'owner');

drop policy if exists voyagea_members_update on public.voyagea_trip_members;
create policy voyagea_members_update on public.voyagea_trip_members
for update to authenticated
using (public.voyagea_trip_role(trip_id) = 'owner')
with check (public.voyagea_trip_role(trip_id) = 'owner');

drop policy if exists voyagea_members_delete on public.voyagea_trip_members;
create policy voyagea_members_delete on public.voyagea_trip_members
for delete to authenticated
using (public.voyagea_trip_role(trip_id) = 'owner');

drop policy if exists voyagea_invitations_select on public.voyagea_invitations;
create policy voyagea_invitations_select on public.voyagea_invitations
for select to authenticated
using (invited_by = auth.uid() or public.voyagea_is_trip_member(trip_id));

drop policy if exists voyagea_invitations_insert on public.voyagea_invitations;
create policy voyagea_invitations_insert on public.voyagea_invitations
for insert to authenticated
with check (invited_by = auth.uid() and public.voyagea_trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists voyagea_invitations_update on public.voyagea_invitations;
create policy voyagea_invitations_update on public.voyagea_invitations
for update to authenticated
using (invited_by = auth.uid() or public.voyagea_is_trip_member(trip_id))
with check (invited_by = auth.uid() or public.voyagea_is_trip_member(trip_id));

-- Il realtime è opzionale: se è già configurato, l'app può sottoscrivere i viaggi.
-- La sincronizzazione MVP usa comunque upsert e fallback locale.
