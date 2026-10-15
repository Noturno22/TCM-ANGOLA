-- =====================================================================
-- Online — Fase 1: salas, ocupação e chat em tempo real
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query)
-- ou via Management API (POST /v1/projects/{ref}/database/query).
--
-- PRINCÍPIO DE SEGURANÇA:
--   * `rooms` é catálogo (leitura pública, escrita só service_role).
--   * `messages` é append-only; o cliente só pode inserir mensagens em
--     seu nome e ler as mensagens das salas (RLS).
--   * A presença ("jogadores online") NÃO vive na base de dados — usa
--     Supabase Realtime Presence (canal efémero `room:{id}`), evitando
--     escrita de estado e linhas obsoletas.
--   * As apostas das salas são em moeda virtual (KZ), nunca dinheiro real.
-- =====================================================================

-- ============================ Catálogo ==============================

create table if not exists public.rooms (
  id          text primary key,                 -- 'angola','luanda',...
  name        text not null,
  capacity    integer not null default 50 check (capacity > 0),
  stake       integer not null default 0 check (stake >= 0),  -- KZ virtual
  is_featured boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Sementes do mockup (idempotente).
insert into public.rooms (id, name, capacity, stake, is_featured, sort_order) values
  ('angola',   'Angola',        50, 200, true,  0),
  ('luanda',   'Luanda',        50, 100, false, 1),
  ('benguela', 'Benguela',      40,  50, false, 2),
  ('huambo',   'Huambo',        30,  25, false, 3),
  ('cabinda',  'Cabinda',       20,  10, false, 4),
  ('global',   'Global (Free)', 100,  0, false, 5)
on conflict (id) do update set
  name = excluded.name,
  capacity = excluded.capacity,
  stake = excluded.stake,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;

-- ============================== Chat =================================

create table if not exists public.messages (
  id         bigserial primary key,
  room_id    text not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 280),
  kind       text not null default 'user' check (kind in ('user', 'announcement')),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at desc, id desc);

-- ============================ RLS ====================================

alter table public.rooms enable row level security;
alter table public.messages enable row level security;

-- Catálogo: leitura para todos (mesmo anónimos), escrita bloqueada.
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all"
  on public.rooms for select
  using (true);

-- Chat: leitura para autenticados; inserção apenas em nome próprio.
drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated"
  on public.messages for select to authenticated
  using (true);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid() and kind = 'user');

grant select on public.rooms to anon, authenticated;
grant select, insert on public.messages to authenticated;

-- Nunca permitir UPDATE/DELETE de mensagens pelo cliente.
revoke update, delete on public.messages from anon, authenticated;

-- ======================= Realtime (chat) =============================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

-- ====================== RPC: enviar mensagem =========================
-- Evita depender de INSERT direto e valida/limita o conteúdo no servidor.

create or replace function public.send_message(
  p_room_id text,
  p_body    text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_msg  public.messages;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'invalid_message_length' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  insert into public.messages (room_id, user_id, body)
  values (p_room_id, auth.uid(), v_body)
  returning * into v_msg;

  return v_msg;
end;
$$;

grant execute on function public.send_message(text, text) to authenticated;
