-- =====================================================================
-- AMIGO SECRETO · Esquema completo de base de datos (PostgreSQL / Supabase)
-- ---------------------------------------------------------------------
-- Ejecuta este archivo COMPLETO una sola vez en:
--   Supabase → SQL Editor → New query → pegar → Run
--
-- Modelo de seguridad:
--   * El navegador NUNCA habla directamente con la base de datos.
--   * Todas las tablas tienen RLS activado y políticas que NIEGAN todo
--     a los roles públicos (anon / authenticated). Aunque alguien obtenga
--     la URL del proyecto y la clave pública, no puede leer ni escribir nada.
--   * El servidor de Next.js usa la clave secreta (service_role) SOLO del
--     lado del servidor, después de verificar la sesión firmada del usuario.
--   * Los triggers protegen las reglas del juego incluso si alguien usa
--     la clave secreta por error: no se puede editar después del sorteo,
--     no se pueden modificar ni borrar asignaciones, etc.
-- =====================================================================

-- gen_random_uuid() viene incluido en PostgreSQL 13+ (Supabase usa 15+).

-- ---------------------------------------------------------------------
-- 1. CONFIGURACIÓN DEL JUEGO (una sola fila)
-- ---------------------------------------------------------------------
create table if not exists public.game_settings (
  id                              smallint primary key default 1,
  expected_participants           integer,
  status                          text not null default 'REGISTRATION_OPEN',
  assignments_locked              boolean not null default false,
  allow_wishlist_edit_after_lock  boolean not null default false,
  assignment_started_at           timestamptz,
  assignment_completed_at         timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint game_settings_singleton check (id = 1),
  constraint game_settings_status_valid
    check (status in ('REGISTRATION_OPEN', 'ASSIGNING', 'ASSIGNED')),
  constraint game_settings_expected_range
    check (expected_participants is null or expected_participants between 2 and 1000),
  constraint game_settings_lock_consistency
    check (assignments_locked = (status <> 'REGISTRATION_OPEN')),
  constraint game_settings_completed_consistency
    check ((status = 'ASSIGNED') = (assignment_completed_at is not null))
);

insert into public.game_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. PARTICIPANTES
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  name_normalized            text not null,
  student_code               text not null,
  wishlist                   text not null default '',
  has_existing_assignment    boolean not null default false,
  reported_target_name       text,
  reported_target_id         uuid references public.participants (id) on delete set null,
  reported_target_confirmed  boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint participants_student_code_unique unique (student_code),
  constraint participants_student_code_format check (student_code ~ '^A00[0-9]{6}$'),
  constraint participants_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint participants_name_normalized_not_empty check (char_length(name_normalized) > 0),
  constraint participants_wishlist_length check (char_length(wishlist) <= 2000),
  constraint participants_reported_name_length
    check (reported_target_name is null or char_length(btrim(reported_target_name)) between 2 and 80),
  constraint participants_no_self_report
    check (reported_target_id is null or reported_target_id <> id),
  constraint participants_report_consistency check (
    (has_existing_assignment and reported_target_name is not null)
    or (
      not has_existing_assignment
      and reported_target_name is null
      and reported_target_id is null
      and not reported_target_confirmed
    )
  ),
  constraint participants_confirmed_requires_target
    check (not reported_target_confirmed or reported_target_id is not null)
);

create index if not exists participants_name_normalized_idx
  on public.participants (name_normalized);
create index if not exists participants_reported_target_id_idx
  on public.participants (reported_target_id);
create index if not exists participants_pending_reference_idx
  on public.participants (has_existing_assignment)
  where has_existing_assignment and reported_target_id is null;

-- ---------------------------------------------------------------------
-- 3. ASIGNACIONES DEFINITIVAS
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  giver_id     uuid not null references public.participants (id) on delete restrict,
  receiver_id  uuid not null references public.participants (id) on delete restrict,
  source       text not null,
  created_at   timestamptz not null default now(),

  constraint assignments_giver_unique unique (giver_id),
  constraint assignments_receiver_unique unique (receiver_id),
  constraint assignments_no_self check (giver_id <> receiver_id),
  constraint assignments_source_valid check (source in ('EXISTING', 'GENERATED'))
);

