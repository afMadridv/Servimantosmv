-- ============================================================
-- Portal de Reportes de Obra · Servimantos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- El archivo es IDEMPOTENTE y SEGURO de re-ejecutar: no borra
-- tablas ni datos. Cada vez que cambie algo, se pega completo
-- otra vez y se le da Run.
--
-- Contenido:
--   0) Perfiles y roles (admin / trabajador)
--   1) Reportes
--   2) Consecutivo del número de reporte (INF-VT-001, -002, …)
--   3) Storage privado de fotos
--   4) Proyectos de la página web (solo administradores)
--   5) Storage público de las fotos de proyectos
--   6) Eventos: auditoría y avisos en vivo
--   7) Dispositivos de cada cuenta (alertas de seguridad)
--   8) Suscripciones Web Push
-- ============================================================


-- ============================================================
-- 0) PERFILES Y ROLES
--    Cada usuario de Authentication tiene una fila aquí. El
--    PRIMER usuario queda como «admin»; los que se creen después,
--    como «trabajador». El rol se cambia a mano en
--    Table Editor → perfiles → columna rol.
-- ============================================================
create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null default '',
  rol        text not null default 'trabajador' check (rol in ('admin', 'trabajador')),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- ¿El usuario de esta petición es administrador? security definer
-- para poder usarla dentro de otras políticas sin recursión de RLS.
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- Cada quien lee su perfil; el admin, todos. Nadie lo escribe desde
-- el navegador: así un trabajador no puede ascenderse a admin.
drop policy if exists "perfil_select" on public.perfiles;
create policy "perfil_select" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_admin());

-- Perfil automático para cada usuario nuevo.
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.perfiles where rol = 'admin') then 'trabajador' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Usuarios que ya existían antes de esta tabla.
insert into public.perfiles (id, nombre, rol)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 'trabajador'
from auth.users u
on conflict (id) do nothing;

-- Si todavía nadie es admin, lo es el usuario más antiguo.
update public.perfiles set rol = 'admin'
 where id = (select id from auth.users order by created_at limit 1)
   and not exists (select 1 from public.perfiles where rol = 'admin');


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

-- Esto es contenido del sitio, no de cada quien: no se filtra por
-- user_id. Con trabajadores en el portal, cambiar la web pública es
-- solo de administradores.
drop policy if exists "proy_select_auth" on public.proyectos;
create policy "proy_select_auth" on public.proyectos
  for select to authenticated using (true);

drop policy if exists "proy_insert" on public.proyectos;
create policy "proy_insert" on public.proyectos
  for insert to authenticated with check (public.es_admin());

drop policy if exists "proy_update" on public.proyectos;
create policy "proy_update" on public.proyectos
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "proy_delete" on public.proyectos;
create policy "proy_delete" on public.proyectos
  for delete to authenticated using (public.es_admin());

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

-- Subir y borrar: solo administradores, cada uno en su carpeta.
drop policy if exists "proy_img_insert" on storage.objects;
create policy "proy_img_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'proyectos-web'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.es_admin()
  );

drop policy if exists "proy_img_delete" on storage.objects;
create policy "proy_img_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'proyectos-web'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.es_admin()
  );


-- ============================================================
-- 6) EVENTOS: auditoría y avisos en vivo
--    El portal inserta una fila por cada cosa que avisa (entrar,
--    abrir un formato, completarlo, dispositivo nuevo). Los
--    administradores la reciben en vivo por Realtime y, si hay
--    Web Push, también con el portal cerrado.
-- ============================================================
create table if not exists public.eventos (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_nombre text not null default '',
  tipo         text not null check (tipo in (
                 'login', 'login_nuevo_dispositivo', 'formato_abierto', 'formato_completado')),
  detalle      jsonb not null default '{}'::jsonb,
  notificado   boolean not null default false,   -- la Edge Function ya mandó el push
  created_at   timestamptz not null default now()
);

