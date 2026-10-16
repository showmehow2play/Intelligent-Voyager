-- Travel Business Case Next Generation - online link MVP
--
-- Questo schema appartiene esclusivamente alla nuova applicazione.
-- NON eseguire questo file nel progetto Supabase dell'applicazione originale.
--
-- Il payload JSON è intenzionalmente usato solo per la prima fase online:
-- permette di validare collaborazione e link senza bloccare il prodotto su un
-- modello dati definitivo. Le tabelle relazionali verranno aggiunte dopo la
-- validazione del flusso mobile.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.travel_next_trips (
  id uuid primary key default gen_random_uuid(),
  share_token_hash text not null unique,
  share_token_hint text not null,
  name text not null,
  destination text not null default '',
  status text not null default 'bozza'
    check (status in ('bozza', 'pianificazione', 'in_corso', 'concluso', 'archiviato')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_next_trips_updated_idx
  on public.travel_next_trips (updated_at desc);

create or replace function public.travel_next_hash_token(p_token text)
returns text
language sql
immutable
as $$
  -- In Supabase pgcrypto risiede nello schema extensions.
  select encode(
    extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text),
    'hex'
  );
$$;

create or replace function public.travel_next_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists travel_next_trips_updated_at on public.travel_next_trips;
create trigger travel_next_trips_updated_at
before update on public.travel_next_trips
for each row execute function public.travel_next_touch_updated_at();

-- Il token è il segreto condiviso del viaggio. Non viene mai salvato in chiaro.
create or replace function public.travel_next_create_trip(
  p_token text,
  p_name text,
  p_destination text,
  p_status text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trip public.travel_next_trips;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Token viaggio non valido';
  end if;

  insert into public.travel_next_trips (
    share_token_hash, share_token_hint, name, destination, status, payload
  ) values (
    public.travel_next_hash_token(p_token),
    right(p_token, 6),
    coalesce(nullif(trim(p_name), ''), 'Viaggio senza nome'),
    coalesce(p_destination, ''),
    coalesce(nullif(p_status, ''), 'bozza'),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into new_trip;

  return jsonb_build_object(
    'id', new_trip.id,
    'name', new_trip.name,
    'destination', new_trip.destination,
    'status', new_trip.status,
    'payload', new_trip.payload,
    'updatedAt', new_trip.updated_at
  );
end;
$$;

create or replace function public.travel_next_get_trip(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trip public.travel_next_trips;
begin
  select * into trip
  from public.travel_next_trips
  where share_token_hash = public.travel_next_hash_token(p_token);

  if not found then
    raise exception 'Viaggio non trovato o link non valido';
  end if;

  return jsonb_build_object(
    'id', trip.id,
    'name', trip.name,
    'destination', trip.destination,
    'status', trip.status,
    'payload', trip.payload,
    'updatedAt', trip.updated_at
  );
end;
$$;

create or replace function public.travel_next_save_trip(
  p_token text,
  p_name text,
  p_destination text,
  p_status text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_trip public.travel_next_trips;
begin
  update public.travel_next_trips
  set name = coalesce(nullif(trim(p_name), ''), name),
      destination = coalesce(p_destination, destination),
      status = coalesce(nullif(p_status, ''), status),
      payload = coalesce(p_payload, payload)
  where share_token_hash = public.travel_next_hash_token(p_token)
  returning * into saved_trip;

  if not found then
    raise exception 'Viaggio non trovato o link non valido';
  end if;

  return jsonb_build_object(
    'id', saved_trip.id,
    'name', saved_trip.name,
    'destination', saved_trip.destination,
    'status', saved_trip.status,
    'payload', saved_trip.payload,
    'updatedAt', saved_trip.updated_at
  );
end;
$$;

alter table public.travel_next_trips enable row level security;

-- Nessun accesso diretto alla tabella dal browser: si usano solo le funzioni
-- precedenti, che validano il token condiviso.
revoke all on table public.travel_next_trips from anon, authenticated;
grant execute on function public.travel_next_create_trip(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.travel_next_get_trip(text) to anon, authenticated;
grant execute on function public.travel_next_save_trip(text, text, text, text, jsonb) to anon, authenticated;