-- ---------------------------------------------------------------------
-- 4. INTENTOS DE INICIO DE SESIÓN FALLIDOS (limitador anti fuerza bruta)
-- ---------------------------------------------------------------------
create table if not exists public.login_attempts (
  id          bigint generated always as identity primary key,
  scope       text not null,
  client_key  text not null,
  created_at  timestamptz not null default now(),
  constraint login_attempts_scope_valid check (scope in ('participant', 'admin'))
);

create index if not exists login_attempts_lookup_idx
  on public.login_attempts (scope, client_key, created_at desc);

-- =====================================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================================

-- Actualiza updated_at automáticamente.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists participants_touch_updated_at on public.participants;
create trigger participants_touch_updated_at
  before update on public.participants
  for each row execute function public.touch_updated_at();

drop trigger if exists game_settings_touch_updated_at on public.game_settings;
create trigger game_settings_touch_updated_at
  before update on public.game_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Protección de participantes según el estado del juego.
--   REGISTRATION_OPEN → se puede registrar, editar y eliminar.
--   ASSIGNING         → todo bloqueado.
--   ASSIGNED          → todo bloqueado, salvo la lista de deseos si la
--                       administradora lo permite.
-- ---------------------------------------------------------------------
create or replace function public.guard_participants_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_allow_wishlist boolean;
begin
  -- FOR SHARE: si el sorteo está en curso, esperamos a que termine.
  select status, allow_wishlist_edit_after_lock
    into v_status, v_allow_wishlist
    from public.game_settings
   where id = 1
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

drop trigger if exists participants_guard_write on public.participants;
create trigger participants_guard_write
  before insert or update or delete on public.participants
  for each row execute function public.guard_participants_write();

-- Si el vínculo del papelito desaparece (por ejemplo, porque se eliminó a la
-- persona y la llave foránea lo puso en NULL), la confirmación también se
-- quita. El NOMBRE escrito en el papelito se conserva: queda como
-- referencia pendiente, nunca se borra.
create or replace function public.normalize_participant_reference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reported_target_id is null then
    new.reported_target_confirmed := false;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_release_references on public.participants;
drop function if exists public.release_references_on_delete();
drop trigger if exists participants_normalize_reference on public.participants;
create trigger participants_normalize_reference
  before insert or update on public.participants
  for each row execute function public.normalize_participant_reference();

-- ---------------------------------------------------------------------
-- Protección de asignaciones:
--   * Solo se pueden INSERTAR mientras el estado es ASSIGNING
--     (es decir, dentro de commit_assignments).
--   * Nunca se pueden modificar ni borrar, salvo un reinicio manual
--     deliberado (ver README → "Reiniciar el juego").
-- ---------------------------------------------------------------------
create or replace function public.guard_assignments_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status from public.game_settings where id = 1;
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

drop trigger if exists assignments_guard_write on public.assignments;
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

drop trigger if exists assignments_guard_truncate on public.assignments;
create trigger assignments_guard_truncate
  before truncate on public.assignments
  for each statement execute function public.guard_assignments_truncate();

-- ---------------------------------------------------------------------
-- Transiciones de estado válidas:
--   REGISTRATION_OPEN → ASSIGNING → ASSIGNED
-- Una vez ASSIGNED no se vuelve atrás (salvo reinicio manual deliberado).
-- assignments_locked se calcula solo, a partir del estado.
-- ---------------------------------------------------------------------
create or replace function public.guard_settings_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reset boolean := coalesce(current_setting('app.allow_reset', true), '') = 'on';
begin
  if new.id <> old.id then
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

drop trigger if exists game_settings_guard_update on public.game_settings;
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

drop trigger if exists game_settings_guard_delete on public.game_settings;
create trigger game_settings_guard_delete
  before delete on public.game_settings
  for each row execute function public.guard_settings_delete();

