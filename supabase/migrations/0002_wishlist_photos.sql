-- =====================================================================
-- AMIGO SECRETO · Fotos en la lista de deseos
-- ---------------------------------------------------------------------
-- Ejecuta este archivo UNA vez en Supabase → SQL Editor → New query → Run
-- (después de 0001_init.sql). Se puede volver a ejecutar sin problema.
--
-- Las fotos se guardan en un bucket PRIVADO de Supabase Storage. Nadie
-- puede verlas con un enlace público: el servidor genera enlaces firmados
-- que expiran en 1 hora, y solo para quien tiene permiso de verlas
-- (la persona dueña, quien le regala y la administradora).
-- =====================================================================

-- 1. Rutas de las fotos de cada participante (máximo 4).
alter table public.participants
  add column if not exists wishlist_photos text[] not null default '{}';

alter table public.participants
  drop constraint if exists participants_wishlist_photos_max;
alter table public.participants
  add constraint participants_wishlist_photos_max
  check (coalesce(array_length(wishlist_photos, 1), 0) <= 4);

-- Cada ruta debe estar dentro de la carpeta del propio participante.
create or replace function public.photos_belong_to(p_id uuid, p_paths text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(bool_and(path like p_id::text || '/%' and path !~ '\.\.'), true)
    from unnest(p_paths) as path;
$$;

alter table public.participants
  drop constraint if exists participants_wishlist_photos_owner;
alter table public.participants
  add constraint participants_wishlist_photos_owner
  check (public.photos_belong_to(id, wishlist_photos));

revoke execute on function public.photos_belong_to(uuid, text[]) from public, anon, authenticated;
grant  execute on function public.photos_belong_to(uuid, text[]) to service_role;

-- 2. Bucket privado: solo imágenes, máximo 3 MB por foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No se crean políticas de Storage para anon/authenticated: sin políticas,
-- RLS de storage.objects niega todo acceso público. Solo el servidor
-- (service_role) sube, borra y firma enlaces.
