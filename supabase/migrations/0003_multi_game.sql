-- =====================================================================
-- AMIGO SECRETO · Varios juegos independientes
-- ---------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en Supabase → SQL Editor → New query → Run
-- (después de 0001_init.sql y 0002_wishlist_photos.sql).
--
-- Qué hace:
--   * Crea la tabla "games" (cada juego tiene su nombre y un enlace propio).
--   * Cada participante, asignación y configuración pertenece a UN juego.
--     El mismo código de estudiante puede estar en juegos distintos.
--   * Si ya tenías un juego (el de 0001), se conserva con todos sus datos
--     y se llama «Grupo 8» (enlace: /juego/grupo-8).
--   * El sorteo, los bloqueos y las validaciones ahora son por juego:
--     sortear un juego no bloquea los demás.
--
-- Es seguro ejecutarlo sobre una base que ya tiene datos.
-- =====================================================================

-- 0. Quitar los triggers actuales: se vuelven a crear al final, ya por juego.
drop trigger if exists participants_guard_write on public.participants;
drop trigger if exists participants_normalize_reference on public.participants;
drop trigger if exists assignments_guard_write on public.assignments;
drop trigger if exists assignments_guard_truncate on public.assignments;
drop trigger if exists game_settings_guard_update on public.game_settings;
drop trigger if exists game_settings_guard_delete on public.game_settings;

-- 1. JUEGOS
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  name        text not null,
  created_at  timestamptz not null default now(),

  constraint games_slug_unique unique (slug),
  constraint games_slug_format check (
    char_length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint games_name_length check (char_length(btrim(name)) between 2 and 60)
);

-- 2. CONFIGURACIÓN: una fila por juego (antes era una sola fila fija).
alter table public.game_settings
  add column if not exists game_id uuid references public.games (id) on delete restrict;

-- Juego existente de 0001 (solo si hay una fila de configuración sin juego).
insert into public.games (slug, name)
select 'grupo-8', 'Grupo 8'
 where exists (select 1 from public.game_settings where game_id is null)
   and not exists (select 1 from public.games where slug = 'grupo-8')
on conflict (slug) do nothing;

update public.game_settings
   set game_id = (select id from public.games where slug = 'grupo-8')
 where game_id is null;

alter table public.game_settings drop constraint if exists game_settings_singleton;
-- Al eliminar la columna id también desaparece su llave primaria.
alter table public.game_settings drop column if exists id;
alter table public.game_settings alter column game_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.game_settings'::regclass and contype = 'p'
  ) then
    alter table public.game_settings add primary key (game_id);
  end if;
end;
$$;

-- 3. PARTICIPANTES: pertenecen a un juego; el código es único DENTRO del juego.
alter table public.participants
  add column if not exists game_id uuid references public.games (id) on delete restrict;

update public.participants
   set game_id = (select id from public.games where slug = 'grupo-8')
 where game_id is null;

alter table public.participants alter column game_id set not null;

alter table public.participants drop constraint if exists participants_student_code_unique;
alter table public.participants drop constraint if exists participants_game_student_unique;
alter table public.participants
  add constraint participants_game_student_unique unique (game_id, student_code);

create index if not exists participants_game_id_idx on public.participants (game_id);

-- 4. ASIGNACIONES: cada una pertenece al juego de su participante.
alter table public.assignments
  add column if not exists game_id uuid references public.games (id) on delete restrict;

update public.assignments a
   set game_id = p.game_id
  from public.participants p
 where p.id = a.giver_id and a.game_id is null;

alter table public.assignments alter column game_id set not null;
create index if not exists assignments_game_id_idx on public.assignments (game_id);

-- 5. FUNCIONES Y TRIGGERS, AHORA POR JUEGO
-- ---------------------------------------------------------------------

-- Protección de participantes según el estado de SU juego.
--   REGISTRATION_OPEN → se puede registrar, editar y eliminar.
--   ASSIGNING         → todo bloqueado.
--   ASSIGNED          → todo bloqueado, salvo la lista de deseos si la
--                       administradora lo permite.
create or replace function public.guard_participants_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_game uuid := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  v_status text;
  v_allow_wishlist boolean;
