-- ============================================================
-- Portal de Reportes de Obra · Servimantos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- El archivo es IDEMPOTENTE y SEGURO de re-ejecutar: no borra
-- tablas ni datos. Cada vez que cambie algo, se pega completo
-- otra vez y se le da Run.
--
-- Contenido:
--   1) Reportes
--   2) Consecutivo del número de reporte (INF-VT-001, -002, …)
--   3) Storage privado de fotos
--   4) Proyectos de la página web
--   5) Storage público de las fotos de proyectos
--
-- El portal es de UN SOLO usuario, así que no hay tabla de
-- perfiles ni roles: el nombre que se muestra sale de los
-- metadatos del usuario (full_name).
-- ============================================================


-- ============================================================
-- 1) REPORTES
-- ============================================================
create table if not exists public.reportes (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null,
  data       jsonb not null default '{}'::jsonb,
  user_id    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reportes_fecha_idx on public.reportes (updated_at desc);
create index if not exists reportes_user_idx  on public.reportes (user_id, updated_at desc);

alter table public.reportes enable row level security;

-- Cada quien ve y edita solo lo suyo. Con un único usuario esto
-- equivale a "todo", pero deja el portal listo por si algún día
-- entra alguien más sin que se mezclen los reportes.
drop policy if exists "rep_select" on public.reportes;
create policy "rep_select" on public.reportes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "rep_insert" on public.reportes;
create policy "rep_insert" on public.reportes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "rep_update" on public.reportes;
create policy "rep_update" on public.reportes
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "rep_delete" on public.reportes;
create policy "rep_delete" on public.reportes
  for delete to authenticated using (user_id = auth.uid());

-- La fecha de modificación la pone el servidor, no el reloj del navegador.
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rep_updated_at on public.reportes;
create trigger rep_updated_at
  before update on public.reportes
  for each row execute function public.tocar_updated_at();


-- ============================================================
-- 2) CONSECUTIVO DEL NÚMERO DE REPORTE
--    Lo entrega el servidor: dos reportes creados a la vez no
--    pueden quedar con el mismo número.
-- ============================================================
create table if not exists public.consecutivos (
  prefijo text primary key,
  ultimo  bigint not null default 0
);

alter table public.consecutivos enable row level security;
-- Sin políticas: nadie la toca directo. Solo la función de abajo,
-- que es security definer y por eso sí puede escribir.

-- Arranca el contador donde va la numeración actual.
insert into public.consecutivos (prefijo, ultimo)
select 'INF-VT', count(*) from public.reportes
on conflict (prefijo) do nothing;

create or replace function public.siguiente_numero(p_prefijo text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  n bigint;
  p text := upper(trim(coalesce(p_prefijo, '')));
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  -- admite prefijos con guion: INF-VT
  if p !~ '^[A-Z]{2,8}(-[A-Z]{2,8})?$' then
    raise exception 'Prefijo no válido';
  end if;
  insert into public.consecutivos (prefijo, ultimo)
  values (p, 1)
  on conflict (prefijo) do update set ultimo = public.consecutivos.ultimo + 1
  returning ultimo into n;
  return p || '-' || lpad(n::text, 3, '0');
end;
$$;

revoke all on function public.siguiente_numero(text) from public, anon;
grant execute on function public.siguiente_numero(text) to authenticated;

-- Índice único sobre el número. Si ya hubiera duplicados NO se crea
-- y se avisa cuáles son (no se borra ni se renombra nada solo).
do $$
declare
  dups integer;
begin
  select count(*) into dups from (
    select numero from public.reportes group by numero having count(*) > 1
  ) t;
  if dups > 0 then
    raise warning 'Hay % número(s) repetido(s): no se creó el índice único. Míralos con:  select numero, count(*) from public.reportes group by numero having count(*) > 1;', dups;
  else
    create unique index if not exists reportes_numero_key on public.reportes (numero);
  end if;
end;
$$;


-- ============================================================
-- 3) STORAGE — fotos de obra (bucket PRIVADO)
--    El portal abre cada foto con una URL firmada temporal.
--    Con el bucket público, cualquiera con la anon key (que va
--    en el navegador) podría listarse todas las fotos.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('reportes-obra', 'reportes-obra', false)
on conflict (id) do nothing;