create index if not exists eventos_fecha_idx on public.eventos (created_at desc);
create index if not exists eventos_actor_idx on public.eventos (actor_id, created_at desc);

alter table public.eventos enable row level security;

-- Quién lo hizo lo pone el servidor, no el navegador: nadie puede
-- inventar un evento a nombre de otro.
create or replace function public.firmar_evento()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.actor_id     := auth.uid();
  -- el full_name de Authentication manda: suele ponerse DESPUÉS de crear el usuario
  new.actor_nombre := coalesce(
    (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = auth.uid()),
    (select nullif(nombre, '') from public.perfiles where id = auth.uid()),
    '');
  new.notificado   := false;
  new.created_at   := now();
  return new;
end;
$$;

drop trigger if exists eventos_firmar on public.eventos;
create trigger eventos_firmar
  before insert on public.eventos
  for each row execute function public.firmar_evento();

drop policy if exists "ev_insert" on public.eventos;
create policy "ev_insert" on public.eventos
  for insert to authenticated with check (auth.uid() is not null);

-- El admin ve todo; cada quien, lo suyo (sus alertas de seguridad).
drop policy if exists "ev_select" on public.eventos;
create policy "ev_select" on public.eventos
  for select to authenticated using (actor_id = auth.uid() or public.es_admin());

-- Realtime: avisos en vivo. Respeta las políticas de arriba.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos'
  ) then
    alter publication supabase_realtime add table public.eventos;
  end if;
end;
$$;


-- ============================================================
-- 7) DISPOSITIVOS de cada cuenta
--    Un navegador que la cuenta no conocía = alerta de seguridad
--    en los otros dispositivos del mismo usuario.
-- ============================================================
create table if not exists public.dispositivos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id   text not null,
  descripcion text not null default '',   -- «Chrome en Android (móvil)»
  primera_vez timestamptz not null default now(),
  ultima_vez  timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table public.dispositivos enable row level security;

drop policy if exists "disp_select" on public.dispositivos;
create policy "disp_select" on public.dispositivos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "disp_insert" on public.dispositivos;
create policy "disp_insert" on public.dispositivos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "disp_update" on public.dispositivos;
create policy "disp_update" on public.dispositivos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================
-- 8) SUSCRIPCIONES WEB PUSH
--    Una por navegador. `prefs` son las preferencias de la
--    campanita de ese dispositivo: la Edge Function solo manda
--    los avisos que estén encendidos ahí.
-- ============================================================
create table if not exists public.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id  text not null default '',
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  prefs      jsonb not null default '{}'::jsonb,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_suscripciones enable row level security;

drop policy if exists "push_select" on public.push_suscripciones;
create policy "push_select" on public.push_suscripciones
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_insert" on public.push_suscripciones;
create policy "push_insert" on public.push_suscripciones
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_update" on public.push_suscripciones;
create policy "push_update" on public.push_suscripciones
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_delete" on public.push_suscripciones;
create policy "push_delete" on public.push_suscripciones
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists push_updated_at on public.push_suscripciones;
create trigger push_updated_at
  before update on public.push_suscripciones
  for each row execute function public.tocar_updated_at();


-- ============================================================
-- USUARIOS DEL PORTAL
--
-- 1. Authentication → Users → Add user
--    · marca "Auto Confirm User"
--    · correo y contraseña con los que se va a entrar
--    · el PRIMER usuario queda como admin; los siguientes, como
--      trabajador (trigger «al_crear_usuario» de la sección 0)
--
-- 2. En ese mismo usuario → Raw User Meta Data, deja:
--        { "full_name": "Miriam Villar Sepulveda" }
--    Ese es el nombre que aparece en el portal y en los avisos.
--
-- 3. Para cambiar un rol: Table Editor → perfiles → columna rol
--    («admin» o «trabajador»).
--
-- 4. Authentication → Providers → Email: apaga "Enable Sign Ups"
--    para que nadie pueda registrarse solo.
-- ============================================================