begin
  if tg_op = 'UPDATE' and new.game_id is distinct from old.game_id then
    raise exception 'GAME_IMMUTABLE' using errcode = 'P0001';
  end if;

  -- FOR SHARE: si el sorteo de ESE juego está en curso, esperamos a que termine.
  select status, allow_wishlist_edit_after_lock
    into v_status, v_allow_wishlist
    from public.game_settings
   where game_id = v_game
   for share;

  if v_status is null then
    raise exception 'SETTINGS_MISSING' using errcode = 'P0001';
  end if;

  if v_status = 'REGISTRATION_OPEN' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and v_status = 'ASSIGNED'
     and v_allow_wishlist
     and new.id = old.id
     and new.name = old.name
     and new.name_normalized = old.name_normalized
     and new.student_code = old.student_code
     and new.has_existing_assignment = old.has_existing_assignment
     and new.reported_target_name is not distinct from old.reported_target_name
     and new.reported_target_id is not distinct from old.reported_target_id
     and new.reported_target_confirmed = old.reported_target_confirmed
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'GAME_LOCKED' using errcode = 'P0001';
end;
$$;

create trigger participants_guard_write
  before insert or update or delete on public.participants
  for each row execute function public.guard_participants_write();

-- Si el vínculo del papelito desaparece, la confirmación también se quita.
-- El NOMBRE escrito en el papelito se conserva como referencia pendiente.
-- Un papelito solo puede apuntar a una persona DEL MISMO juego.
create or replace function public.normalize_participant_reference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reported_target_id is null then
    new.reported_target_confirmed := false;
  elsif not exists (
    select 1 from public.participants t
     where t.id = new.reported_target_id and t.game_id = new.game_id
  ) then
    raise exception 'REFERENCE_OTHER_GAME' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger participants_normalize_reference
  before insert or update on public.participants
  for each row execute function public.normalize_participant_reference();

-- Asignaciones: solo se INSERTAN mientras su juego está en ASSIGNING
-- (es decir, dentro de commit_assignments). Nunca se modifican ni borran.
create or replace function public.guard_assignments_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status from public.game_settings where game_id = new.game_id;
    if v_status is distinct from 'ASSIGNING' then
      raise exception 'ASSIGNMENTS_LOCKED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if coalesce(current_setting('app.allow_reset', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'ASSIGNMENTS_LOCKED' using errcode = 'P0001';
end;
$$;

create trigger assignments_guard_write
  before insert or update or delete on public.assignments
  for each row execute function public.guard_assignments_write();

create or replace function public.guard_assignments_truncate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_reset', true), '') = 'on' then
    return null;
  end if;
  raise exception 'ASSIGNMENTS_LOCKED' using errcode = 'P0001';
end;
$$;

create trigger assignments_guard_truncate
  before truncate on public.assignments
  for each statement execute function public.guard_assignments_truncate();

-- Transiciones válidas por juego: REGISTRATION_OPEN → ASSIGNING → ASSIGNED.
create or replace function public.guard_settings_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reset boolean := coalesce(current_setting('app.allow_reset', true), '') = 'on';
begin
  if new.game_id <> old.game_id then
    raise exception 'SETTINGS_ID_IMMUTABLE' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status and not v_reset then
    if not (
      (old.status = 'REGISTRATION_OPEN' and new.status = 'ASSIGNING')
      or (old.status = 'ASSIGNING' and new.status = 'ASSIGNED')
    ) then
      if old.status = 'ASSIGNED' then
        raise exception 'ALREADY_ASSIGNED' using errcode = 'P0001';
      end if;
      raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001';
    end if;
  end if;

  if not v_reset then
    new.assignment_started_at := case
      when new.status = 'ASSIGNING' and old.status = 'REGISTRATION_OPEN' then now()
      else old.assignment_started_at
    end;
    new.assignment_completed_at := case
      when new.status = 'ASSIGNED' and old.status = 'ASSIGNING' then now()
      else old.assignment_completed_at
    end;
  end if;

  new.assignments_locked := new.status <> 'REGISTRATION_OPEN';
  return new;
end;
$$;

create trigger game_settings_guard_update
  before update on public.game_settings
  for each row execute function public.guard_settings_update();

create or replace function public.guard_settings_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'SETTINGS_IMMUTABLE' using errcode = 'P0001';
end;
$$;

create trigger game_settings_guard_delete
  before delete on public.game_settings
  for each row execute function public.guard_settings_delete();

-- SORTEO ATÓMICO DE UN JUEGO
-- p_game_id: el juego que se sortea.
-- p_participant_ids: participantes que el servidor analizó (de ESE juego).
-- p_assignments: [{ "giver_id", "receiver_id", "source" }]
drop function if exists public.commit_assignments(uuid[], jsonb);

create or replace function public.commit_assignments(
  p_game_id uuid,
  p_participant_ids uuid[],
  p_assignments jsonb
)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_expected_count integer := coalesce(array_length(p_participant_ids, 1), 0);
  v_completed_at timestamptz;