-- ---------------------------------------------------------------------
-- SORTEO ATÓMICO
-- Recibe el resultado calculado por el servidor y lo guarda en UNA sola
-- transacción. Si cualquier verificación falla, NO se guarda nada y el
-- juego sigue en REGISTRATION_OPEN.
--
-- p_participant_ids: lista de participantes que el servidor analizó.
--   Si alguien se registró o se eliminó mientras tanto, se aborta.
-- p_assignments: [{ "giver_id": uuid, "receiver_id": uuid, "source": "EXISTING"|"GENERATED" }]
-- ---------------------------------------------------------------------
create or replace function public.commit_assignments(
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
  -- Bloquea la configuración: nadie puede registrarse ni sortear en paralelo.
  select status into v_status from public.game_settings where id = 1 for update;

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
     or (select count(*) from public.participants) <> v_expected_count
     or exists (select 1 from public.participants p where not (p.id = any (p_participant_ids)))
  then
    raise exception 'PARTICIPANTS_CHANGED' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_assignments) is distinct from 'array'
     or jsonb_array_length(p_assignments) <> v_expected_count
  then
    raise exception 'INCOMPLETE_ASSIGNMENT' using errcode = 'P0001';
  end if;

  update public.game_settings set status = 'ASSIGNING' where id = 1;

  -- Las restricciones UNIQUE(giver), UNIQUE(receiver), CHECK(no self) y las
  -- llaves foráneas garantizan una permutación válida sin duplicados.
  insert into public.assignments (giver_id, receiver_id, source)
  select (item ->> 'giver_id')::uuid,
         (item ->> 'receiver_id')::uuid,
         item ->> 'source'
    from jsonb_array_elements(p_assignments) as item;

  if (select count(*) from public.assignments) <> v_expected_count then
    raise exception 'INCOMPLETE_ASSIGNMENT' using errcode = 'P0001';
  end if;

  -- Cada papelito existente debe conservarse EXACTAMENTE.
  if exists (
    select 1
      from public.participants p
     where p.has_existing_assignment
       and (
         p.reported_target_id is null
         or not exists (
           select 1 from public.assignments a
            where a.giver_id = p.id
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
     where a.source = 'EXISTING' and not p.has_existing_assignment
  ) then
    raise exception 'INVALID_SOURCE' using errcode = 'P0001';
  end if;

  update public.game_settings set status = 'ASSIGNED' where id = 1
  returning assignment_completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

-- =====================================================================
-- PERMISOS Y ROW LEVEL SECURITY
-- =====================================================================

alter table public.game_settings  enable row level security;
alter table public.participants   enable row level security;
alter table public.assignments    enable row level security;
alter table public.login_attempts enable row level security;

-- Los roles públicos de Supabase no tienen NINGÚN privilegio sobre las tablas.
revoke all on table public.game_settings  from anon, authenticated;
revoke all on table public.participants   from anon, authenticated;
revoke all on table public.assignments    from anon, authenticated;
revoke all on table public.login_attempts from anon, authenticated;

-- Políticas explícitas de denegación (defensa en profundidad: aunque
-- alguien vuelva a otorgar permisos por error, RLS sigue negando el acceso).
drop policy if exists deny_public_settings on public.game_settings;
create policy deny_public_settings on public.game_settings
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_public_participants on public.participants;
create policy deny_public_participants on public.participants
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_public_assignments on public.assignments;
create policy deny_public_assignments on public.assignments
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists deny_public_login_attempts on public.login_attempts;
create policy deny_public_login_attempts on public.login_attempts
  as restrictive for all to anon, authenticated using (false) with check (false);

-- El servidor (service_role) es el único que opera las tablas.
grant select, insert, update, delete on table public.game_settings  to service_role;
grant select, insert, update, delete on table public.participants   to service_role;
grant select, insert, update, delete on table public.assignments    to service_role;
grant select, insert, delete         on table public.login_attempts to service_role;

-- Las funciones no se pueden invocar desde el navegador.
revoke execute on function public.commit_assignments(uuid[], jsonb) from public, anon, authenticated;
grant  execute on function public.commit_assignments(uuid[], jsonb) to service_role;

revoke execute on function public.touch_updated_at()              from public, anon, authenticated;
revoke execute on function public.guard_participants_write()      from public, anon, authenticated;
revoke execute on function public.normalize_participant_reference() from public, anon, authenticated;
revoke execute on function public.guard_assignments_write()       from public, anon, authenticated;
revoke execute on function public.guard_assignments_truncate()    from public, anon, authenticated;
revoke execute on function public.guard_settings_update()         from public, anon, authenticated;
revoke execute on function public.guard_settings_delete()         from public, anon, authenticated;