update storage.buckets
   set public = false,
       file_size_limit = 10485760,          -- 10 MB por foto
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'reportes-obra';

-- Cada usuario sube a su propia carpeta: <uuid-usuario>/archivo.jpg
drop policy if exists "obra_img_insert" on storage.objects;
create policy "obra_img_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'reportes-obra'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "obra_img_select" on storage.objects;
create policy "obra_img_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'reportes-obra'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "obra_img_delete" on storage.objects;
create policy "obra_img_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'reportes-obra'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 4) PROYECTOS DE LA PÁGINA WEB
--    Lo que se ve en la sección «Proyectos» del sitio público.
--    Se administra desde el portal y lo lee cualquier visitante
--    con la anon key, siempre que esté publicado.
-- ============================================================
create table if not exists public.proyectos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text not null default '',
  -- [{ "src": "<ruta dentro del bucket>", "desc": "pie de foto" }, …]
  -- La primera imagen es la portada de la caja en la web.
  imagenes    jsonb not null default '[]'::jsonb,
  orden       integer not null default 0,
  publicado   boolean not null default true,
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists proyectos_orden_idx on public.proyectos (orden, created_at);

alter table public.proyectos enable row level security;

-- El sitio público entra sin sesión: solo puede leer lo publicado.
drop policy if exists "proy_select_anon" on public.proyectos;
create policy "proy_select_anon" on public.proyectos
  for select to anon using (publicado);

-- Esto es contenido del sitio, no de cada quien: el portal ve y edita
-- todo sin filtrar por user_id (los registros a los que se les borre el
-- usuario seguirían siendo editables). El registro de quién lo creó se
-- guarda igual en user_id.
drop policy if exists "proy_select_auth" on public.proyectos;
create policy "proy_select_auth" on public.proyectos
  for select to authenticated using (true);

drop policy if exists "proy_insert" on public.proyectos;
create policy "proy_insert" on public.proyectos
  for insert to authenticated with check (true);

drop policy if exists "proy_update" on public.proyectos;
create policy "proy_update" on public.proyectos
  for update to authenticated using (true) with check (true);

drop policy if exists "proy_delete" on public.proyectos;
create policy "proy_delete" on public.proyectos
  for delete to authenticated using (true);

drop trigger if exists proy_updated_at on public.proyectos;
create trigger proy_updated_at
  before update on public.proyectos
  for each row execute function public.tocar_updated_at();


-- ============================================================
-- 5) STORAGE — fotos de los proyectos (bucket PÚBLICO)
--    Al revés que las fotos de obra: estas se muestran en la web
--    abierta, así que la URL es directa, fija y cacheable.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('proyectos-web', 'proyectos-web', true)
on conflict (id) do nothing;

update storage.buckets
   set public = true,
       file_size_limit = 10485760,          -- 10 MB por foto
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'proyectos-web';

drop policy if exists "proy_img_select" on storage.objects;
create policy "proy_img_select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'proyectos-web');

-- Subir y borrar sigue siendo solo del portal, cada quien en su carpeta.
drop policy if exists "proy_img_insert" on storage.objects;
create policy "proy_img_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'proyectos-web'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "proy_img_delete" on storage.objects;
create policy "proy_img_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'proyectos-web'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- EL ÚNICO USUARIO DEL PORTAL (solo la primera vez):
--
-- 1. Authentication → Users → Add user
--    · marca "Auto Confirm User"
--    · correo y contraseña con los que se va a entrar
--
-- 2. En ese mismo usuario → Raw User Meta Data, deja:
--        { "full_name": "Miriam Villar Sepulveda" }
--    Ese es el nombre que aparece arriba en el portal.
--
-- 3. Authentication → Providers → Email: apaga "Enable Sign Ups"
--    para que nadie más pueda registrarse solo.
-- ============================================================