begin
  -- Bloquea la configuración de ESTE juego.
  select status into v_status from public.game_settings where game_id = p_game_id for update;

  if v_status is null then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status = 'ASSIGNED' then
    raise exception 'ALREADY_ASSIGNED' using errcode = 'P0001';
  end if;
  if v_status is distinct from 'REGISTRATION_OPEN' then
    raise exception 'GAME_LOCKED' using errcode = 'P0001';
  end if;

  if v_expected_count < 2 then
    raise exception 'NOT_ENOUGH_PARTICIPANTS' using errcode = 'P0001';
  end if;

  if (select count(distinct x) from unnest(p_participant_ids) as x) <> v_expected_count
     or (select count(*) from public.participants where game_id = p_game_id) <> v_expected_count
     or exists (
       select 1 from public.participants p
        where p.game_id = p_game_id and not (p.id = any (p_participant_ids))
     )
  then
    raise exception 'PARTICIPANTS_CHANGED' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_assignments) is distinct from 'array'
     or jsonb_array_length(p_assignments) <> v_expected_count
  then
    raise exception 'INCOMPLETE_ASSIGNMENT' using errcode = 'P0001';
  end if;

  update public.game_settings set status = 'ASSIGNING' where game_id = p_game_id;

  -- UNIQUE(giver), UNIQUE(receiver), CHECK(no self) y las llaves foráneas
  -- garantizan una permutación válida sin duplicados.
  insert into public.assignments (game_id, giver_id, receiver_id, source)
  select p_game_id,
         (item ->> 'giver_id')::uuid,
         (item ->> 'receiver_id')::uuid,
         item ->> 'source'
    from jsonb_array_elements(p_assignments) as item;

  if (select count(*) from public.assignments where game_id = p_game_id) <> v_expected_count then
    raise exception 'INCOMPLETE_ASSIGNMENT' using errcode = 'P0001';
  end if;

  -- Quien sea que aparezca en una asignación debe ser del mismo juego.
  if exists (
    select 1 from public.assignments a
     where a.game_id = p_game_id
       and not (a.giver_id = any (p_participant_ids) and a.receiver_id = any (p_participant_ids))
  ) then
    raise exception 'INCOMPLETE_ASSIGNMENT' using errcode = 'P0001';
  end if;

  -- Cada papelito existente debe conservarse EXACTAMENTE.
  if exists (
    select 1
      from public.participants p
     where p.game_id = p_game_id
       and p.has_existing_assignment
       and (
         p.reported_target_id is null
         or not exists (
           select 1 from public.assignments a
            where a.game_id = p_game_id
              and a.giver_id = p.id
              and a.receiver_id = p.reported_target_id
              and a.source = 'EXISTING'
         )
       )
  ) then
    raise exception 'EXISTING_NOT_PRESERVED' using errcode = 'P0001';
  end if;

  -- Nadie sin papelito puede tener una asignación marcada como EXISTING.
  if exists (
    select 1
      from public.assignments a
      join public.participants p on p.id = a.giver_id
     where a.game_id = p_game_id and a.source = 'EXISTING' and not p.has_existing_assignment
  ) then
    raise exception 'INVALID_SOURCE' using errcode = 'P0001';
  end if;

  update public.game_settings set status = 'ASSIGNED' where game_id = p_game_id
  returning assignment_completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

-- 6. PERMISOS Y ROW LEVEL SECURITY PARA LA TABLA NUEVA
alter table public.games enable row level security;
revoke all on table public.games from anon, authenticated;

drop policy if exists deny_public_games on public.games;
create policy deny_public_games on public.games
  as restrictive for all to anon, authenticated using (false) with check (false);

grant select, insert, update on table public.games to service_role;

-- Funciones: solo el servidor puede ejecutarlas.
revoke execute on function public.commit_assignments(uuid, uuid[], jsonb) from public, anon, authenticated;
grant  execute on function public.commit_assignments(uuid, uuid[], jsonb) to service_role;

revoke execute on function public.guard_participants_write()       from public, anon, authenticated;
revoke execute on function public.normalize_participant_reference() from public, anon, authenticated;
revoke execute on function public.guard_assignments_write()        from public, anon, authenticated;
revoke execute on function public.guard_assignments_truncate()     from public, anon, authenticated;
revoke execute on function public.guard_settings_update()          from public, anon, authenticated;
revoke execute on function public.guard_settings_delete()          from public, anon, authenticated;
